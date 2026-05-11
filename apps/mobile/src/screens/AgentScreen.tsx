import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import * as RNFS from "react-native-fs";
import Sound, { AVEncoderAudioQualityIOSType, type AudioSet, type RecordBackType } from "react-native-nitro-sound";
import { Bot, Mic, Send, Shield, Sparkles, Volume2 } from "lucide-react-native";
import type { AgentResponse } from "@fintwin/shared";
import { sendAgentMessage, transcribeSpeech } from "../api";
import { speakWithGemini } from "../audio";
import { Btn, Card, Chip, Eyebrow, ScreenHeader, SectionTitle } from "../ui";
import { radius, space, usePalette } from "../theme";

type BusyMode = "send" | "record" | "stt" | "tts";
type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const RECORDING_AUDIO_SET: AudioSet = {
  AudioChannels: 1,
  AudioSamplingRate: 16000,
  AudioEncodingBitRate: 64000,
  AVFormatIDKeyIOS: "aac",
  AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
  AVModeIOS: "measurement"
};

const SUGGESTIONS = [
  "Portföyümde bugün en büyük risk nerede?",
  "Ay sonu paramı nasıl korurum?",
  "Bu ay tasarrufumu nasıl artırırım?",
  "Bugün 10000 TL teknoloji harcaması yaparsam ne olur?"
];

