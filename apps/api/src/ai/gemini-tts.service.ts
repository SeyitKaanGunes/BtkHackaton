import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { TextToSpeechResult } from "@fintwin/shared";

const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const GEMINI_TTS_VOICE = "Kore";
const GEMINI_TTS_SAMPLE_RATE = 24000;
const GEMINI_TTS_CHANNELS = 1;
const GEMINI_TTS_BITS_PER_SAMPLE = 16;

type GeminiInlineData = {
  data?: string;
  mimeType?: string;
  mime_type?: string;
};

type GeminiTtsResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: GeminiInlineData;
        inline_data?: GeminiInlineData;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class GeminiTtsService {
  isConfigured() {
    return Boolean(this.apiKey());
  }

  async synthesize(input: { text?: string; voiceName?: string }): Promise<TextToSpeechResult> {
    const text = input.text?.trim();
    if (!text) throw new BadRequestException("text is required.");

    const key = this.apiKey();
    if (!key) {
      throw new ServiceUnavailableException("Gemini TTS için GEMINI_API_KEY, GOOGLE_API_KEY veya GOOGLE_GENERATIVE_AI_API_KEY tanımlı değil.");
    }

    const model = process.env.GEMINI_TTS_MODEL?.trim() || GEMINI_TTS_MODEL;
    const voiceName = input.voiceName?.trim() || process.env.GEMINI_TTS_VOICE?.trim() || GEMINI_TTS_VOICE;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Türkçe, sakin ve güven veren bir finans asistanı sesiyle oku:\n${text}`
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          }
        }
      })
    });

    const payload = (await response.json().catch(() => ({}))) as GeminiTtsResponse;
    if (!response.ok) {
      throw new ServiceUnavailableException(payload.error?.message ?? "Gemini TTS ses üretemedi.");
    }

    const inlineData = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data || part.inline_data?.data);
    const audio = inlineData?.inlineData ?? inlineData?.inline_data;
    if (!audio?.data) throw new ServiceUnavailableException("Gemini TTS cevabında audio verisi bulunamadı.");

    const mimeType = audio.mimeType ?? audio.mime_type ?? `audio/L16;codec=pcm;rate=${GEMINI_TTS_SAMPLE_RATE}`;
    if (isPcmMimeType(mimeType)) {
      return {
        audioBase64: wrapPcmAsWav(audio.data, sampleRateFromMime(mimeType)),
        mimeType: "audio/wav",
        model,
        voiceName
      };
    }

    return {
      audioBase64: audio.data,
      mimeType,
      model,
      voiceName
    };
  }

  private apiKey() {
    return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  }
}

function isPcmMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  return normalized.includes("audio/l16") || normalized.includes("audio/pcm");
}

function sampleRateFromMime(mimeType: string) {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : GEMINI_TTS_SAMPLE_RATE;
}

function wrapPcmAsWav(pcmBase64: string, sampleRate: number) {
  const pcm = Buffer.from(pcmBase64, "base64");
  const byteRate = sampleRate * GEMINI_TTS_CHANNELS * (GEMINI_TTS_BITS_PER_SAMPLE / 8);
  const blockAlign = GEMINI_TTS_CHANNELS * (GEMINI_TTS_BITS_PER_SAMPLE / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(GEMINI_TTS_CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(GEMINI_TTS_BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]).toString("base64");
}
