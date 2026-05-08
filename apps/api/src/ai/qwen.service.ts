import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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
  private readonly baseURL = process.env.QWEN_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  private readonly textModel = process.env.QWEN_TEXT_MODEL ?? "qwen-plus";
  private client?: OpenAI;

  isConfigured() {
    return Boolean(process.env.QWEN_API_KEY);
  }

  async chat(messages: QwenMessage[], options: { temperature?: number; model?: string } = {}): Promise<QwenChatResult> {
    if (!this.isConfigured()) {
      throw new Error("QWEN_API_KEY is not configured.");
    }

    const model = options.model ?? this.textModel;
    const response = await this.getClient().chat.completions.create({
      model,
      temperature: options.temperature ?? 0.2,
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
}
