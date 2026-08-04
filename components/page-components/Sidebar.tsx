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
    <aside style={s}>
      {/* Logo */}
      <div
        style={{
          padding: "18px 14px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <RecursoLogo />
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#e2e8f0",
              letterSpacing: "-0.4px",
              lineHeight: 1,
            }}
          >
            Recurso
          </div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: "var(--muted-fg)",
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            Labs
          </div>
        </div>
      </div>

      {/* Profile Selector */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: "var(--muted-fg)",
            letterSpacing: "0.9px",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Active Profile
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: "100%",
            padding: "7px 10px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #06b6d4, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {activeProfile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#e2e8f0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
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
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              background: "var(--card)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              marginTop: 4,
              zIndex: 50,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              padding: 4,
            }}
          >
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProfile(p);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background:
                    p.id === activeProfile.id
                      ? "rgba(6,182,212,0.1)"
                      : "transparent",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background:
                      p.id === activeProfile.id
                        ? "linear-gradient(135deg, #06b6d4, #6366f1)"
                        : "var(--secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color:
                      p.id === activeProfile.id ? "white" : "var(--muted-fg)",
                    flexShrink: 0,
                  }}
                >
                  {p.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div style={{ textAlign: "left", minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--fg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 10, color: "var(--muted-fg)" }}
                  >
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
      <nav
        style={{
          flex: 1,
          padding: "6px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {NAV.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="nav-btn"
              style={{
                width: "100%",
                padding: "9px 10px",
                background: active ? "rgba(6,182,212,0.12)" : "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: active ? "var(--primary)" : "var(--sidebar-fg)",
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
            >
              {item.icon(active)}
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>
                {item.label}
              </span>
              {active && (
                <div
                  style={{
                    marginLeft: "auto",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--primary)",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div
        style={{
          padding: "10px 10px 14px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "7px 10px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            cursor: "pointer",
            color: "var(--sidebar-fg)",
            transition: "all 0.12s ease",
          }}
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
          <span style={{ fontSize: 12 }}>
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "2px 2px",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #06b6d4, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}
          >
            AR
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#e2e8f0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Alex Rivera
            </div>
            <div
              className="mono"
              style={{ fontSize: 10, color: "var(--primary)" }}
            >
              admin
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
