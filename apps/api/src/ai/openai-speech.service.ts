import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import OpenAI, { toFile } from "openai";
import type { SpeechToTextResult } from "@fintwin/shared";

const OPENAI_STT_MODEL = "gpt-4o-mini-transcribe";
const OPENAI_MAX_AUDIO_BYTES = 20 * 1024 * 1024;

@Injectable()
export class OpenAiSpeechService {
  private client?: OpenAI;

  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async transcribe(input: { audioBase64?: string; mimeType?: string; fileName?: string; language?: string }): Promise<SpeechToTextResult> {
    const audioBase64 = input.audioBase64?.trim();
    if (!audioBase64) throw new BadRequestException("audioBase64 is required.");
    if (!this.isConfigured()) throw new ServiceUnavailableException("OpenAI STT için OPENAI_API_KEY tanımlı değil.");

    const audio = Buffer.from(audioBase64, "base64");
    if (audio.length === 0) throw new BadRequestException("audioBase64 is empty.");
    if (audio.length > OPENAI_MAX_AUDIO_BYTES) {
      throw new BadRequestException("Ses dosyası 20 MB sınırını aşıyor.");
    }

    const model = process.env.OPENAI_STT_MODEL?.trim() || OPENAI_STT_MODEL;
    const fileName = normalizedFileName(input.fileName, input.mimeType);
    try {
      const transcription = await this.getClient().audio.transcriptions.create({
        file: await toFile(audio, fileName, { type: input.mimeType || mimeTypeForFileName(fileName) }),
        model,
        language: input.language?.trim() || "tr",
        response_format: "json"
      });

      return {
        text: transcription.text?.trim() ?? "",
        model
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI STT ses dosyasını yazıya çeviremedi.";
      throw new ServiceUnavailableException(message);
    }
  }

  private getClient() {
    this.client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return this.client;
  }
}

function normalizedFileName(fileName?: string, mimeType?: string) {
  const safeName = fileName?.trim().replace(/[^\w.-]/g, "_");
  if (safeName && /\.[a-z0-9]+$/i.test(safeName)) return safeName;
  return `${safeName || "voice"}${extensionForMimeType(mimeType)}`;
}

function extensionForMimeType(mimeType?: string) {
  const normalized = mimeType?.toLowerCase();
  if (normalized?.includes("mpeg") || normalized?.includes("mp3")) return ".mp3";
  if (normalized?.includes("mp4")) return ".mp4";
  if (normalized?.includes("mpga")) return ".mpga";
  if (normalized?.includes("m4a")) return ".m4a";
  if (normalized?.includes("wav")) return ".wav";
  if (normalized?.includes("webm")) return ".webm";
  return ".m4a";
}

function mimeTypeForFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".mpga")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  return "audio/m4a";
}
