import { useEffect, useState } from "react";

interface HistoryItem {
  submission_id: string;
  ward: string;
  rows_written: number;
  columns: string[];
  rows: Record<string, string | null>[];
  created_at: string;
  status: string;
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${apiUrl}/history-ward/`);
        if (!res.ok) throw new Error("Failed to load history");
        const data = await res.json();
        setHistory(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const formatDate = (isoString: string) => {
    if (!isoString) return "UNKNOWN DATE";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ maxWidth: "800px", margin: "auto", padding: "16px" }}>
      <div className="screen-head" style={{ marginBottom: "24px" }}>
        <div>
          <p className="eyebrow">Digitization Archive</p>
          <h1>Scan History</h1>
        </div>
        <span className="num subtle" style={{ fontSize: "14px", color: "var(--muted)" }}>
          {history.length} Scan{history.length !== 1 ? "s" : ""} Total
        </span>
      </div>

      {loading && (
        <div style={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
          <div className="process-ring"></div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "16px",
            background: "rgba(255, 89, 89, 0.1)",
            color: "#e74c3c",
            borderRadius: "12px",
            border: "1px solid rgba(231, 76, 60, 0.3)",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          Error loading history: {error}
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "40vh",
            color: "var(--muted)",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--fg-2)" }}>
              No scans yet
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "14px" }}>
              Scan a ward document register to see history logs here.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {history.map((item) => {
          const isExpanded = expandedId === item.submission_id;
          return (
            <div
              key={item.submission_id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                overflow: "hidden",
                background: "var(--bg)",
                transition: "box-shadow 0.2s ease",
                boxShadow: isExpanded ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {/* Card Header (Tappable) */}
              <div
                onClick={() => toggleExpand(item.submission_id)}
                style={{
                  padding: "16px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: isExpanded ? "rgba(255,255,255,0.02)" : "transparent",
                  borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--fg)" }}>
                    Ward {item.ward}
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    {formatDate(item.created_at)} &bull; {item.rows_written} record{item.rows_written !== 1 ? "s" : ""} synced
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "#d1fae5",
                      color: "#065f46",
                      border: "1px solid #10b981",
                      fontWeight: 600,
                    }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      color: "var(--muted)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: "16px", background: "rgba(255,255,255,0.01)" }}>
                  <div style={{ marginBottom: "8px", fontSize: "12px", color: "var(--muted)" }}>
                    Submission ID: <code style={{ fontFamily: "monospace" }}>{item.submission_id}</code>
                  </div>
                  <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "var(--border)", borderBottom: "1px solid var(--border)" }}>
                          {item.columns.map((col) => (
                            <th
                              key={col}
                              style={{
                                padding: "10px 14px",
                                fontWeight: 600,
                                color: "var(--fg)",
                                borderBottom: "1px solid var(--border)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {item.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: idx === item.rows.length - 1 ? "none" : "1px solid var(--border)",
                              background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                            }}
                          >
                            {item.columns.map((col) => (
                              <td
                                key={col}
                                style={{
                                  padding: "10px 14px",
                                  color: "var(--fg-2)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row[col] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}