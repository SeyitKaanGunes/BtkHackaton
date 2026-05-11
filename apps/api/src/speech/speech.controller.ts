import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import type { SpeechToTextRequest, TextToSpeechRequest } from "@fintwin/shared";
import { GeminiTtsService } from "../ai/gemini-tts.service.js";
import { OpenAiSpeechService } from "../ai/openai-speech.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

@Controller("speech")
@UseGuards(JwtAuthGuard)
export class SpeechController {
  constructor(
    @Inject(GeminiTtsService) private readonly geminiTts: GeminiTtsService,
    @Inject(OpenAiSpeechService) private readonly openAiSpeech: OpenAiSpeechService
  ) {}

  @Post("tts")
  synthesize(@Body() body: TextToSpeechRequest) {
    return this.geminiTts.synthesize(body);
  }

  @Post("stt")
  transcribe(@Body() body: SpeechToTextRequest) {
    return this.openAiSpeech.transcribe(body);
  }
}
