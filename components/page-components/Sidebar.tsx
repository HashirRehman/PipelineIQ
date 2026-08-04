import React, { useState } from "react";
import type { TabId, Profile } from "@/app/page";
import { useTheme } from "next-themes";

const RecursoLogo = () => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 30 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
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

const NAV: {
  id: TabId;
  label: string;
  icon: (a: boolean) => React.ReactElement;
}[] = [
  {
    id: "profiles",
    label: "Profiles",
    icon: (a) => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={a ? 2.5 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    id: "discovery",
    label: "Discovery",
    icon: (a) => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={a ? 2.5 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: "leads",
    label: "Leads",
    icon: (a) => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={a ? 2.5 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    id: "users",
    label: "Users",
    icon: (a) => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={a ? 2.5 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "statistics",
    label: "Statistics",
    icon: (a) => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={a ? 2.5 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

interface Props {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  activeProfile: Profile;
  setActiveProfile: (p: Profile) => void;
  profiles: Profile[];
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeProfile,
  setActiveProfile,
  profiles,
}: Props) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const s: React.CSSProperties = {
    width: 216,
    minWidth: 216,
    background: "var(--sidebar)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "relative",
    zIndex: 20,
  };

  return (
    <aside className="w-[216px] min-w-[216px] bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col h-screen relative z-20">
      {/* Logo */}
      <div className="p-4.5 px-3.5 pb-3.5 border-b border-[var(--border)] flex items-center gap-2.5">
        <RecursoLogo />
        <div>
          <div className="text-sm font-bold text-slate-200 tracking-tight leading-none">
            Recurso
          </div>
          <div className="font-mono text-[9px] font-medium text-[var(--muted-fg)] tracking-[1.2px] uppercase mt-0.5">
            Labs
          </div>
        </div>
      </div>

      {/* Profile Selector */}
      <div className="p-2.5 px-3 border-b border-[var(--border)]">
        <div className="font-mono text-[9px] font-semibold text-[var(--muted-fg)] tracking-[0.9px] uppercase mb-1.5">
          Active Profile
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full p-1.75 px-2.5 bg-white/[0.04] border border-[var(--border-strong)] rounded-md cursor-pointer flex items-center justify-between gap-2 hover:bg-white/[0.08] transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5.5 h-5.5 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {activeProfile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <span className="text-xs font-medium text-slate-200 truncate">
              {activeProfile.name}
            </span>
          </div>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--muted-fg)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
          </svg>
        </button>

        {open && (
          <div className="absolute left-3 right-3 bg-[var(--card)] border border-[var(--border-strong)] rounded-lg mt-1 z-50 shadow-2xl p-1">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProfile(p);
                  setOpen(false);
                }}
                className={`w-full p-1.75 px-2.5 border-none rounded-md cursor-pointer flex items-center gap-2 text-left ${
                  p.id === activeProfile.id
                    ? "bg-cyan-500/10"
                    : "bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    p.id === activeProfile.id
                      ? "bg-gradient-to-br from-cyan-500 to-indigo-500 text-white"
                      : "bg-[var(--secondary)] text-[var(--muted-fg)]"
                  }`}
                >
                  {p.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[var(--fg)] truncate">
                    {p.name}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--muted-fg)]">
                    {p.seniority} · {p.rateCurrency}
                    {p.rate}/hr
                  </div>
                </div>
                {p.id === activeProfile.id && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-1.5 px-2 flex flex-col gap-0.25">
        {NAV.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-btn w-full p-2.25 px-2.5 border-none rounded-md cursor-pointer flex items-center gap-2.5 text-left transition-all duration-150 ${
                active
                  ? "bg-cyan-500/12 text-[var(--primary)] font-semibold"
                  : "bg-transparent text-[var(--sidebar-fg)] font-normal hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {item.icon(active)}
              <span className="text-xs">{item.label}</span>
              {active && (
                <div className="ml-auto w-1.25 h-1.25 rounded-full bg-[var(--primary)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2.5 px-2.5 pb-3.5 border-t border-[var(--border)] flex flex-col gap-2">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="btn-ghost flex items-center gap-2 w-full p-1.75 px-2.5 bg-white/[0.04] border border-[var(--border)] rounded-md cursor-pointer text-[var(--sidebar-fg)] transition-all duration-150 hover:bg-white/[0.08]"
        >
          {resolvedTheme === "dark" ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          <span className="text-xs">
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>

        <div className="flex items-center gap-2 p-0.5">
          <div className="w-7.5 h-7.5 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            AR
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-200 truncate">
              Alex Rivera
            </div>
            <div className="font-mono text-[10px] text-[var(--primary)]">
              admin
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
