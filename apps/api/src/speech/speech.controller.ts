import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import type { SpeechCapabilities, SpeechToTextRequest, TextToSpeechRequest } from "@fintwin/shared";
import { GeminiSpeechService } from "../ai/gemini-speech.service.js";
import { GeminiTtsService } from "../ai/gemini-tts.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";

@Controller("speech")
@UseGuards(JwtAuthGuard)
export class SpeechController {
  constructor(
    @Inject(GeminiTtsService) private readonly geminiTts: GeminiTtsService,
    @Inject(GeminiSpeechService) private readonly geminiSpeech: GeminiSpeechService
  ) {}

  @Get("capabilities")
  capabilities(): SpeechCapabilities {
    const sttAvailable = this.geminiSpeech.isConfigured();
    const ttsAvailable = this.geminiTts.isConfigured();
    return {
      stt: {
        available: sttAvailable,
        ...(sttAvailable ? {} : { reason: "GEMINI_API_KEY tanımlı olmadığı için konuşarak gönderme kapalı." })
      },
      tts: {
        available: ttsAvailable,
        ...(ttsAvailable ? {} : { reason: "Gemini TTS API anahtarı tanımlı olmadığı için cevap seslendirme kapalı." })
      }
    };
  }

  @Post("tts")
  @RateLimit({ limit: 20, windowMs: 60_000, scope: "credential" })
  synthesize(@Body() body: TextToSpeechRequest) {
    return this.geminiTts.synthesize(body);
  }

  @Post("stt")
  @RateLimit({ limit: 12, windowMs: 60_000, scope: "credential" })
  transcribe(@Body() body: SpeechToTextRequest) {
    return this.geminiSpeech.transcribe(body);
  }
}
