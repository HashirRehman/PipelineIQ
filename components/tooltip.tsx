"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dependency-free tooltip. Anchored above/below the trigger (measured via
 * getBoundingClientRect at open time) using position:fixed, so it escapes
 * overflow-hidden cards. Hover + keyboard focus both open it; it closes on
 * scroll/resize so stale coordinates never linger. No animation library —
 * the pop is a single tiny CSS transition so prefers-reduced-motion is
 * honored by the global reduced-motion rule.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
  wrapperClassName,
}: {
  content: ReactNode;
  children: ReactNode;
  /** Preferred side; flips when the trigger is too close to the viewport edge. */
  side?: "top" | "bottom";
  className?: string;
  /** Classes for the wrapping span (layout control). */
  wrapperClassName?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; place: "top" | "bottom" } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Reposition after a render so the bubble measures its own size — cheap
  // for a handful of simultaneous tooltips.
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const open = () => {
    const el = wrapRef.current;
    if (!el || !content) return;
    const r = el.getBoundingClientRect();
    const place = side === "top" && r.top < 150 ? "bottom" : side;
    setPos({
      top: place === "top" ? r.top - 8 : r.bottom + 8,
      left: r.left + r.width / 2,
      place,
    });
  };
  const close = () => setPos(null);

  return (
    <span
      ref={wrapRef}
      className={cn("block", wrapperClassName)}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocusCapture={open}
      onBlurCapture={close}
    >
      {children}
      {pos ? (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none fixed z-50 max-w-[280px] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-sm animate-in fade-in-0 zoom-in-95",
            className,
          )}
          style={{
            top: pos.top,
            left: pos.left,
            transform: pos.place === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          }}
        >
          {content}
        </div>
      ) : null}
    </span>
  );
}
