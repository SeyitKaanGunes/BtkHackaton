import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const GEMINI_PRIMARY_MODEL = "gemini-3-flash-preview";
const GEMINI_SECONDARY_MODEL = "gemini-2.5-flash";

type ChatRole = "system" | "user" | "assistant";
type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ChatContent = string | Array<TextPart | ImagePart>;

export interface GeminiMessage {
  role: ChatRole;
  content: ChatContent;
}

export interface GeminiChatResult {
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

type GeminiChatOptions = { temperature?: number; model?: string; maxTokens?: number; timeoutMs?: number };

@Injectable()
export class GeminiService {
  private readonly baseURL = process.env.GEMINI_BASE_URL ?? GEMINI_OPENAI_BASE_URL;
  private readonly textModel = process.env.GEMINI_TEXT_MODEL ?? GEMINI_PRIMARY_MODEL;
  private readonly secondaryModel = process.env.GEMINI_SECONDARY_MODEL ?? GEMINI_SECONDARY_MODEL;
  private client?: OpenAI;

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async chat(messages: GeminiMessage[], options: GeminiChatOptions = {}): Promise<GeminiChatResult> {
    if (!this.isConfigured()) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const model = options.model ?? this.textModel;
    try {
      return await this.createChatCompletion(model, messages, options);
    } catch (error) {
      if (!this.shouldTrySecondaryModel(model, error)) throw error;
      return this.createChatCompletion(this.secondaryModel, messages, options);
    }
  }

  private async createChatCompletion(
    model: string,
    messages: GeminiMessage[],
    options: { temperature?: number; maxTokens?: number; timeoutMs?: number }
  ): Promise<GeminiChatResult> {
    const abortController = options.timeoutMs ? new AbortController() : undefined;
    const timeout = abortController ? setTimeout(() => abortController.abort(), options.timeoutMs) : undefined;
    try {
      const response = await this.getClient().chat.completions.create(
        {
          model,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens,
          messages: messages as ChatCompletionMessageParam[]
        },
        abortController ? { signal: abortController.signal } : undefined
      );

      return {
        content: response.choices[0]?.message?.content ?? "",
        model: response.model ?? model,
        usage: response.usage
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private getClient() {
    this.client ??= new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: this.baseURL
    });
    return this.client;
  }

  private shouldTrySecondaryModel(model: string, error: unknown) {
    if (!this.secondaryModel || this.secondaryModel === model) return false;
    if (isTimeoutLikeError(error)) return false;
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : undefined;
    return status !== 401 && status !== 403;
  }
}

function isTimeoutLikeError(error: unknown) {
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name.toLowerCase() : "";
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return name.includes("abort") || name.includes("timeout") || code.includes("abort") || code.includes("timeout") || message.includes("aborted") || message.includes("timeout");
}
