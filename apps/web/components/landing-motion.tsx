"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function LandingMotion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-motion]");
      gsap.from(items, {
        autoAlpha: 0,
        y: 28,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.08
      });
    },
    { scope: rootRef }
  );

  return <div ref={rootRef}>{children}</div>;
}
