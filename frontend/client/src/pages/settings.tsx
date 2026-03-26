// src/pages/settings.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthProvider";
import { User, Settings, Bell, Shield, Key, Mail, Github, LogOut, Check, AlertTriangle } from "lucide-react";

const API = "http://localhost:8000";

const C = {
  bg:          "#000000",
  surface:     "#09090b",
  border:      "rgba(255,255,255,0.05)",
  borderHover: "rgba(255,255,255,0.10)",
  text:        "#f4f4f5",
  muted:       "#a1a1aa",
  subtle:      "#71717a",
  accent:      "#6366f1",
  indigo:      "#6366f1",
};

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: "profile",       icon: User,     label: "Public profile" },
      { id: "account",       icon: Settings, label: "Account" },
      { id: "notifications", icon: Bell,     label: "Notifications" },
    ],
  },
  {
    label: "Access",
    items: [
      { id: "emails",   icon: Mail,   label: "Emails" },
      { id: "security", icon: Shield, label: "Password and authentication" },
      { id: "sessions", icon: Key,    label: "Sessions" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { id: "github-apps", icon: Github, label: "GitHub Apps" },
    ],
  },
];

function ReadRow({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 12, color: C.muted, width: 180, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.subtle, flex: 1 }}>{value}</span>
      {badge}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: `1px solid ${C.border}`, margin: "28px 0" }} />;
}

function SaveBtn({ onClick, saved }: { onClick: () => void; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 18px",
        background: saved ? "rgba(52,211,153,0.12)" : "#4f46e5",
        border: `1px solid ${saved ? "rgba(52,211,153,0.3)" : "transparent"}`,
        borderRadius: 6,
        color: saved ? "#34d399" : "#ffffff",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.2s",
        boxShadow: saved ? "none" : "0 4px 14px rgba(99,102,241,0.25)",
      }}
    >
      {saved ? <><Check style={{ width: 11, height: 11 }} /> Saved</> : "Save changes"}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 40, height: 22,
        borderRadius: 11,
        border: "none",
        cursor: "pointer",
        position: "relative",
        background: on ? C.accent : C.surface,
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute",
        top: 2,
        left: on ? 20 : 2,
        width: 18, height: 18,
        borderRadius: "50%",
        background: on ? "#ffffff" : C.subtle,
        transition: "left 0.2s, background 0.2s",
      }} />
    </button>
  );
}

