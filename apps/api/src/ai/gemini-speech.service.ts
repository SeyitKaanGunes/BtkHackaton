import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { SpeechToTextResult } from "@fintwin/shared";

const GEMINI_STT_MODEL = "gemini-2.5-flash";
const GEMINI_MAX_AUDIO_BYTES = 20 * 1024 * 1024;

type GeminiTextPart = { text?: string };
type GeminiSttResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class GeminiSpeechService {
  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  async transcribe(input: { audioBase64?: string; mimeType?: string; fileName?: string; language?: string }): Promise<SpeechToTextResult> {
    const audioBase64 = input.audioBase64?.trim();
    if (!audioBase64) throw new BadRequestException("audioBase64 is required.");
    if (!this.isConfigured()) throw new ServiceUnavailableException("Gemini STT için GEMINI_API_KEY tanımlı değil.");

    const audio = Buffer.from(audioBase64, "base64");
    if (audio.length === 0) throw new BadRequestException("audioBase64 is empty.");
    if (audio.length > GEMINI_MAX_AUDIO_BYTES) {
      throw new BadRequestException("Ses dosyası 20 MB sınırını aşıyor.");
    }

    const model = process.env.GEMINI_STT_MODEL?.trim() || GEMINI_STT_MODEL;
    const mimeType = input.mimeType?.trim() || mimeTypeForFileName(input.fileName);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY?.trim() ?? ""
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "Bu ses kaydını Türkçe metne çevir.",
                  "Yalnızca transkripti döndür; açıklama, markdown veya ek yorum yazma.",
                  `Beklenen dil: ${input.language?.trim() || "tr"}.`
                ].join(" ")
              },
              {
                inlineData: {
                  mimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0
        }
      })
    });

    const payload = (await response.json().catch(() => ({}))) as GeminiSttResponse;
    if (!response.ok) {
      throw new ServiceUnavailableException(payload.error?.message ?? `Gemini STT HTTP ${response.status}`);
    }

    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!text) throw new ServiceUnavailableException("Gemini STT transkript döndürmedi.");

    return {
      text,
      model
    };
  }
}

function mimeTypeForFileName(fileName?: string) {
  const lower = fileName?.toLowerCase() ?? "";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".mpga")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  return "audio/m4a";
}