export function AgentScreen() {
  const p = usePalette();
  const [message, setMessage] = useState(SUGGESTIONS[0]);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [busyMode, setBusyMode] = useState<BusyMode | null>(null);
  const [recordMillis, setRecordMillis] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loading = busyMode !== null;
  const recording = busyMode === "record";

  async function ask() {
    if (loading) return;
    setBusyMode("send");
    try {
      await sendText(message);
    } finally {
      setBusyMode(null);
    }
  }

  async function toggleRecording() {
    if (recording) {
      await stopRecordingAndSend();
      return;
    }
    if (loading) return;
    await startRecording();
  }

  async function startRecording() {
    setError(null);
    setRecordMillis(0);
    setBusyMode("record");
    try {
      Sound.setSubscriptionDuration(0.1);
      Sound.addRecordBackListener((event: RecordBackType) => setRecordMillis(event.currentPosition));
      await Sound.startRecorder(undefined, RECORDING_AUDIO_SET, true);
    } catch (nextError) {
      Sound.removeRecordBackListener();
      setBusyMode(null);
      setError(formatError(nextError, "Mikrofon kaydı başlatılamadı."));
    }
  }

  async function stopRecordingAndSend() {
    setBusyMode("stt");
    try {
      const recordedUri = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      const localPath = normalizeFileUri(recordedUri);
      const audioBase64 = await RNFS.readFile(localPath, "base64");
      RNFS.unlink(localPath).catch(() => undefined);
      const transcription = await transcribeSpeech({
        audioBase64,
        mimeType: "audio/m4a",
        fileName: "voice.m4a",
        language: "tr"
      });
      if (!transcription.text) {
        setError("Ses dosyasından metin çıkarılamadı.");
        return;
      }
      setBusyMode("send");
      await sendText(transcription.text);
    } catch (nextError) {
      setError(formatError(nextError, "Mikrofon kaydı yazıya çevrilemedi."));
    } finally {
      Sound.removeRecordBackListener();
      setRecordMillis(0);
      setBusyMode(null);
    }
  }

  async function sendText(rawText: string) {
    const text = rawText.trim();
    if (!text) {
      setError("Önce bir soru yaz.");
      return;
    }

    setError(null);
    setMessage("");
    setTurns((items) => [...items, { id: `user-${Date.now()}`, role: "user", text }]);
    try {
      const next = await sendAgentMessage(text);
      setResponse(next);
      setTurns((items) => [...items, { id: `assistant-${Date.now()}`, role: "assistant", text: next.answer }]);
      void speak(next.answer);
    } catch (nextError) {
      setError(formatError(nextError, "Agent cevabı alınamadı."));
    }
  }

  async function speak(text: string) {
    setBusyMode((current) => current ?? "tts");
    try {
      await speakWithGemini(text);
    } catch (nextError) {
      setError(formatError(nextError, "Gemini TTS ses üretemedi."));
    } finally {
      setBusyMode((current) => (current === "tts" ? null : current));
    }
  }

  return (
    <View style={{ gap: space[4] }}>
      <ScreenHeader
        eyebrow="Finans Asistanı"
        title="Agent ile konuş."
        subtitle="Yazılı soru, OpenAI STT ile ses dosyası okuma ve Gemini TTS ile sesli cevap iOS tarafında hazır."
      />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 99, backgroundColor: p.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Bot color={p.accent} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.ink, fontWeight: "900", fontSize: 14 }}>Fintwin Agent</Text>
            <Text style={{ color: p.muted, fontSize: 12 }}>LLM Chat · OpenAI STT · Gemini TTS</Text>
          </View>
          <Chip label={busyLabel(busyMode)} tone={loading ? "accent" : "good"} small />
        </View>

        <View style={{ gap: 10 }}>
          {turns.length ? (
            turns.map((turn) => <ChatBubble key={turn.id} turn={turn} onSpeak={turn.role === "assistant" ? () => void speak(turn.text) : undefined} />)
          ) : (
            <View style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: 12, backgroundColor: p.surface2, gap: 6 }}>
              <Text style={{ color: p.ink, fontWeight: "900", fontSize: 14 }}>Ne yaptırmak istiyorsan buradan söyle.</Text>
              <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>
                Agent kayıtlı finans verilerini okuyup cevaplar; cevapları Gemini sesiyle okuyabilir, seçtiğin ses dosyasını OpenAI ile metne çevirebilir.
              </Text>
            </View>
          )}
        </View>

        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Portföyümü yorumla, bütçemi toparla, bu kararı simüle et..."
          placeholderTextColor={p.muted}
          multiline
          style={{
            minHeight: 84,
            borderColor: p.line,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 12,
            color: p.ink,
            fontSize: 14,
            lineHeight: 20,
            backgroundColor: p.surface2,
            textAlignVertical: "top"
          }}
        />
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1.35 }}>
            <Btn label={busyMode === "send" ? "Gönderiliyor" : "Gönder"} onPress={ask} variant="primary" disabled={loading} icon={<Send color={p.surface} size={14} />} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn
              label={voiceButtonLabel(busyMode, recordMillis)}
              onPress={() => void toggleRecording()}
              variant="secondary"
              disabled={loading && !recording}
              icon={<Mic color={recording ? p.danger : p.ink} size={14} />}
            />
          </View>
        </View>
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={p.accent} />
            <Text style={{ color: p.muted, fontSize: 12 }}>{busyDescription(busyMode)}</Text>
          </View>
        ) : null}
        {error ? <Text style={{ color: p.danger, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>{error}</Text> : null}
      </Card>

      <View style={{ gap: 8 }}>
        <Eyebrow tone="muted">Önerilen sorular</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setMessage(s)}
              android_ripple={{ color: p.line }}
              style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: p.surface }}
            >
              <Text style={{ color: p.ink, fontSize: 12, fontWeight: "700" }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {response ? (
        <View style={{ gap: space[3] }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <SectionTitle>Cevap özeti</SectionTitle>
              <Pressable onPress={() => void speak(response.answer)} android_ripple={{ color: p.line }} style={{ flexDirection: "row", gap: 6, alignItems: "center", padding: 6 }}>
                <Volume2 color={p.accent} size={16} />
                <Text style={{ color: p.accent, fontSize: 12, fontWeight: "800" }}>Gemini TTS</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Shield color={p.accent} size={14} />
                <Text style={{ color: p.muted, fontSize: 12 }}>Güven skoru</Text>
              </View>
              <Text style={{ color: p.accent, fontWeight: "900", fontSize: 14 }}>%{Math.round(response.confidence * 100)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {response.routedAgents.map((a) => (
                <Chip key={a} label={a} tone="accent" small />
              ))}
            </View>
          </Card>

          {response.evidence.length ? (
            <Card>
              <SectionTitle>Kanıtlar</SectionTitle>
              {response.evidence.map((e, i) => (
                <View key={`${e.label}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopColor: p.line, borderTopWidth: i === 0 ? 0 : 1 }}>
                  <Text style={{ color: p.muted, fontSize: 13, flex: 1, paddingRight: 10 }}>{e.label}</Text>
                  <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{e.value}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {response.suggestedActions.length ? (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <SectionTitle>Önerilen aksiyonlar</SectionTitle>
                <Sparkles color={p.muted} size={14} />
              </View>
              {response.suggestedActions.map((a, i) => (
                <View
                  key={`${a.title ?? i}-${i}`}
                  style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: 6, backgroundColor: p.surface2 }}
                >
                  <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }}>{a.title ?? `Aksiyon ${i + 1}`}</Text>
                  {a.description ? <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>{a.description}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Btn label="Onayla" onPress={() => undefined} variant="primary" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn label="Reddet" onPress={() => undefined} variant="ghost" />
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: space[5] }} />
    </View>
  );
}

function ChatBubble({ turn, onSpeak }: { turn: ChatTurn; onSpeak?: () => void }) {
  const p = usePalette();
  const isUser = turn.role === "user";
  return (
    <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "92%",
          borderRadius: radius.md,
          borderTopRightRadius: isUser ? 4 : radius.md,
          borderTopLeftRadius: isUser ? radius.md : 4,
          padding: 12,
          gap: 8,
          backgroundColor: isUser ? p.accent : p.surface2
        }}
      >
        <Text style={{ color: isUser ? p.onAccent : p.ink, fontSize: 13.5, lineHeight: 20 }}>{turn.text}</Text>
        {onSpeak ? (
          <Pressable onPress={onSpeak} style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" }}>
            <Volume2 color={p.accent} size={14} />
            <Text style={{ color: p.accent, fontSize: 11, fontWeight: "800" }}>Sesli oku</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function busyLabel(mode: BusyMode | null) {
  if (mode === "record") return "Kayıt";
  if (mode === "stt") return "STT";
  if (mode === "tts") return "TTS";
  if (mode === "send") return "Düşünüyor";
  return "Hazır";
}

function busyDescription(mode: BusyMode | null) {
  if (mode === "record") return "Mikrofon açık. Bitirince tekrar mikrofon butonuna bas.";
  if (mode === "stt") return "OpenAI STT ses dosyasını metne çeviriyor.";
  if (mode === "tts") return "Gemini TTS cevabı seslendiriyor.";
  return "Agent finans verilerini okuyup cevap hazırlıyor.";
}

function voiceButtonLabel(mode: BusyMode | null, recordMillis: number) {
  if (mode === "record") return `Bitir ${formatRecordTime(recordMillis)}`;
  if (mode === "stt") return "Dinleniyor";
  return "Konuş";
}

function formatRecordTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = `${seconds % 60}`.padStart(2, "0");
  return `${minutes}:${rest}`;
}

function normalizeFileUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}
