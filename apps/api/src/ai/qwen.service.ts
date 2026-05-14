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

@Injectable()
export class QwenService {
  private readonly baseURL = process.env.QWEN_BASE_URL ?? QWEN_BASE_URL;
  private readonly textModel = process.env.QWEN_TEXT_MODEL ?? QWEN_PRIMARY_MODEL;
  private readonly secondaryModel = process.env.QWEN_SECONDARY_MODEL ?? QWEN_SECONDARY_MODEL;
  private client?: OpenAI;

  isConfigured() {
    return Boolean(process.env.QWEN_API_KEY);
  }

  async chat(messages: QwenMessage[], options: { temperature?: number; model?: string; maxTokens?: number } = {}): Promise<QwenChatResult> {
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
    options: { temperature?: number; maxTokens?: number }
  ): Promise<QwenChatResult> {
    const response = await this.getClient().chat.completions.create({
      model,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
      messages: messages as ChatCompletionMessageParam[]
    });

    return {
      content: response.choices[0]?.message?.content ?? "",
      model: response.model ?? model,
      usage: response.usage
    };
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
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : undefined;
    return status !== 401 && status !== 403;
  }
}
