"use client";

import { PointerEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export function AgentLauncher() {
  const router = useRouter();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
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
    if (drag && !drag.moved) router.push("/agent");
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
        aria-label="Agent sayfasına git"
        type="button"
      >
        <span className="agent-pet agent-pet-fab" aria-hidden="true" />
        <span className="agent-fab-label">İkiz</span>
      </button>
    </>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
