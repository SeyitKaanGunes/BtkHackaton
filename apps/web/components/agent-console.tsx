"use client";

import { useState } from "react";
import { Bot, CheckCircle2, Send } from "lucide-react";
import type { AgentResponse } from "@finshadow/shared";
import { postAgentMessage } from "../lib/api";

export function AgentConsole() {
  const [message, setMessage] = useState("Kampanya döneminde 10000 TL harcarsam ay sonu ne olur?");
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const next = await postAgentMessage(message);
    setResponse(next);
    setLoading(false);
  }

  return (
    <div className="agent-console">
      <div className="agent-input">
        <Bot size={20} />
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
        <button className="icon-button" onClick={submit} disabled={loading} title="Agent'a gönder">
          <Send size={18} />
        </button>
      </div>
      {response ? (
        <div className="agent-result">
          <p>{response.answer}</p>
          <div className="agent-meta">
            <span>Güven skoru: {Math.round(response.confidence * 100)}%</span>
            <span>{response.routedAgents.join(" -> ")}</span>
          </div>
          <div className="evidence-list">
            {response.evidence.map((item) => (
              <div className="evidence-item" key={`${item.label}-${item.value}`}>
                <CheckCircle2 size={16} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">Soruyu gönder; Explainable AI paneli burada açılır.</div>
      )}
    </div>
  );
}
