import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 20_000);
const requested = requestedProviders();

loadEnvFile(resolve(root, ".env"));
loadEnvFile(resolve(root, "apps/api/.env"));

const checks = {
  qwen: smokeQwen,
  gemini: smokeGemini,
  openai: smokeOpenAi,
  twelve: smokeTwelveData
};

let failed = false;

for (const [name, check] of Object.entries(checks)) {
  if (!requested.has(name)) continue;
  try {
    const result = await check();
    console.log(`[ok] ${name}: ${result}`);
  } catch (error) {
    failed = true;
    console.error(`[fail] ${name}: ${errorMessage(error)}`);
  }
}

if (failed) process.exit(1);

function requestedProviders() {
  const only = readArgValue("--only");
  if (!only) return new Set(["qwen", "gemini", "openai", "twelve"]);
  return new Set(
    only
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function smokeQwen() {
  const apiKey = requiredEnv("QWEN_API_KEY");
  const baseUrl = env("QWEN_BASE_URL") ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  const model = env("QWEN_TEXT_MODEL") ?? "qwen3.6-flash-2026-04-16";
  const endpoint = `${trimSlash(baseUrl)}/chat/completions`;
  const payload = await postJson(endpoint, {
    headers: { authorization: `Bearer ${apiKey}` },
    body: {
      model,
      temperature: 0,
      messages: [{ role: "user", content: "Tek kelimeyle 'tamam' yaz." }]
    }
  });
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Qwen boş cevap döndürdü.");

  const visionModel = env("QWEN_VISION_MODEL") ?? model;
  const visionPayload = await postJson(endpoint, {
    headers: { authorization: `Bearer ${apiKey}` },
    body: {
      model: visionModel,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Bu küçük test görselini tek kelimeyle tanımla." },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
              }
            }
          ]
        }
      ]
    }
  });
  const visionContent = visionPayload?.choices?.[0]?.message?.content;
  if (typeof visionContent !== "string" || !visionContent.trim()) throw new Error("Qwen vision boş cevap döndürdü.");
  return `${model} text ve ${visionModel} vision cevap verdi`;
}

async function smokeGemini() {
  const apiKey = env("GEMINI_API_KEY") ?? env("GOOGLE_API_KEY") ?? env("GOOGLE_GENERATIVE_AI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY, GOOGLE_API_KEY veya GOOGLE_GENERATIVE_AI_API_KEY eksik.");
  const model = env("GEMINI_TTS_MODEL") ?? "gemini-3.1-flash-tts-preview";
  const payload = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    headers: { "x-goog-api-key": apiKey },
    body: {
      contents: [{ parts: [{ text: "Kısa bir Türkçe test sesi üret: tamam." }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: env("GEMINI_TTS_VOICE") ?? "Kore" }
          }
        }
      }
    }
  });
  const audioPart = payload?.candidates?.[0]?.content?.parts?.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  if (!audioPart) throw new Error("Gemini TTS audio cevabı bulunamadı.");
  return `${model} audio döndürdü`;
}

async function smokeOpenAi() {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const payload = await getJson("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  if (!Array.isArray(payload?.data)) throw new Error("OpenAI models listesi alınamadı.");
  return "API anahtarı modeller endpointinde doğrulandı";
}

async function smokeTwelveData() {
  const apiKey = requiredEnv("TWELVE_DATA_API_KEY");
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", "USD/TRY");
  url.searchParams.set("apikey", apiKey);
  const payload = await getJson(url.toString());
  if (payload?.status === "error") throw new Error(String(payload.message ?? "Twelve Data hata döndürdü."));
  const price = Number(payload?.close ?? payload?.price ?? payload?.previous_close);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Twelve Data geçerli fiyat döndürmedi.");
  return `USD/TRY fiyatı alındı`;
}

async function postJson(url, { headers = {}, body }) {
  return requestJson(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

async function getJson(url, { headers = {} } = {}) {
  return requestJson(url, { method: "GET", headers });
}

async function requestJson(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function loadEnvFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = unquote(trimmed.slice(separator + 1).trim());
    if (!process.env[key]) process.env[key] = value;
  }
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function env(key) {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function requiredEnv(key) {
  const value = env(key);
  if (!value) throw new Error(`${key} eksik.`);
  return value;
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
