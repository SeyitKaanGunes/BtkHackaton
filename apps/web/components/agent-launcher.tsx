"use client";

import { PointerEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AgentConsole } from "./agent-console";

const bubbleSize = 64;
const edgePadding = 16;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

export function AgentLauncher({
  ariaLabel = "Agent sayfasına git",
  href = "/agent",
  mode = "modal"
}: {
  ariaLabel?: string;
  href?: string;
  mode?: "modal" | "link";
}) {
  const router = useRouter();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  function currentPosition() {
    if (position) return position;
    if (typeof window === "undefined") return { x: 0, y: 0 };
    return {
      x: window.innerWidth - bubbleSize - 22,
      y: window.innerHeight - bubbleSize - 22
    };
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const current = currentPosition();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    setPosition({
      x: clamp(drag.originX + dx, edgePadding, window.innerWidth - bubbleSize - edgePadding),
      y: clamp(drag.originY + dy, edgePadding, window.innerHeight - bubbleSize - edgePadding)
    });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved) {
      if (mode === "link") router.push(href);
      else setOpen(true);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const style = position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined;

  return (
    <>
      <button
        className="agent-fab"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        aria-label={ariaLabel}
        type="button"
      >
        <span className="agent-pet agent-pet-fab" aria-hidden="true" />
        <span className="agent-fab-label">İkiz</span>
      </button>
      {open ? (
        <div className="agent-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="agent-modal-sheet" role="dialog" aria-modal="true" aria-label="Finansal ikiz" onMouseDown={(event) => event.stopPropagation()}>
            <div className="agent-modal-header">
              <div>
                <span className="eyebrow">Finansal ikiz</span>
                <strong>Agent</strong>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setOpen(false)} aria-label="Agent panelini kapat">
                <X size={18} />
              </button>
            </div>
            <AgentConsole compact />
          </section>
        </div>
      ) : null}
    </>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
