"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Mic, Send, Volume2, X } from "lucide-react";
import type { ActionItem, AgentConversationSummary, AgentResponse, SpeechCapabilities } from "@fintwin/shared";
import { approveAction, dismissAction, getAgentConversations, getSpeechCapabilities, postAgentMessage, synthesizeSpeech, transcribeSpeech } from "../lib/api";

type AgentConsoleProps = {
  compact?: boolean;
};

export function AgentConsole({ compact = false }: AgentConsoleProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Array<{ role: "user" | "agent"; text: string }>>([]);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speechCapabilities, setSpeechCapabilities] = useState<SpeechCapabilities | null>(null);
  const [history, setHistory] = useState<AgentConversationSummary[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sttUnavailable = speechCapabilities?.stt.available === false;
  const ttsUnavailable = speechCapabilities?.tts.available === false;
  const visibleActionProposals =
    response?.actionProposals?.filter((proposal) => !response.suggestedActions.some((action) => action.type === proposal.type && action.title === proposal.title)) ?? [];

  useEffect(() => {
    let active = true;
    void getAgentConversations({ limit: 6 })
      .then((items) => {
        if (active) setHistory(items);
      })
      .catch(() => {
        if (active) setHistory([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (compact || response || turns.length || !history.length) return;
    const latest = history[0];
    if (!latest) return;
    setMessage("");
    setTurns([
      { role: "user", text: latest.message },
      { role: "agent", text: latest.answer }
    ]);
    setResponse(conversationSummaryToResponse(latest));
  }, [compact, history, response, turns.length]);

  async function sendText(text = message) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setExpandedStepIndex(null);
    setResponse(null);
    setMessage("");
    setTurns((current) => [...current, { role: "user", text: trimmed }]);
    try {
      const next = await postAgentMessage(trimmed);
      setResponse(next);
      setTurns((current) => [...current, { role: "agent", text: next.answer }]);
      void getAgentConversations({ limit: 6 }).then(setHistory).catch(() => setHistory([]));
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
    const capabilities = speechCapabilities ?? (await loadSpeechCapabilities());
    if (capabilities.stt.available === false) {
      setError(capabilities.stt.reason ?? "Konuşarak gönderme şu an kullanılamıyor.");
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
      await sendText(transcript.text);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Ses metne çevrilemedi.";
      setSpeechCapabilities((current) => (current ? { ...current, stt: { available: false, reason: message } } : current));
      setError(message);
    } finally {
      setVoiceBusy(false);
    }
  }

  async function speakAnswer() {
    if (!response?.answer) return;
    const capabilities = speechCapabilities ?? (await loadSpeechCapabilities());
    if (capabilities.tts.available === false) {
      setError(capabilities.tts.reason ?? "Cevap seslendirme şu an kullanılamıyor.");
      return;
    }
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
      const message = caught instanceof Error ? caught.message : "Cevap seslendirilemedi.";
      setSpeaking(false);
      setSpeechCapabilities((current) => (current ? { ...current, tts: { available: false, reason: message } } : current));
      setError(message);
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

  async function loadSpeechCapabilities() {
    try {
      const capabilities = await getSpeechCapabilities();
      setSpeechCapabilities(capabilities);
      return capabilities;
    } catch {
      const unavailable: SpeechCapabilities = {
        stt: { available: false, reason: "Konuşarak gönderme durumu alınamadı." },
        tts: { available: false, reason: "Cevap seslendirme durumu alınamadı." }
      };
      setSpeechCapabilities(unavailable);
      return unavailable;
    }
  }

  return (
    <div className={compact ? "agent-console compact-agent-console" : "agent-console"}>
      {recording || voiceBusy ? (
        <div className="voice-status">
          <span className={recording ? "recording-dot" : ""} />
          {recording ? "Dinliyorum. Bitirmek için mikrofon ikonuna tekrar bas." : "Ses metne çevriliyor..."}
        </div>
      ) : null}
      {speechCapabilities && (sttUnavailable || ttsUnavailable) ? (
        <div className="voice-status voice-status-muted">
          <span>{[speechCapabilities.stt.reason, speechCapabilities.tts.reason].filter(Boolean).join(" ")}</span>
        </div>
      ) : null}
      {error ? <p className="form-message danger">{error}</p> : null}

      {turns.length ? (
        <div className="chat-turns agent-chat-thread">
          {turns.slice(-8).map((turn, index, visibleTurns) => {
            const isLatestAgent = turn.role === "agent" && index === visibleTurns.length - 1 && Boolean(response);
            const bubble = (
              <div className={`chat-bubble ${turn.role}`}>
                {turn.role === "agent" ? <span className="agent-pet agent-message-pet" aria-hidden="true" /> : null}
                <span>{turn.text}</span>
                {turn.role === "agent" && response?.answer === turn.text ? (
                  <button
                    className="ghost-icon message-voice-button"
                    onClick={() => void speakAnswer()}
                    disabled={speaking || ttsUnavailable}
                    type="button"
                    title={ttsUnavailable ? speechCapabilities?.tts.reason ?? "Cevap seslendirme kullanılamıyor" : "Cevabı sesli oku"}
                  >
                    <Volume2 size={15} />
                  </button>
                ) : null}
              </div>
            );

            if (isLatestAgent) {
              return (
                <div className="agent-turn-with-trace" key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`}>
                  <AgentTraceChain response={response!} expandedStepIndex={expandedStepIndex} setExpandedStepIndex={setExpandedStepIndex} />
                  {bubble}
                </div>
              );
            }

            return (
              <div className={`chat-turn ${turn.role}`} key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`}>
                {bubble}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state chat-empty-state">Money Crab'a bir harcama, hedef, portföy ya da bütçe kararı sor.</div>
      )}

      {response && (visibleActionProposals.length || response.suggestedActions.length) ? (
        <div className="agent-followups">
          {visibleActionProposals.length ? (
            <div className="agent-proposals">
              <div className="section-title">
                <span>Onay gerektiren öneriler</span>
                <strong>{visibleActionProposals.length}</strong>
              </div>
              {visibleActionProposals.map((proposal) => (
                <article className="agent-proposal" key={proposal.id}>
                  <span className="chip accent">{proposal.requiresApproval ? "Onay gerekli" : "Bilgi"}</span>
                  <div>
                    <strong>{proposal.title}</strong>
                    <p>{proposal.reason}</p>
                    <small>{proposalPayloadText(proposal.payload)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
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
      ) : null}

      <div className="agent-input">
        <span className="agent-pet agent-pet-input" aria-hidden="true" />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendText();
            }
          }}
          placeholder="Finansal ikizine bir karar, harcama veya portföy sorusu sor."
        />
        <div className="agent-button-stack">
          <button className="icon-button" onClick={() => void sendText()} disabled={loading || voiceBusy} title="Agent'a gönder" type="button">
            <Send size={18} />
          </button>
          <button
            className={recording ? "icon-button voice-button recording" : "icon-button voice-button"}
            onClick={() => void toggleRecording()}
            disabled={voiceBusy || loading || sttUnavailable}
            title={sttUnavailable ? speechCapabilities?.stt.reason ?? "Konuşarak gönderme kullanılamıyor" : recording ? "Kaydı bitir ve gönder" : "Konuşarak gönder"}
            type="button"
          >
            <Mic size={18} />
          </button>
        </div>
      </div>

      {!compact ? (
        <details className="agent-history compact-history">
          <summary>
            <span>Sohbet geçmişi</span>
            <strong>{history.length}</strong>
          </summary>
          {history.length ? (
            history.slice(0, 6).map((item) => (
              <button
                className="agent-history-row"
                key={item.id}
                onClick={() => {
                  setMessage("");
                  setExpandedStepIndex(null);
                  setTurns([
                    { role: "user", text: item.message },
                    { role: "agent", text: item.answer }
                  ]);
                  setResponse(conversationSummaryToResponse(item));
                }}
                type="button"
              >
                <strong>{item.message}</strong>
                <span>{new Date(item.createdAt).toLocaleString("tr-TR")}</span>
              </button>
            ))
          ) : (
            <div className="empty-state compact-empty-state">İlk sohbetten sonra geçmiş burada görünür.</div>
          )}
        </details>
      ) : null}
    </div>
  );
}

function AgentTraceChain({
  response,
  expandedStepIndex,
  setExpandedStepIndex
}: {
  response: AgentResponse;
  expandedStepIndex: number | null;
  setExpandedStepIndex: (index: number | null) => void;
}) {
  const steps = response.agenticPlan?.length
    ? response.agenticPlan
    : response.routedAgents.map((agent) => ({
        agent,
        purpose: "Kullanıcı sorusu için finansal bağlam okundu.",
        status: "completed" as const,
        output: ""
      }));
  if (!steps.length) return null;

  return (
    <div className={expandedStepIndex !== null ? "agent-trace-chain is-open" : "agent-trace-chain"} aria-label="Ajan çalışma sırası">
      <button className="agent-trace-summary" onClick={() => setExpandedStepIndex(expandedStepIndex === -1 ? null : -1)} type="button">
        <span className="agent-node-dot completed" />
        <strong>Ajan akışı</strong>
        <small>{steps.length} adım</small>
      </button>
      <div className="agent-node-list">
        {steps.map((step, index) => (
          <div className="agent-node-line" key={`${step.agent}-${index}`}>
            <span className={`agent-node-dot ${step.status}`} />
            <span>{agentStepDescription(step)}</span>
          </div>
        ))}
      </div>
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

function agentStepStatus(status: NonNullable<AgentResponse["agenticPlan"]>[number]["status"]) {
  if (status === "completed") return "Tamam";
  if (status === "blocked") return "Blok";
  return "Atlandı";
}

function agentStepLabel(agent: string) {
  const normalized = agent.toLowerCase();
  if (normalized.includes("supervisor")) return "Yönlendirme";
  if (normalized.includes("twin")) return "Finansal ikiz";
  if (normalized.includes("simulation")) return "Senaryo kontrolü";
  if (normalized.includes("risk")) return "Risk kontrolü";
  if (normalized.includes("education")) return "Açıklama";
  if (normalized.includes("llm")) return "Yanıt üretimi";
  if (normalized.includes("action")) return "Aksiyon kontrolü";
  if (normalized.includes("memory")) return "Sohbet hafızası";
  if (normalized.includes("context")) return "Bağlam özeti";
  return agent.replace(" Agent", "");
}

function agentStepDescription(step: NonNullable<AgentResponse["agenticPlan"]>[number]) {
  const explicit = (step.output || step.purpose || "").trim();
  if (explicit && isUserFacingAgentStepText(explicit)) return explicit;
  const normalized = step.agent.toLowerCase();
  if (normalized.includes("supervisor")) return "Soru doğru finansal akışa yönlendirildi.";
  if (normalized.includes("twin")) return "Kullanıcının finansal özeti okundu.";
  if (normalized.includes("simulation")) return "Senaryo etkisi kontrol edildi.";
  if (normalized.includes("risk")) return "Risk ve bütçe sınırları kontrol edildi.";
  if (normalized.includes("education")) return "Yanıt kullanıcı diline sadeleştirildi.";
  if (normalized.includes("llm")) return "Son cevap üretildi.";
  if (normalized.includes("action")) return "Onay gerektiren aksiyonlar kontrol edildi.";
  return `${agentStepLabel(step.agent)} tamamlandı.`;
}

function isUserFacingAgentStepText(text: string) {
  return !/(maxTokens|model|token|karakter bağlam|geçmiş cevap|sohbet geçmiş|mevcut kayıt|otomatik kayıt|qwen|gemini)/i.test(text);
}

function conversationSummaryToResponse(item: AgentConversationSummary): AgentResponse {
  return {
    answer: item.answer,
    confidence: 0.85,
    routedAgents: ["Agent Memory", "Context Summary"],
    evidence: item.evidence,
    assumptions: [],
    suggestedActions: [],
    agenticPlan: [
      {
        agent: "Supervisor Agent",
        purpose: "Sohbet bağlamı incelendi.",
        status: "completed",
        output: "Sohbet bağlamı incelendi."
      },
      {
        agent: "Twin Agent",
        purpose: "Finansal özet kontrol edildi.",
        status: "completed",
        output: "Finansal özet kontrol edildi."
      },
      {
        agent: "LLM Agent",
        purpose: "Yanıt hazırlandı.",
        status: "skipped",
        output: "Yanıt hazırlandı."
      }
    ],
    quality: {
      grounded: true,
      contextChars: item.message.length + item.answer.length,
      warnings: []
    }
  };
}

function proposalPayloadText(payload: Record<string, unknown>) {
  const visible = Object.entries(payload)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return visible.length ? visible.join(" · ") : "Öneri detayları yapılandırılmış olarak hazır.";
}
