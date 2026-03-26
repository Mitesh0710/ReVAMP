import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

// ── Color tokens matching Dashboard.tsx ──────────────────────
const C = {
  bg:          "#000000",                    // black (Dashboard page bg)
  surface:     "#09090b",                    // Dashboard card bg
  border:      "rgba(255,255,255,0.05)",     // white/5
  borderHover: "rgba(255,255,255,0.10)",     // white/10
  text:        "#f4f4f5",                    // zinc-100
  muted:       "#a1a1aa",                    // zinc-400
  subtle:      "#71717a",                    // zinc-500
  accent:      "#6366f1",                    // indigo-400
  indigo:      "#6366f1",                    // indigo-600
};

interface Scan {
  scan_id: string;
  repo_owner: string;
  repo_name: string;
  branch_name: string;
  scanner_used: string;
  status: string;
  total_vulnerabilities: number;
  total_issues: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  warning_count: number;
  files_scanned: number;
  scan_duration_seconds: number;
  scan_duration: number;
  queued_at: string;
  started_at: string;
  completed_at: string;
  error_message: string;
  detected_languages: string[];
  last_commit_sha: string;
  severity_summary: Record<string, number>;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  completed: { color: "#34d399", bg: "rgba(52,211,153,0.10)",   label: "Completed", icon: "✓" },  // emerald-400
  failed:    { color: "#ef4444", bg: "rgba(239,68,68,0.10)",    label: "Failed",    icon: "✗" },  // red-500
  running:   { color: "#6366f1", bg: "rgba(99,102,241,0.10)",   label: "Running",   icon: "⟳" },  // indigo
  queued:    { color: "#f97316", bg: "rgba(249,115,22,0.10)",   label: "Queued",    icon: "⏳" }, // orange-500
  scanning:  { color: "#6366f1", bg: "rgba(99,102,241,0.10)",   label: "Scanning",  icon: "⟳" },  // indigo
  cloning:   { color: "#6366f1", bg: "rgba(99,102,241,0.10)",   label: "Cloning",   icon: "⟳" },  // indigo
  cancelled: { color: "#71717a", bg: "rgba(113,113,122,0.10)",  label: "Cancelled", icon: "⊘" },  // zinc-500
};

