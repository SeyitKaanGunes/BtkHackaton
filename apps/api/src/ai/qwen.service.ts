import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const QWEN_PRIMARY_MODEL = "qwen3.6-flash-2026-04-16";
const QWEN_SECONDARY_MODEL = "qwen3.6-flash";

type ChatRole = "system" | "user" | "assistant";
type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ChatContent = string | Array<TextPart | ImagePart>;

export interface QwenMessage {
  role: ChatRole;
  content: ChatContent;
}

export interface QwenChatResult {
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

type QwenChatOptions = { temperature?: number; model?: string; maxTokens?: number; timeoutMs?: number };

@Injectable()
export class QwenService {
  private readonly baseURL = process.env.QWEN_BASE_URL ?? QWEN_BASE_URL;
  private readonly textModel = process.env.QWEN_TEXT_MODEL ?? QWEN_PRIMARY_MODEL;
  private readonly secondaryModel = process.env.QWEN_SECONDARY_MODEL ?? QWEN_SECONDARY_MODEL;
  private client?: OpenAI;

  isConfigured() {
    return Boolean(process.env.QWEN_API_KEY);
  }

  async chat(messages: QwenMessage[], options: QwenChatOptions = {}): Promise<QwenChatResult> {
    if (!this.isConfigured()) {
      throw new Error("QWEN_API_KEY is not configured.");
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
    messages: QwenMessage[],
    options: { temperature?: number; maxTokens?: number; timeoutMs?: number }
  ): Promise<QwenChatResult> {
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
      apiKey: process.env.QWEN_API_KEY,
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
