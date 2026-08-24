import { useEffect, useState } from 'react';

export type ProcessingStageStatus =
  | "pending"
  | "processing"
  | "complete"
  | "error";

export interface ProcessingStage {
  id: string;
  label: string;
  status: ProcessingStageStatus;
  message?: string;
}

export interface ProcessingSession {
  id?: string;
  source?: string;
  timestamp?: string;
  systemLoad?: number;
}

interface ProcessingScreenProps {
  stages: ProcessingStage[];
  session?: ProcessingSession;
  onAbort?: () => void;
  error?: string | null;
  progressMessage?: string | null;
}

interface HistoryItem {
  submission_id: string;
  ward: string;
  rows_written: number;
  columns: string[];
  rows: Record<string, string | null>[];
  created_at: string;
  status: string;
}

export default function ProcessingScreen({ stages, error, progressMessage }: ProcessingScreenProps) {
  const [latestDoc, setLatestDoc] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine overall status based on stages
  const isComplete = stages.every(s => s.status === "complete");
  const hasError = stages.some(s => s.status === "error");
  const isIdle = stages.every(s => s.status === "pending");
  const isProcessing = !isComplete && !hasError && !isIdle;

  // Fetch the latest document if we are in idle state
  useEffect(() => {
    if (isIdle) {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
      fetch(`${apiUrl}/history-ward/`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            setLatestDoc(data[0]);
          } else {
            setLatestDoc(null);
          }
        })
        .catch(err => console.error("Failed to load latest ward document:", err))
        .finally(() => setLoading(false));
    }
  }, [isIdle]);

  if (isIdle) {
    if (loading) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
          <div className="process-ring"></div>
        </div>
      );
    }
    
    if (!latestDoc) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', 
          justifyContent: 'center', minHeight: '60vh', color: 'var(--muted)',
          textAlign: 'center', gap: '16px'
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5">
            <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
            <polyline points="14 2 14 8 20 8" />
            <path d="m3 15 2 2 4-4" />
          </svg>
          <div>
            <p style={{margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--fg-2)'}}>No data digitized yet</p>
            <p style={{margin: '8px 0 0', fontSize: '14px'}}>Scan a ward document register to begin.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="result-shell" style={{ maxWidth: '800px', margin: 'auto' }}>
        <div className="screen-head">
          <div>
            <p className="eyebrow">LATEST WARD SCAN</p>
            <h1 style={{fontSize: '32px'}}>Ward {latestDoc.ward}</h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span className="status">COMPLETED</span>
            <span className="card-type" style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {new Date(latestDoc.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="result-grid" style={{marginTop: '28px'}}>
          <div className="result-field">
            <span className="result-label">WARD</span>
            <span className="result-value">Ward {latestDoc.ward}</span>
          </div>
          <div className="result-field">
            <span className="result-label">RECORDS SYNCED</span>
            <span className="result-value">{latestDoc.rows_written} records</span>
          </div>
          <div className="result-field subject">
            <span className="result-label">COLUMNS EXTRACTED</span>
            <span className="result-value">{latestDoc.columns.join(", ")}</span>
          </div>
        </div>
      </div>
    );
  }

  // Active Pipeline View
  return (
    <div className="processing">
      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(255, 89, 89, 0.12)",
            color: "#e74c3c",
            border: "1px solid rgba(231, 76, 60, 0.35)",
            fontSize: "14px",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      <div className="processing-core">
        {isProcessing && <div className="process-ring"></div>}
        <strong id="processing-label">
          {hasError ? "ERROR" : isComplete ? "COMPLETE" : "PROCESSING"}
        </strong>
        <div className="subtle" id="processing-subtle">
          {hasError ? "An error occurred" : isComplete ? "Ward records digitized successfully" : "Running extraction pipeline..."}
        </div>
      </div>

      {progressMessage && (
        <div style={{
          margin: "12px auto 20px",
          padding: "10px 14px",
          borderRadius: "8px",
          background: "var(--border)",
          color: "var(--fg)",
          fontSize: "13px",
          fontFamily: "monospace",
          textAlign: "center",
          border: "1px solid var(--border)",
          maxWidth: "480px",
          width: "100%"
        }}>
          {progressMessage}
        </div>
      )}

      <div className="pipeline" id="pipeline">
        {stages.map((stage, index) => {
          const isDone = stage.status === "complete";
          const isActive = stage.status === "processing" || stage.status === "error";
          
          return (
            <div 
              key={stage.id} 
              className={`step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
            >
              <span className="step-num">STEP 0{index + 1}</span>
              <div>
                <div className="step-name">{stage.label}</div>
                <div className="step-state">
                  {stage.status === 'complete' ? 'COMPLETED' : 
                   stage.status === 'processing' ? 'IN PROGRESS' : 
                   stage.status === 'error' ? 'ERROR' : 'PENDING'}
                </div>
              </div>
              <span className="step-icon">
                {isDone ? '✓' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}