interface GHProfile {
  login: string;
  name: string | null;
  display_name?: string;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
}

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  profile:       { title: "Public profile",               subtitle: "Manage how you appear to others" },
  account:       { title: "Account",                      subtitle: "Your GitHub-linked account details" },
  notifications: { title: "Notifications",                subtitle: "Control what you get notified about" },
  emails:        { title: "Emails",                       subtitle: "Email addresses linked to your account" },
  security:      { title: "Password and authentication",  subtitle: "GitHub OAuth manages your authentication" },
  sessions:      { title: "Sessions",                     subtitle: "Devices with active access to your account" },
  "github-apps": { title: "GitHub Apps",                  subtitle: "Applications connected via GitHub OAuth" },
};

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const [activeId, setActiveId]       = useState("profile");
  const [saved, setSaved]             = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio]   = useState("");
  const [gh, setGh]                   = useState<GHProfile | null>(null);
  const [notifications, setNotifications] = useState({
    scanComplete: true, criticalVulns: true, weeklyReport: false, newFeatures: false,
  });

  useEffect(() => {
    fetch(`${API}/auth/user`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: GHProfile) => {
        setGh(data);
        setProfileName(data.display_name || data.name || data.login || "");
        setProfileBio(data.bio || "");
      })
      .catch((err) => console.error("GitHub profile fetch failed:", err));
  }, []);

  const save = async () => {
    await fetch(`${API}/auth/user`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: profileName }),
    });
    await refreshUser(); // re-fetches /auth/me + /api/github/user, updates sidebar instantly
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggle = (k: keyof typeof notifications) =>
    setNotifications((p) => ({ ...p, [k]: !p[k] }));

  const toLocal = (iso?: string) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const memberSince = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  const initials = user?.email?.[0]?.toUpperCase() || "U";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "8px 12px",
    color: C.text,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  };

  const readonlyStyle: React.CSSProperties = {
    ...inputStyle,
    background: C.bg,
    color: C.subtle,
    cursor: "default",
    border: `1px solid ${C.border}`,
  };

  const fieldWrap = (label: string, children: React.ReactNode, desc?: string) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: "block",
        fontSize: 13,
        fontWeight: 600,
        color: C.text,
        marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
      {desc && (
        <p style={{ fontSize: 11, color: C.subtle, marginTop: 5, lineHeight: 1.6 }}>{desc}</p>
      )}
    </div>
  );

  const meta = SECTION_META[activeId];

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      width: "100%",
      background: C.bg,
      color: C.text,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    }}>

      {/* ── Left Sidebar ── */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
      }}>

        {/* Sidebar header */}
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{
            fontSize: 10,
            color: C.indigo,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}>
            
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
            Settings
          </div>
        </div>

        {/* Identity card */}
        <div style={{
          margin: "0 12px 16px",
          padding: "12px",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          {gh?.avatar_url
            ? <img src={gh.avatar_url} alt="avatar" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: 6, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.accent, flexShrink: 0, border: `1px solid ${C.border}` }}>{initials}</div>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {gh?.login || user?.email?.split("@")[0] || "User"}
            </div>
            <div style={{ fontSize: 10, color: C.subtle }}>Personal account</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 12px" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 20 }}>
              {group.label && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.subtle,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  padding: "0 8px",
                  marginBottom: 4,
                }}>
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 12,
                      textAlign: "left",
                      marginBottom: 1,
                      background: isActive ? C.surface : "transparent",
                      color: isActive ? C.text : C.muted,
                      borderLeft: isActive ? `2px solid ${C.accent}` : "2px solid transparent",
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = C.text; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = C.muted; }}
                  >
                    {item.icon && <item.icon style={{ width: 13, height: 13, flexShrink: 0 }} />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: "12px", borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={logout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              background: "transparent",
              color: C.subtle,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.subtle)}
          >
            <LogOut style={{ width: 13, height: 13 }} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>

        {/* Content header */}
        <div style={{ padding: "28px 48px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            fontSize: 10,
            color: C.indigo,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}>
            
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>
            {meta?.title}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>
            {meta?.subtitle}
          </p>
        </div>

        {/* Section content */}
        <div style={{ padding: "32px 48px" }}>

          {/* PUBLIC PROFILE */}
          {activeId === "profile" && (
            <div style={{ display: "flex", gap: 40 }}>
              <div style={{ flex: 1 }}>
                {fieldWrap("Name",
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your display name"
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                  />,
                  "Your name may appear around ReVAMP where you contribute or are mentioned."
                )}
                {fieldWrap("Email",
                  <input value={user?.email || ""} readOnly style={readonlyStyle} />,
                  "This is your primary account email used for authentication."
                )}
                {fieldWrap("Bio",
                  <textarea
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="Tell others about yourself..."
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                  />,
                  "Tell others a little about yourself."
                )}
                {fieldWrap("GitHub username",
                  <input value={gh?.login || "Loading..."} readOnly style={readonlyStyle} />,
                  "Fetched from your GitHub account — cannot be changed here."
                )}
                {fieldWrap("GitHub profile URL",
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={gh ? `https://github.com/${gh.login}` : "Loading..."} readOnly style={{ ...readonlyStyle, flex: 1 }} />
                    {gh?.login && (
                      <a
                        href={`https://github.com/${gh.login}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "8px 14px",
                          background: C.surface,
                          border: `1px solid ${C.borderHover}`,
                          borderRadius: 6,
                          color: C.text,
                          fontSize: 12,
                          textDecoration: "none",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        View →
                      </a>
                    )}
                  </div>
                )}
                <Divider />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <SaveBtn onClick={save} saved={saved} />
                  <span style={{ fontSize: 11, color: C.subtle }}>Name and bio are saved locally.</span>
                </div>
              </div>

              {/* Avatar */}
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 10 }}>
                  Profile picture
                </div>
                {gh?.avatar_url
                  ? <img src={gh.avatar_url} alt="avatar" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}`, display: "block", marginBottom: 10 }} />
                  : <div style={{ width: 100, height: 100, borderRadius: "50%", background: C.surface, border: `2px solid ${C.borderHover}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800, color: C.accent, marginBottom: 10 }}>{initials}</div>
                }
                <div style={{ fontSize: 10, color: C.subtle, lineHeight: 1.6 }}>
                  Sourced from your GitHub account.
                </div>
                {gh?.location && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                    {gh.location}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACCOUNT */}
          {activeId === "account" && (
            <>
              <p style={{ fontSize: 13, color: C.subtle, margin: "0 0 24px", lineHeight: 1.7 }}>
                These details come from GitHub OAuth and are read-only. To change them, update your{" "}
                <a href="https://github.com/settings/profile" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
                  GitHub profile →
                </a>
              </p>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
                <ReadRow label="GitHub username"  value={gh?.login || "—"} />
                <ReadRow label="Display name"     value={gh?.name || "Not set"} />
                <ReadRow
                  label="Email address"
                  value={user?.email || "—"}
                  badge={user?.email_verified
                    ? <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 10, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <Check style={{ width: 9, height: 9 }} /> Verified
                      </span>
                    : undefined}
                />
                <ReadRow label="Member since"  value={memberSince(user?.created_at)} />
                <ReadRow label="Last login"    value={toLocal(user?.last_login)} />
                <ReadRow label="GitHub profile" value={gh ? `github.com/${gh.login}` : "—"} />
              </div>

              <Divider />

              {/* Danger zone */}
              <div style={{ border: "1px solid rgba(239,68,68,0.20)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  background: "rgba(239,68,68,0.06)",
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(239,68,68,0.20)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <AlertTriangle style={{ width: 13, height: 13, color: "#ef4444" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>Danger zone</span>
                </div>
                <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>Delete this account</div>
                    <div style={{ fontSize: 12, color: C.subtle }}>Once deleted, all your scan data is permanently removed.</div>
                  </div>
                  <button style={{
                    padding: "7px 14px",
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.40)",
                    borderRadius: 6,
                    color: "#ef4444",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}>
                    Delete account
                  </button>
                </div>
              </div>
            </>
          )}

          {/* NOTIFICATIONS */}
          {activeId === "notifications" && (
            <>
              <p style={{ fontSize: 13, color: C.subtle, margin: "0 0 28px", lineHeight: 1.7 }}>
                Choose what you want to be notified about. Email delivery requires SMTP configuration.
              </p>
              {[
                { section: "Scanning", items: [
                  { key: "scanComplete",  label: "Scan complete",            desc: "When a repository scan finishes running" },
                  { key: "criticalVulns", label: "Critical vulnerabilities", desc: "When CRITICAL severity issues are detected" },
                ]},
                { section: "Reports", items: [
                  { key: "weeklyReport", label: "Weekly security report", desc: "A summary digest sent every Monday" },
                  { key: "newFeatures",  label: "Product updates",        desc: "New features and platform announcements" },
                ]},
              ].map((group) => (
                <div key={group.section} style={{ marginBottom: 28 }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.subtle,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: 4,
                    paddingBottom: 8,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    {group.section}
                  </div>
                  {group.items.map(({ key, label, desc }) => (
                    <div key={key} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: `1px solid ${C.border}`,
                      gap: 16,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, color: C.text, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11, color: C.subtle }}>{desc}</div>
                      </div>
                      <Toggle
                        on={notifications[key as keyof typeof notifications]}
                        onChange={() => toggle(key as keyof typeof notifications)}
                      />
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <SaveBtn onClick={save} saved={saved} />
              </div>
            </>
          )}

          {/* EMAILS */}
          {activeId === "emails" && (
            <>
              <p style={{ fontSize: 13, color: C.subtle, margin: "0 0 28px", lineHeight: 1.7 }}>
                Manage your email addresses associated with your account.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Primary email address
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={user?.email || ""} readOnly style={{ ...readonlyStyle, flex: 1 }} />
                  {user?.email_verified && (
                    <span style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      background: "rgba(52,211,153,0.10)",
                      color: "#34d399",
                      border: "1px solid rgba(52,211,153,0.25)",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}>
                      <Check style={{ width: 10, height: 10 }} /> Primary
                    </span>
                  )}
                </div>
              </div>
              <div style={{
                background: "rgba(99,102,241,0.06)",
                border: `1px solid rgba(99,102,241,0.15)`,
                borderLeft: `3px solid ${C.accent}`,
                borderRadius: 8,
                padding: "14px 16px",
                fontSize: 12,
                color: C.muted,
                lineHeight: 1.7,
              }}>
                Your email is sourced from GitHub OAuth and cannot be changed here. Update it on GitHub and sign in again to reflect changes.
              </div>
            </>
          )}

          {/* SECURITY */}
          {activeId === "security" && (
            <>
              <p style={{ fontSize: 13, color: C.subtle, margin: "0 0 28px", lineHeight: 1.7 }}>
                Your account uses GitHub OAuth — no password is stored by ReVAMP.
              </p>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                {[
                  {
                    label: "GitHub OAuth 2.0",
                    sub: "Passwordless, secure authentication",
                    badge: <span style={{ fontSize: 10, padding: "3px 9px", background: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 10, whiteSpace: "nowrap" }}>Active</span>,
                  },
                  {
                    label: "Two-factor authentication",
                    sub: "Managed by your GitHub account settings",
                    badge: <a href="https://github.com/settings/security" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.accent, textDecoration: "none", whiteSpace: "nowrap" }}>Configure on GitHub →</a>,
                  },
                  {
                    label: "Access token",
                    sub: "GitHub token expires after 8 hours · Read-only repo access",
                    badge: <span style={{ fontSize: 10, padding: "3px 9px", background: "rgba(234,179,8,0.10)", color: "#eab308", border: "1px solid rgba(234,179,8,0.25)", borderRadius: 10, whiteSpace: "nowrap" }}>Read only</span>,
                  },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    padding: "14px 16px",
                    borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: C.subtle, marginTop: 2 }}>{row.sub}</div>
                    </div>
                    {row.badge}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* SESSIONS */}
          {activeId === "sessions" && (
            <>
              <p style={{ fontSize: 13, color: C.subtle, margin: "0 0 28px", lineHeight: 1.7 }}>
                Devices that have logged into your account. Revoke any sessions you don't recognize.
              </p>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Current session</div>
                  <span style={{
                    fontSize: 9,
                    padding: "2px 8px",
                    background: "rgba(52,211,153,0.10)",
                    color: "#34d399",
                    border: "1px solid rgba(52,211,153,0.25)",
                    borderRadius: 10,
                  }}>
                    Active now
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.subtle }}>Last login: {toLocal(user?.last_login)}</div>
              </div>
              <button
                onClick={logout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid rgba(239,68,68,0.30)",
                  borderRadius: 6,
                  color: "#ef4444",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <LogOut style={{ width: 12, height: 12 }} /> Sign out of all sessions
              </button>
            </>
          )}

          {/* GITHUB APPS */}
          {activeId === "github-apps" && (
            <>
              <p style={{ fontSize: 13, color: C.subtle, margin: "0 0 28px", lineHeight: 1.7 }}>
                Applications connected to your account via GitHub OAuth.
              </p>
              <div style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}>
                <div style={{
                  width: 40, height: 40,
                  borderRadius: 8,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Shield style={{ width: 18, height: 18, color: C.accent }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>ReVAMP</div>
                  <div style={{ fontSize: 11, color: C.subtle, marginTop: 2 }}>
                    Security scanning platform · repo (read) access
                  </div>
                </div>
                <span style={{
                  fontSize: 10,
                  padding: "3px 9px",
                  background: "rgba(52,211,153,0.10)",
                  color: "#34d399",
                  border: "1px solid rgba(52,211,153,0.25)",
                  borderRadius: 10,
                  whiteSpace: "nowrap",
                }}>
                  Connected
                </span>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}