function getStatus(s: string) {
  return STATUS_CONFIG[s?.toLowerCase()] || STATUS_CONFIG.queued;
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function ScanHistory() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [filtered, setFiltered] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, running: 0 });

  const loadScans = () => {
    setLoading(true);
    setError("");
    fetch(`${API}/api/scanning/scans/history`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        const list: Scan[] = data.scans || [];
        list.sort((a, b) => new Date(b.queued_at).getTime() - new Date(a.queued_at).getTime());
        setScans(list);
        setStats({
          total: list.length,
          completed: list.filter((s) => s.status === "completed").length,
          failed: list.filter((s) => s.status === "failed").length,
          running: list.filter((s) =>
            ["running", "scanning", "cloning", "queued"].includes(s.status)
          ).length,
        });
      })
      .catch((e) => setError(`Failed to fetch scan history (${e.message})`))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadScans();
  }, []);

  useEffect(() => {
    let result = [...scans];
    if (statusFilter !== "all") result = result.filter((s) => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.scan_id?.toLowerCase().includes(q) ||
          s.branch_name?.toLowerCase().includes(q) ||
          s.scanner_used?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [scans, statusFilter, search]);

  const deleteScan = async (scanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this scan and all its vulnerability data?")) return;
    setDeleting(scanId);
    try {
      await fetch(`${API}/api/scanning/scans/${scanId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setScans((prev) => prev.filter((s) => s.scan_id !== scanId));
    } catch {
      alert("Failed to delete scan");
    } finally {
      setDeleting(null);
    }
  };

  const statCards = [
    { label: "Total Scans", value: stats.total,     color: C.text },
    { label: "Completed",   value: stats.completed, color: "#34d399" },  // emerald-400
    { label: "Failed",      value: stats.failed,    color: "#ef4444" },  // red-500
    { label: "Running",     value: stats.running,   color: C.accent },
  ];

  return (
    <div style={{
      background: C.bg,
      minHeight: "100vh",
      color: C.text,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ padding: "28px 32px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{
              fontSize: 10,
              color: C.indigo,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}>
              
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>Scan History</h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>All repository security scans</p>
          </div>
          <button
            onClick={loadScans}
            style={{
              padding: "8px 16px",
              background: "#4f46e5",       // indigo-600 — matches Dashboard Refresh button
              border: "none",
              borderRadius: 8,
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(99,102,241,0.25)",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
          {statCards.map((card) => (
            <div
              key={card.label}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "14px 16px",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.borderHover)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
            >
              <div style={{
                fontSize: 10,
                color: C.muted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}>
                {card.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color, letterSpacing: "-0.5px" }}>
                {loading ? "—" : card.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div style={{
        padding: "16px 32px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        gap: 12,
      }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search scan ID, branch, scanner..."
          style={{
            flex: 1,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "9px 14px",
            color: C.text,
            fontSize: 13,
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "9px 14px",
            color: C.text,
            fontSize: 13,
            outline: "none",
            minWidth: 140,
          }}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
          <option value="queued">Queued</option>
        </select>
      </div>

      {/* ── Scan List ───────────────────────────────────────── */}
      <div style={{ padding: "20px 32px" }}>
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 20,
              color: "#ef4444",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span>✗</span> {error}
            <button
              onClick={loadScans}
              style={{
                marginLeft: "auto",
                padding: "4px 12px",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 6,
                color: "#ef4444",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Loading scans...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏱</div>
            <div style={{ fontSize: 14 }}>
              {scans.length === 0
                ? "No scans yet. Start scanning from the Code Scanner."
                : "No scans match your filters."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((scan) => {
              const st = getStatus(scan.status);
              const isDeleting = deleting === scan.scan_id;
              return (
                <div
                  key={scan.scan_id}
                  onClick={() =>
                    scan.status === "completed" &&
                    navigate(`/vulnerabilities?scan_id=${scan.scan_id}`)
                  }
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: "16px 20px",
                    cursor: scan.status === "completed" ? "pointer" : "default",
                    transition: "border-color 0.15s, background 0.15s",
                    opacity: isDeleting ? 0.5 : 1,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 16,
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (scan.status === "completed") {
                      (e.currentTarget as HTMLDivElement).style.borderColor = C.borderHover;
                      (e.currentTarget as HTMLDivElement).style.background = "#18181b"; // zinc-900
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = C.border;
                    (e.currentTarget as HTMLDivElement).style.background = C.surface;
                  }}
                >
                  {/* Status indicator */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: st.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        color: st.color,
                      }}
                    >
                      {st.icon}
                    </div>
                    <span style={{
                      fontSize: 9,
                      color: st.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Main info */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <code style={{ fontSize: 12, color: C.accent }}>{scan.scan_id.substring(0, 8)}</code>
                      <span style={{ fontSize: 10, color: C.subtle }}>·</span>
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                        {scan.repo_name || scan.repo_owner}
                      </span>
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>
                        {timeAgo(scan.completed_at || scan.started_at)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      {scan.severity_summary?.CRITICAL > 0 && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px",
                          background: "rgba(239,68,68,0.10)",   // red-500/10
                          color: "#ef4444",
                          borderRadius: 4,
                          border: "1px solid rgba(239,68,68,0.20)",
                        }}>
                          ● {scan.severity_summary.CRITICAL} Critical
                        </span>
                      )}
                      {scan.severity_summary?.HIGH > 0 && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px",
                          background: "rgba(249,115,22,0.10)",  // orange-500/10
                          color: "#f97316",
                          borderRadius: 4,
                          border: "1px solid rgba(249,115,22,0.20)",
                        }}>
                          ● {scan.severity_summary.HIGH} High
                        </span>
                      )}
                      {scan.severity_summary?.MEDIUM > 0 && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px",
                          background: "rgba(234,179,8,0.10)",   // yellow-500/10
                          color: "#eab308",
                          borderRadius: 4,
                          border: "1px solid rgba(234,179,8,0.20)",
                        }}>
                          ● {scan.severity_summary.MEDIUM} Medium
                        </span>
                      )}
                      {scan.severity_summary?.LOW > 0 && (
                        <span style={{
                          fontSize: 11, padding: "2px 8px",
                          background: "rgba(59,130,246,0.10)",  // blue-500/10
                          color: "#3b82f6",
                          borderRadius: 4,
                          border: "1px solid rgba(59,130,246,0.20)",
                        }}>
                          ● {scan.severity_summary.LOW} Low
                        </span>
                      )}
                      {!scan.severity_summary &&
                        (scan.total_issues || scan.total_vulnerabilities) > 0 && (
                          <span style={{
                            fontSize: 11, padding: "2px 8px",
                            background: "rgba(249,115,22,0.10)",
                            color: "#f97316",
                            borderRadius: 4,
                          }}>
                            {scan.total_issues || scan.total_vulnerabilities} issues
                          </span>
                        )}
                      {scan.status === "completed" &&
                        (scan.total_issues || scan.total_vulnerabilities || 0) === 0 && (
                          <span style={{
                            fontSize: 11, padding: "2px 8px",
                            background: "rgba(52,211,153,0.10)",  // emerald-400/10
                            color: "#34d399",
                            borderRadius: 4,
                            border: "1px solid rgba(52,211,153,0.20)",
                          }}>
                            ✓ Clean
                          </span>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: C.muted }}>
                      {scan.scan_duration && <span>{formatDuration(scan.scan_duration)}</span>}
                      {scan.completed_at && <span>{formatDate(scan.completed_at)}</span>}
                    </div>

                    {scan.error_message && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: "#ef4444",
                          background: "rgba(239,68,68,0.06)",
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(239,68,68,0.15)",
                        }}
                      >
                        {scan.error_message}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {scan.status === "completed" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vulnerabilities?scan_id=${scan.scan_id}`);
                        }}
                        style={{
                          padding: "6px 14px",
                          background: C.surface,
                          border: `1px solid ${C.borderHover}`,
                          borderRadius: 6,
                          color: C.text,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        View →
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteScan(scan.scan_id, e)}
                      disabled={isDeleting}
                      style={{
                        padding: "6px 14px",
                        background: "transparent",
                        border: "1px solid rgba(239,68,68,0.30)",
                        borderRadius: 6,
                        color: "#ef4444",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {isDeleting ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}