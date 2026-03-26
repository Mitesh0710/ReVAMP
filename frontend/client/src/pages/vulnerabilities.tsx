import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

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

interface Vulnerability {
  id: string;
  rule_id: string;
  scanner_name: string;
  severity: string;
  message: string;
  vulnerability_type: string;
  confidence: string;
  file_path: string;
  start_line: number;
  end_line: number;
  code_snippet: string;
  cwe_ids: string[];
  owasp_categories: string[];
}

interface Scan {
  scan_id: string;
  repo_owner: string;
  repo_name: string;
  status: string;
  total_issues: number;
  severity_summary: Record<string, number>;
  completed_at: string;
}

const SEV_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; symbol: string }> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.20)",   label: "Critical", symbol: "!" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.20)",  label: "High",     symbol: "↑" },
  medium:   { color: "#eab308", bg: "rgba(234,179,8,0.10)",   border: "rgba(234,179,8,0.20)",   label: "Medium",   symbol: "~" },
  low:      { color: "#3b82f6", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.20)",  label: "Low",      symbol: "·" },
  info:     { color: "#71717a", bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.20)", label: "Info",     symbol: "i" },
  warning:  { color: "#f97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.20)",  label: "Warning",  symbol: "~" },
};

function getSev(sev: string) {
  return SEV_CONFIG[sev?.toLowerCase()] || SEV_CONFIG.info;
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

export default function Vulnerabilities() {
  const [searchParams] = useSearchParams();
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [filtered, setFiltered] = useState<Vulnerability[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadingScans, setLoadingScans] = useState(true);
  const [loadingVulns, setLoadingVulns] = useState(false);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");

  useEffect(() => {
    fetch(`${API}/api/scanning/scans/history`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const completed = (data.scans || []).filter((sc: Scan) => sc.status === "completed");
        setScans(completed);
        const paramId = searchParams.get("scan_id");
        const toSelect = paramId
          ? completed.find((sc: Scan) => sc.scan_id === paramId)
          : completed[0];
        if (toSelect) setSelectedScan(toSelect);
      })
      .finally(() => setLoadingScans(false));
  }, []);

  useEffect(() => {
    if (!selectedScan) return;
    setLoadingVulns(true);
    setExpanded(null);
    fetch(`${API}/api/scanning/scans/${selectedScan.scan_id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setVulnerabilities(data.vulnerabilities || []))
      .finally(() => setLoadingVulns(false));
  }, [selectedScan]);

  useEffect(() => {
    let result = [...vulnerabilities];
    if (sevFilter !== "all")
      result = result.filter((v) => v.severity?.toLowerCase() === sevFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.file_path?.toLowerCase().includes(q) ||
          v.message?.toLowerCase().includes(q) ||
          v.rule_id?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [vulnerabilities, sevFilter, search]);

  const counts = {
    all:      vulnerabilities.length,
    critical: vulnerabilities.filter((v) => v.severity?.toLowerCase() === "critical").length,
    high:     vulnerabilities.filter((v) => v.severity?.toLowerCase() === "high").length,
    medium:   vulnerabilities.filter((v) => v.severity?.toLowerCase() === "medium").length,
    low:      vulnerabilities.filter((v) => v.severity?.toLowerCase() === "low").length,
  };

  // Same stat card layout as ScanHistory
  const statCards = [
    { label: "Total Issues", value: counts.all,      color: C.text },
    { label: "Critical",     value: counts.critical, color: "#ef4444" },
    { label: "High",         value: counts.high,     color: "#f97316" },
    { label: "Medium",       value: counts.medium,   color: "#eab308" },
  ];

  const TABS = [
    { key: "all",      label: "All",      color: C.accent },
    { key: "critical", label: "Critical", color: "#ef4444" },
    { key: "high",     label: "High",     color: "#f97316" },
    { key: "medium",   label: "Medium",   color: "#eab308" },
    { key: "low",      label: "Low",      color: "#3b82f6" },
  ];

  return (
    <div style={{
      background: C.bg,
      minHeight: "100vh",
      color: C.text,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    }}>

      {/* ── Header — pixel-perfect match with ScanHistory ── */}
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
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}>
              Vulnerabilities
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>
              {selectedScan
                ? `${selectedScan.repo_name || selectedScan.scan_id.substring(0, 8)} — ${counts.all} issue${counts.all !== 1 ? "s" : ""} found`
                : "Select a scan to inspect"}
            </p>
          </div>

          {/* Scan selector — styled as a Refresh-style button area */}
          {!loadingScans && scans.length > 0 && (
            <select
              value={selectedScan?.scan_id || ""}
              onChange={(e) => {
                const found = scans.find((x) => x.scan_id === e.target.value);
                if (found) { setSelectedScan(found); setSevFilter("all"); setSearch(""); }
              }}
              style={{
                background: C.surface,
                border: `1px solid ${C.borderHover}`,
                borderRadius: 8,
                padding: "8px 16px",
                color: C.text,
                fontSize: 12,
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
                minWidth: 220,
                fontFamily: "inherit",
              }}
            >
              {scans.map((sc) => (
                <option key={sc.scan_id} value={sc.scan_id}>
                  {sc.repo_name || sc.scan_id.substring(0, 8)} · {timeAgo(sc.completed_at)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stat Cards — identical to ScanHistory stat cards */}
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
                {loadingVulns ? "—" : card.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Severity Filter Tabs ── */}
      {selectedScan && !loadingVulns && (
        <div style={{
          padding: "0 32px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
        }}>
          {TABS.map((tab) => {
            const active = sevFilter === tab.key;
            const count = counts[tab.key as keyof typeof counts];
            return (
              <button
                key={tab.key}
                onClick={() => setSevFilter(tab.key)}
                style={{
                  padding: "12px 18px",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? `2px solid ${tab.color}` : "2px solid transparent",
                  color: active ? tab.color : C.muted,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "color 0.15s, border-color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 20,
                    background: active ? `${tab.color}20` : C.surface,
                    color: active ? tab.color : C.subtle,
                    border: `1px solid ${active ? tab.color + "40" : C.border}`,
                    fontWeight: 600,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Search Bar — identical to ScanHistory filter bar ── */}
      {selectedScan && (
        <div style={{
          padding: "16px 32px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          gap: 12,
        }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search file path, message, rule ID..."
            style={{
              flex: 1,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "9px 14px",
              color: C.text,
              fontSize: 13,
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
          />
        </div>
      )}

      {/* ── Vulnerability List ── */}
      <div style={{ padding: "20px 32px" }}>
        {loadingScans ? (
          <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Loading scans...</div>
        ) : !selectedScan ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 12, color: C.subtle }}>⊘</div>
            <div style={{ fontSize: 14 }}>No completed scans yet. Start scanning from the Repositories page.</div>
          </div>
        ) : loadingVulns ? (
          <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Loading vulnerabilities...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
            {vulnerabilities.length === 0 ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 12, color: "#34d399" }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>No vulnerabilities found — this scan is clean.</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 12, color: C.subtle }}>⌕</div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>No results match your filters.</div>
                <button
                  onClick={() => { setSearch(""); setSevFilter("all"); }}
                  style={{
                    padding: "8px 18px",
                    background: C.surface,
                    border: `1px solid ${C.borderHover}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              Showing{" "}
              <span style={{ color: C.text, fontWeight: 600 }}>{filtered.length}</span>
              {" "}of{" "}
              <span style={{ color: C.text, fontWeight: 600 }}>{vulnerabilities.length}</span>
              {" "}vulnerabilities
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((vuln) => {
                const sv = getSev(vuln.severity);
                const isOpen = expanded === vuln.id;
                const fileName = vuln.file_path?.split(/[\\/]/).pop() || vuln.file_path;

                return (
                  <div
                    key={vuln.id}
                    style={{
                      background: C.surface,
                      border: `1px solid ${isOpen ? C.borderHover : C.border}`,
                      borderRadius: 10,
                      overflow: "hidden",
                      transition: "border-color 0.15s",
                    }}
                  >
                    {/* ── Card row — IDENTICAL grid to ScanHistory scan rows ── */}
                    <div
                      onClick={() => setExpanded(isOpen ? null : vuln.id)}
                      style={{
                        padding: "16px 20px",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 16,
                        alignItems: "center",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => {
                        const card = e.currentTarget.parentElement as HTMLDivElement;
                        card.style.borderColor = C.borderHover;
                        card.style.background = "#18181b";
                      }}
                      onMouseLeave={(e) => {
                        const card = e.currentTarget.parentElement as HTMLDivElement;
                        if (!isOpen) {
                          card.style.borderColor = C.border;
                          card.style.background = C.surface;
                        }
                      }}
                    >
                      {/* LEFT: Severity indicator — mirrors ScanHistory status block exactly */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: sv.bg,
                          border: `1px solid ${sv.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          fontWeight: 700,
                          color: sv.color,
                          fontFamily: "ui-monospace, monospace",
                        }}>
                          {sv.symbol}
                        </div>
                        <span style={{
                          fontSize: 9,
                          color: sv.color,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontWeight: 700,
                        }}>
                          {sv.label}
                        </span>
                      </div>

                      {/* CENTER: Main info — same structure as ScanHistory main info column */}
                      <div>
                        {/* Row 1: rule id · filename · timeago */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          {vuln.rule_id && (
                            <code style={{ fontSize: 12, color: C.accent }}>
                              {vuln.rule_id.substring(0, 12)}
                            </code>
                          )}
                          <span style={{ fontSize: 10, color: C.subtle }}>·</span>
                          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                            {fileName}
                          </span>
                          {vuln.start_line > 0 && (
                            <span style={{ fontSize: 12, color: C.subtle }}>
                              L{vuln.start_line}
                              {vuln.end_line && vuln.end_line !== vuln.start_line ? `–${vuln.end_line}` : ""}
                            </span>
                          )}
                        </div>

                        {/* Row 2: message — matches the bold repo name line in ScanHistory */}
                        <div style={{
                          fontSize: 13,
                          color: C.muted,
                          marginBottom: 6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}>
                          {vuln.message}
                        </div>

                        {/* Row 3: badges — same pill style as ScanHistory */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {vuln.vulnerability_type && (
                            <span style={{
                              fontSize: 11, padding: "2px 8px",
                              background: sv.bg,
                              color: sv.color,
                              borderRadius: 4,
                              border: `1px solid ${sv.border}`,
                            }}>
                              {vuln.vulnerability_type}
                            </span>
                          )}
                          {vuln.cwe_ids?.slice(0, 2).map((c) => (
                            <span key={c} style={{
                              fontSize: 11, padding: "2px 8px",
                              background: "rgba(99,102,241,0.10)",
                              color: C.accent,
                              borderRadius: 4,
                              border: "1px solid rgba(99,102,241,0.20)",
                            }}>
                              {c}
                            </span>
                          ))}
                          {vuln.confidence && (
                            <span style={{
                              fontSize: 11, padding: "2px 8px",
                              background: "rgba(113,113,122,0.08)",
                              color: C.subtle,
                              borderRadius: 4,
                              border: `1px solid ${C.border}`,
                            }}>
                              {vuln.confidence}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* RIGHT: Expand/Collapse button — mirrors ScanHistory "View →" button */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : vuln.id); }}
                          style={{
                            padding: "6px 14px",
                            background: C.surface,
                            border: `1px solid ${C.borderHover}`,
                            borderRadius: 6,
                            color: C.text,
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isOpen ? "Close ↑" : "Details →"}
                        </button>
                      </div>
                    </div>

                    {/* ── Expanded Detail Panel ── */}
                    {isOpen && (
                      <div style={{
                        borderTop: `1px solid ${C.border}`,
                        padding: "20px 24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        background: "#18181b",
                      }}>

                        {/* File path */}
                        {(vuln.file_path || vuln.start_line) && (
                          <div style={{
                            background: C.bg,
                            borderRadius: 8,
                            padding: "10px 14px",
                            fontSize: 12,
                            color: C.muted,
                            fontFamily: "'Fira Code', monospace",
                            border: `1px solid ${C.border}`,
                          }}>
                            📄{" "}
                            <span style={{ color: C.text }}>
                              {vuln.file_path || "File path not recorded"}
                            </span>
                            {vuln.start_line > 0 && (
                              <>
                                <span style={{ color: C.subtle, margin: "0 8px" }}>·</span>
                                Line {vuln.start_line}
                                {vuln.end_line && vuln.end_line !== vuln.start_line ? `–${vuln.end_line}` : ""}
                              </>
                            )}
                          </div>
                        )}

                        {/* Code snippet */}
                        {vuln.code_snippet && (
                          <div>
                            <div style={{
                              fontSize: 10,
                              color: C.subtle,
                              textTransform: "uppercase",
                              letterSpacing: "0.12em",
                              marginBottom: 8,
                              fontWeight: 600,
                            }}>
                              Flagged Code
                            </div>
                            <pre style={{
                              background: C.bg,
                              border: `1px solid ${sv.color}30`,
                              borderRadius: 8,
                              padding: "14px 18px",
                              fontSize: 12,
                              color: C.text,
                              margin: 0,
                              overflowX: "auto",
                              lineHeight: 1.8,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              fontFamily: "'Fira Code', monospace",
                            }}>
                              {vuln.code_snippet}
                            </pre>
                          </div>
                        )}

                        {/* Metadata grid */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                          gap: 10,
                        }}>
                          {[
                            { label: "Rule ID",    value: vuln.rule_id,            color: C.accent },
                            { label: "Type",       value: vuln.vulnerability_type, color: C.text },
                            { label: "Confidence", value: vuln.confidence,         color: C.text },
                            { label: "Scanner",    value: vuln.scanner_name,       color: C.text },
                          ].filter((m) => m.value).map((m) => (
                            <div key={m.label} style={{
                              background: C.bg,
                              borderRadius: 8,
                              padding: "10px 14px",
                              border: `1px solid ${C.border}`,
                            }}>
                              <div style={{
                                fontSize: 10,
                                color: C.subtle,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                marginBottom: 5,
                                fontWeight: 600,
                              }}>
                                {m.label}
                              </div>
                              <div style={{ fontSize: 13, color: m.color, wordBreak: "break-all" }}>
                                {m.value}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* CWE / OWASP */}
                        {(vuln.cwe_ids?.length > 0 || vuln.owasp_categories?.length > 0) && (
                          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                            {vuln.cwe_ids?.length > 0 && (
                              <div>
                                <div style={{
                                  fontSize: 10,
                                  color: C.subtle,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  marginBottom: 8,
                                  fontWeight: 600,
                                }}>
                                  CWE
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {vuln.cwe_ids.map((c) => (
                                    <span key={c} style={{
                                      fontSize: 12,
                                      padding: "4px 10px",
                                      background: "rgba(99,102,241,0.10)",
                                      color: C.accent,
                                      borderRadius: 6,
                                      border: "1px solid rgba(99,102,241,0.20)",
                                    }}>
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {vuln.owasp_categories?.length > 0 && (
                              <div>
                                <div style={{
                                  fontSize: 10,
                                  color: C.subtle,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  marginBottom: 8,
                                  fontWeight: 600,
                                }}>
                                  OWASP
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {vuln.owasp_categories.map((o) => (
                                    <span key={o} style={{
                                      fontSize: 12,
                                      padding: "4px 10px",
                                      background: "rgba(249,115,22,0.10)",
                                      color: "#f97316",
                                      borderRadius: 6,
                                      border: "1px solid rgba(249,115,22,0.20)",
                                    }}>
                                      {o}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}