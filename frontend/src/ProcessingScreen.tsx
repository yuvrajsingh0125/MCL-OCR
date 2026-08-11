import "./ProcessingScreen.css";

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

  /**
   * Called when the user chooses to stop processing.
   */
  onAbort?: () => void;

  /**
   * Optional navigation callbacks.
   */
  onCapture?: () => void;
  onArchive?: () => void;
  onSettings?: () => void;
}

export default function ProcessingScreen({
  stages,
  session,
  onAbort,
  onCapture,
  onArchive,
  onSettings,
}: ProcessingScreenProps) {
  return (
    <div className="processing-screen">

      {/* =========================================
          HEADER
          ========================================= */}

      <header className="processing-header">

        <button
          className="processing-header-button"
          type="button"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">
            menu
          </span>
        </button>

        <div className="processing-brand">
          MCL PATR
        </div>

        <button
          className="processing-header-button"
          type="button"
          aria-label="Account"
        >
          <span className="material-symbols-outlined">
            account_circle
          </span>
        </button>

      </header>


      {/* =========================================
          DESKTOP CONTENT WRAPPER
          ========================================= */}

      <div className="processing-layout">

        {/* =========================================
            DESKTOP NAVIGATION
            ========================================= */}

        <aside className="processing-sidebar">

          <div className="processing-sidebar-title">
            Administration
          </div>

          <nav className="processing-sidebar-nav">

            <button
              type="button"
              className="processing-nav-item"
            >
              <span className="material-symbols-outlined">
                dashboard
              </span>

              <span>
                Dashboard
              </span>
            </button>


            <button
              type="button"
              className="processing-nav-item active"
            >
              <span className="material-symbols-outlined">
                description
              </span>

              <span>
                Document Logs
              </span>
            </button>


            <button
              type="button"
              className="processing-nav-item"
            >
              <span className="material-symbols-outlined">
                group
              </span>

              <span>
                User Management
              </span>
            </button>


            <button
              type="button"
              className="processing-nav-item"
            >
              <span className="material-symbols-outlined">
                terminal
              </span>

              <span>
                Technical Logs
              </span>
            </button>


            <button
              type="button"
              className="processing-nav-item"
            >
              <span className="material-symbols-outlined">
                settings_ethernet
              </span>

              <span>
                System Status
              </span>
            </button>

          </nav>

        </aside>


        {/* =========================================
            MAIN
            ========================================= */}

        <main className="processing-main">

          {/* Page heading */}

          <header className="processing-page-header">

            <h1>
              Pipeline Status
            </h1>

            <p>
              Real-time processing visualization.
            </p>

          </header>


          {/* =========================================
              CONTENT GRID
              ========================================= */}

          <div className="processing-content-grid">


            {/* =====================================
                PIPELINE
                ===================================== */}

            <section className="pipeline-card">

              <h2>
                Active Sequence
              </h2>


              <div className="pipeline">

                {stages.map((stage, index) => (

                  <PipelineStage
                    key={stage.id}
                    stage={stage}
                    isLast={index === stages.length - 1}
                  />

                ))}

              </div>

            </section>


            {/* =====================================
                SIDE INFORMATION
                ===================================== */}

            <section className="processing-side">


              {/* Session information */}

              <div className="session-card">

                <h3>
                  Session Info
                </h3>

                <div className="session-details">

                  {session?.id && (
                    <SessionRow
                      label="ID"
                      value={session.id}
                      mono
                    />
                  )}


                  {session?.source && (
                    <SessionRow
                      label="Source"
                      value={session.source}
                    />
                  )}


                  {session?.timestamp && (
                    <SessionRow
                      label="Timestamp"
                      value={session.timestamp}
                    />
                  )}


                  {typeof session?.systemLoad === "number" && (
                    <SessionRow
                      label="System Load"
                      value={`${session.systemLoad}%`}
                      icon="memory"
                      highlighted
                    />
                  )}

                </div>

              </div>


              {/* Abort */}

              {onAbort && (
                <div className="processing-actions">

                  <button
                    type="button"
                    className="abort-button"
                    onClick={onAbort}
                  >

                    <span className="material-symbols-outlined">
                      cancel
                    </span>

                    <span>
                      Abort Process
                    </span>

                  </button>

                </div>
              )}

            </section>

          </div>

        </main>

      </div>


      {/* =========================================
          MOBILE NAVIGATION
          ========================================= */}

      <nav className="processing-mobile-nav">

        <button
          type="button"
          className="mobile-nav-item"
          onClick={onCapture}
        >
          <span className="material-symbols-outlined">
            photo_camera
          </span>

          <span>
            Capture
          </span>
        </button>


        <button
          type="button"
          className="mobile-nav-item"
          onClick={onArchive}
        >
          <span className="material-symbols-outlined">
            inventory_2
          </span>

          <span>
            Archive
          </span>
        </button>


        <button
          type="button"
          className="mobile-nav-item active"
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontVariationSettings: "'FILL' 1",
            }}
          >
            sync
          </span>

          <span>
            Queue
          </span>
        </button>


        <button
          type="button"
          className="mobile-nav-item"
          onClick={onSettings}
        >
          <span className="material-symbols-outlined">
            settings
          </span>

          <span>
            Settings
          </span>
        </button>

      </nav>

    </div>
  );
}


