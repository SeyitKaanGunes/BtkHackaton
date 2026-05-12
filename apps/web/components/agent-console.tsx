"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, CheckCircle2, Mic, Send, Sparkles, Volume2, X } from "lucide-react";
import type { ActionItem, AgentResponse } from "@fintwin/shared";
import { approveAction, dismissAction, postAgentMessage, synthesizeSpeech, transcribeSpeech } from "../lib/api";

type AgentConsoleProps = {
  compact?: boolean;
};

export function AgentConsole({ compact = false }: AgentConsoleProps) {
  const router = useRouter();
  const [message, setMessage] = useState("Kampanya döneminde 10000 TL harcarsam ay sonu ne olur?");
  const [turns, setTurns] = useState<Array<{ role: "user" | "agent"; text: string }>>([]);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function sendText(text = message) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setTurns((current) => [...current, { role: "user", text: trimmed }]);
    try {
      const next = await postAgentMessage(trimmed);
      setResponse(next);
      setTurns((current) => [...current, { role: "agent", text: next.answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent yanıtı alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Tarayıcı mikrofon kaydını desteklemiyor.");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecording(false);
        stopStream();
        const mimeType = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        void transcribeAndSend(blob, mimeType);
      };
      recorder.start();
      setRecording(true);
    } catch (caught) {
      stopStream();
      setRecording(false);
      setError(caught instanceof Error ? caught.message : "Mikrofon başlatılamadı.");
    }
  }

  async function transcribeAndSend(blob: Blob, mimeType: string) {
    if (!blob.size) return;
    setVoiceBusy(true);
    setError(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const transcript = await transcribeSpeech({
        audioBase64,
        mimeType,
        fileName: "agent-voice.webm",
        language: "tr"
      });
      setMessage(transcript.text);
      await sendText(transcript.text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ses metne çevrilemedi.");
    } finally {
      setVoiceBusy(false);
    }
  }

  async function speakAnswer() {
    if (!response?.answer) return;
    setSpeaking(true);
    setError(null);
    try {
      const speech = await synthesizeSpeech(response.answer);
      audioRef.current?.pause();
      const audio = new Audio(`data:${speech.mimeType};base64,${speech.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch (caught) {
      setSpeaking(false);
      setError(caught instanceof Error ? caught.message : "Cevap seslendirilemedi.");
    }
  }

  async function updateSuggestedAction(action: ActionItem, decision: "approve" | "dismiss") {
    setActionPendingId(action.id);
    setError(null);
    try {
      const updated = decision === "approve" ? await approveAction(action.id) : await dismissAction(action.id);
      setResponse((current) =>
        current
          ? {
              ...current,
              suggestedActions: current.suggestedActions.map((item) => (item.id === updated.id ? updated : item))
            }
          : current
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksiyon güncellenemedi.");
    } finally {
      setActionPendingId(null);
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  return (
    <div className={compact ? "agent-console compact-agent-console" : "agent-console"}>
      <div className="agent-input">
        <Bot size={20} />
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Finansal ikizine bir karar, harcama veya portföy sorusu sor." />
        <div className="agent-button-stack">
          <button className="icon-button" onClick={() => void sendText()} disabled={loading || voiceBusy} title="Agent'a gönder" type="button">
            <Send size={18} />
          </button>
          <button
            className={recording ? "icon-button voice-button recording" : "icon-button voice-button"}
            onClick={() => void toggleRecording()}
            disabled={voiceBusy || loading}
            title={recording ? "Kaydı bitir ve gönder" : "Konuşarak gönder"}
            type="button"
          >
            <Mic size={18} />
          </button>
        </div>
      </div>

      {recording || voiceBusy ? (
        <div className="voice-status">
          <span className={recording ? "recording-dot" : ""} />
          {recording ? "Dinliyorum. Bitirmek için mikrofon ikonuna tekrar bas." : "Ses metne çevriliyor..."}
        </div>
      ) : null}
      {error ? <p className="form-message danger">{error}</p> : null}

      {turns.length ? (
        <div className="chat-turns">
          {turns.slice(-4).map((turn, index) => (
            <div className={`chat-bubble ${turn.role}`} key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`}>
              {turn.text}
            </div>
          ))}
        </div>
      ) : null}

      {response ? (
        <div className="agent-result">
          <div className="agent-answer-header">
            <Sparkles size={18} />
            <span>Agent cevabı</span>
            <button className="ghost-icon" onClick={() => void speakAnswer()} disabled={speaking} type="button" title="Cevabı sesli oku">
              <Volume2 size={16} />
            </button>
          </div>
          <p>{response.answer}</p>
          <div className="agent-meta">
            <span>Güven skoru: {Math.round(response.confidence * 100)}%</span>
            <span>{response.routedAgents.join(" -> ")}</span>
          </div>
          {response.assumptions.length ? (
            <div className="agent-assumptions">
              {response.assumptions.map((assumption) => (
                <span key={assumption}>{assumption}</span>
              ))}
            </div>
          ) : null}
          <div className="evidence-list">
            {response.evidence.map((item) => (
              <div className="evidence-item" key={`${item.label}-${item.value}`}>
                <CheckCircle2 size={16} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          {response.suggestedActions.length ? (
            <div className="agent-suggestions">
              <div className="section-title">
                <span>Önerilen aksiyonlar</span>
                <strong>{response.suggestedActions.length}</strong>
              </div>
              {response.suggestedActions.map((action) => (
                <article className="suggested-action" key={action.id}>
                  <div>
                    <span className={`chip ${action.status === "approved" ? "success" : action.status === "dismissed" ? "danger" : "accent"}`}>{actionStatusLabel(action.status)}</span>
                    <strong>{action.title}</strong>
                    <p>{action.description}</p>
                  </div>
                  {action.status === "pending" ? (
                    <div className="suggested-action-buttons">
                      <button className="secondary-button small-button" onClick={() => void updateSuggestedAction(action, "approve")} disabled={Boolean(actionPendingId)} type="button">
                        <Check size={15} />
                        {actionPendingId === action.id ? "İşleniyor" : "Onayla"}
                      </button>
                      <button className="secondary-button small-button danger-button" onClick={() => void updateSuggestedAction(action, "dismiss")} disabled={Boolean(actionPendingId)} type="button">
                        <X size={15} />
                        Reddet
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">Soruyu yaz veya mikrofona bas; finansal ikizin cevabı burada açılır.</div>
      )}
    </div>
  );
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function actionStatusLabel(status: ActionItem["status"]) {
  if (status === "approved") return "Onaylandı";
  if (status === "dismissed") return "Reddedildi";
  return "Bekliyor";
}
