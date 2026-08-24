interface ResultScreenProps {
  data: {
    status: string;
    submission_id: string;
    ward: string;
    columns: string[];
    rows_written: number;
    rows: Record<string, string | null>[];
    error_message?: string;
  };
  onProcessAnother: () => void;
}

export default function ResultScreen({ data, onProcessAnother }: ResultScreenProps) {
  const { ward, submission_id, columns, rows, rows_written, status, error_message } = data;
  const isPartial = status === "partial_complete";

  return (
    <div className="result-shell" style={{ maxWidth: "800px", margin: "auto", padding: "16px" }}>
      <div className="screen-head" style={{ marginBottom: "24px" }}>
        <div>
          <p className="eyebrow">Ward Scanner Result</p>
          <h1 style={{ fontSize: "36px", fontWeight: 800, margin: "4px 0" }}>Ward {ward}</h1>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "monospace" }}>
            ID: {submission_id}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          {isPartial ? (
            <span className="status" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706", border: "1px solid #f59e0b" }}>
              Partial Complete
            </span>
          ) : (
            <span className="status" style={{ background: "#d1fae5", color: "#065f46", border: "1px solid #10b981" }}>
              Complete
            </span>
          )}
        </div>
      </div>

      {isPartial && error_message && (
        <div
          style={{
            padding: "16px",
            background: "rgba(245, 158, 11, 0.08)",
            color: "#b45309",
            borderRadius: "12px",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            fontSize: "14px",
            marginBottom: "24px",
            lineHeight: 1.5
          }}
        >
          <strong>⚠️ Warning: Processing Halted Early</strong>
          <p style={{ margin: "6px 0 0", fontSize: "13px", fontFamily: "monospace" }}>{error_message}</p>
        </div>
      )}

      {/* Stats Section */}
      <div
        style={{
          background: "var(--border)",
          padding: "16px",
          borderRadius: "12px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          border: "1px solid var(--border)",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isPartial ? "#f59e0b" : "#10b981"} strokeWidth="2">
          {isPartial ? (
            <>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </>
          ) : (
            <>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </>
          )}
        </svg>
        <strong style={{ fontSize: "16px", color: "var(--fg)" }}>
          {rows_written} record{rows_written !== 1 ? "s" : ""} synced to Google Sheets
        </strong>
      </div>

      {/* Dynamic Table */}
      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "12px", color: "var(--fg)" }}>Extracted Records</h3>
        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            background: "var(--bg)",
          }}
        >
          {rows.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
              No rows extracted
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "var(--border)", borderBottom: "1px solid var(--border)" }}>
                  {columns.map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "12px 16px",
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
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: idx === rows.length - 1 ? "none" : "1px solid var(--border)",
                      background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          padding: "12px 16px",
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
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          className="btn btn-primary"
          onClick={onProcessAnother}
          style={{ padding: "12px 28px", fontWeight: 600, fontSize: "15px" }}
        >
          Scan Another
        </button>
      </div>
    </div>
  );
}