/* =========================================
   PIPELINE STAGE
   ========================================= */

interface PipelineStageProps {
  stage: ProcessingStage;
  isLast: boolean;
}

function PipelineStage({
  stage,
  isLast,
}: PipelineStageProps) {

  const isComplete = stage.status === "complete";
  const isProcessing = stage.status === "processing";
  const isError = stage.status === "error";
  const isPending = stage.status === "pending";

  return (
    <div
      className={[
        "pipeline-stage",
        isProcessing ? "processing" : "",
        isComplete ? "complete" : "",
        isError ? "error" : "",
        isPending ? "pending" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >

      {/* Connector */}

      {!isLast && (
        <div className="pipeline-connector" />
      )}


      {/* Status indicator */}

      <div className="pipeline-indicator">

        {isComplete && (
          <span className="material-symbols-outlined">
            check
          </span>
        )}

        {isProcessing && (
          <span className="pipeline-processing-dot" />
        )}

        {isError && (
          <span className="material-symbols-outlined">
            close
          </span>
        )}

      </div>


      {/* Stage content */}

      <div className="pipeline-stage-content">

        {isProcessing ? (

          <div className="pipeline-active-card">

            <span className="pipeline-stage-title">
              {stage.label}
            </span>

            <div className="pipeline-processing-status">

              <span className="material-symbols-outlined processing-spin">
                sync
              </span>

              <span>
                {stage.message || "Processing..."}
              </span>

            </div>

            {/*

              IMPORTANT:

              This does NOT use a fake processing image,
              fake percentage, or fake progress value.

              If the backend later exposes an actual
              OpenCV preview/result, render it here.

            */}

            {stage.id === "opencv" && (
              <div className="opencv-preview">

                <span>
                  OpenCV processing
                </span>

              </div>
            )}

          </div>

        ) : (

          <div className="pipeline-stage-text">

            <span className="pipeline-stage-title">
              {stage.label}
            </span>

            <span className="pipeline-stage-status">

              {isComplete && "Status: Complete"}

              {isPending && "Status: Pending"}

              {isError && (
                <>
                  Status: Error
                  {stage.message
                    ? ` — ${stage.message}`
                    : ""}
                </>
              )}

            </span>

          </div>

        )}

      </div>

    </div>
  );
}


/* =========================================
   SESSION ROW
   ========================================= */

interface SessionRowProps {
  label: string;
  value: string;
  mono?: boolean;
  icon?: string;
  highlighted?: boolean;
}

function SessionRow({
  label,
  value,
  mono = false,
  icon,
  highlighted = false,
}: SessionRowProps) {

  return (
    <div className="session-row">

      <span className="session-label">
        {label}
      </span>

      <span
        className={[
          "session-value",
          mono ? "mono" : "",
          highlighted ? "highlighted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >

        {icon && (
          <span className="material-symbols-outlined session-icon">
            {icon}
          </span>
        )}

        {value}

      </span>

    </div>
  );
}