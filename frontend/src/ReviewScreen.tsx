import "./ReviewScreen.css";

interface ReviewScreenProps {
  capturedImage: string;
  onDiscard: () => void;
  onProceed: () => void;
}

export default function ReviewScreen({
  capturedImage,
  onDiscard,
  onProceed,
}: ReviewScreenProps) {
  return (
    <div className="review-screen">

      {/* ================= HEADER ================= */}

      <header className="review-header-bar">

        <button
          className="review-header-button"
          type="button"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">
            menu
          </span>
        </button>

        <div className="review-brand">
          <h1>MCL PATR</h1>
        </div>

        <button
          className="review-header-button"
          type="button"
          aria-label="Account"
        >
          <span className="material-symbols-outlined">
            account_circle
          </span>
        </button>

      </header>


      {/* ================= MAIN CONTENT ================= */}

      <main className="review-main">

        {/* ================= IMAGE VIEWPORT ================= */}

        <section className="review-viewport">

          {/* Viewport Header */}

          <div className="review-viewport-header">

            <div className="review-status">

              <div className="review-status-dot" />

              <span>
                Awaiting Confirmation
              </span>

            </div>

          </div>


          {/* Image Area */}

          <div className="review-image-area">

            {/* Reticle Corners */}

            <div className="review-reticle review-reticle-tl" />
            <div className="review-reticle review-reticle-tr" />
            <div className="review-reticle review-reticle-bl" />
            <div className="review-reticle review-reticle-br" />


            {/* REAL CAPTURED IMAGE */}

            <img
              src={capturedImage}
              alt="Captured document awaiting confirmation"
              className="review-document-image"
            />


            {/* Center Crosshair */}

            <div className="review-crosshair">

              <div className="review-crosshair-vertical" />

              <div className="review-crosshair-horizontal" />

            </div>

          </div>

        </section>


        {/* ================= ACTION PANEL ================= */}

        <section className="review-actions">

          {/* DISCARD */}

          <button
            className="review-action-button review-discard"
            type="button"
            onClick={onDiscard}
          >

            <span
              className="material-symbols-outlined review-action-icon"
              style={{
                fontVariationSettings: "'FILL' 1",
              }}
            >
              close
            </span>

            <span className="review-action-label">
              Discard
            </span>

          </button>


          {/* PROCEED */}

          <button
            className="review-action-button review-proceed"
            type="button"
            onClick={onProceed}
          >

            <span
              className="material-symbols-outlined review-action-icon"
              style={{
                fontVariationSettings: "'FILL' 1",
              }}
            >
              check
            </span>

            <span className="review-action-label">
              Proceed
            </span>

          </button>

        </section>

      </main>

    </div>
  );
}