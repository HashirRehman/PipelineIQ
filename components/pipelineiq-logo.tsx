/**
 * Shared PipelineIQ brand mark + wordmark. Extracted from the Figma
 * sidebar so the login screen and the app shell can't drift apart.
 */

export function PipelineIQMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="30" height="30" rx="7" fill="#06b6d4" />
      <path
        d="M7 7.5h8.2c2.9 0 5.3 2.2 5.3 5s-2.4 5-5.3 5H11v5H7V7.5z"
        fill="white"
      />
      <circle cx="22" cy="22" r="3.5" fill="white" opacity="0.85" />
      <rect
        x="11"
        y="10.5"
        width="3.8"
        height="4"
        rx="0.8"
        fill="rgba(6,182,212,0.6)"
      />
    </svg>
  );
}

export function PipelineIQLogo({
  size = "sm",
}: {
  size?: "sm" | "lg";
}) {
  const isLarge = size === "lg";

  return (
    <div className="flex items-center gap-2.5">
      <PipelineIQMark size={isLarge ? 44 : 30} />
      <div>
        <div
          className={
            isLarge
              ? "font-mono text-2xl font-bold tracking-tight text-[var(--fg)]"
              : "font-mono text-sm font-bold tracking-tight text-[var(--sidebar-fg)]"
          }
        >
          PipeLine<span className="text-[var(--primary)]">IQ</span>
        </div>
        <div
          className={
            isLarge
              ? "font-mono text-xs uppercase tracking-[0.35em] text-[var(--muted-fg)]"
              : "font-mono text-[10px] uppercase tracking-wider text-[var(--muted-fg)]"
          }
        >
          Recurso Labs
        </div>
      </div>
    </div>
  );
}
