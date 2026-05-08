import { Injectable } from "@nestjs/common";

type ChatRole = "system" | "user" | "assistant";
type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ChatContent = string | Array<TextPart | ImagePart>;

export interface QwenMessage {
  role: ChatRole;
  content: ChatContent;
}

interface QwenResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

export interface QwenChatResult {
  content: string;
  model: string;
  fallbackUsed: boolean;
  usage?: QwenResponse["usage"];
}

@Injectable()
export class QwenService {
  private readonly baseUrl = process.env.QWEN_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  private readonly primaryModel = process.env.QWEN_PRIMARY_MODEL ?? "qwen3.6-flash-2026-04-16";
  private readonly fallbackModel = process.env.QWEN_FALLBACK_MODEL ?? "qwen3.6-flash";
  private readonly maxOutputTokens = Number(process.env.QWEN_MAX_OUTPUT_TOKENS ?? 64000);

  isConfigured() {
    return Boolean(process.env.QWEN_API_KEY);
  }

  async chat(messages: QwenMessage[], options: { temperature?: number; jsonMode?: boolean } = {}): Promise<QwenChatResult> {
    if (!this.isConfigured()) {
      throw new Error("QWEN_API_KEY is not configured.");
    }

    try {
      return await this.callModel(this.primaryModel, messages, options, false);
    } catch (error) {
      if (!this.shouldFallback(error)) throw error;
      return this.callModel(this.fallbackModel, messages, options, true);
    }
  }

  async chatJson<T>(messages: QwenMessage[], fallback: T): Promise<T> {
    try {
      const result = await this.chat(messages, { temperature: 0.1, jsonMode: true });
      return this.parseJson(result.content, fallback);
    } catch {
      return fallback;
    }
  }

  private async callModel(
    model: string,
    messages: QwenMessage[],
    options: { temperature?: number; jsonMode?: boolean },
    fallbackUsed: boolean
  ): Promise<QwenChatResult> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.QWEN_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: this.maxOutputTokens,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(process.env.QWEN_ENABLE_THINKING ? { enable_thinking: process.env.QWEN_ENABLE_THINKING === "true" } : {})
      })
    });

    const payload = (await response.json().catch(() => ({}))) as QwenResponse & { error?: { message?: string; code?: string } };
    if (!response.ok) {
      const apiError = new Error(payload.error?.message ?? `Qwen API error ${response.status}`) as Error & { status?: number; code?: string };
      apiError.status = response.status;
      apiError.code = payload.error?.code;
      throw apiError;
    }

    return {
      content: payload.choices?.[0]?.message?.content ?? "",
      model: payload.model ?? model,
      fallbackUsed,
      usage: payload.usage
    };
  }

  private shouldFallback(error: unknown) {
    const candidate = error as { status?: number; code?: string; message?: string };
    const message = `${candidate.code ?? ""} ${candidate.message ?? ""}`.toLowerCase();
    return (
      [400, 402, 408, 409, 429, 500, 503].includes(candidate.status ?? 0) ||
      message.includes("token") ||
      message.includes("quota") ||
      message.includes("rate") ||
      message.includes("context") ||
      message.includes("limit")
    );
  }

  private parseJson<T>(raw: string, fallback: T): T {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const jsonText = fenced ?? trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
    try {
      return JSON.parse(jsonText) as T;
    } catch {
      return fallback;
    }
  }
}
