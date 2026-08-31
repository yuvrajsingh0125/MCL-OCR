import { useRef, useState, useEffect, useCallback } from "react";

interface CameraScreenProps {
  onAccept: (images: Blob[], meta: { wardNumber: string; employabilityStatus: string }) => void | Promise<void>;
}

interface CapturedImage {
  id: string;
  blob: Blob;
  previewUrl: string;
}

interface ImageCaptureLike {
  takePhoto: () => Promise<Blob>;
}

type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike;

interface WindowWithImageCapture extends Window {
  ImageCapture?: ImageCaptureConstructor;
}

const EMPLOYABILITY_OPTIONS = [
  "Permanent",
  "DC Rate",
  "Sanctioned",
  "Outsourced",
];

export default function CameraScreen({ onAccept }: CameraScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const imageCaptureRef = useRef<ImageCaptureLike | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const imagesRef = useRef<CapturedImage[]>([]);

  const [images, setImages] = useState<CapturedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanHint, setShowScanHint] = useState(true);
  const [uploadNotice, setUploadNotice] = useState("");
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  // Metadata fields
  const [wardNumber, setWardNumber] = useState("");
  const [employabilityStatus, setEmployabilityStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setShowScanHint(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!uploadNotice) return;
    const timer = window.setTimeout(() => setUploadNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [uploadNotice]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const resetCollection = useCallback(() => {
    setImages((previous) => {
      previous.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const addImage = useCallback((blob: Blob) => {
    const previewUrl = URL.createObjectURL(blob);
    setImages((previous) => [
      ...previous,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, blob, previewUrl },
    ]);
    setUploadNotice("Image added!");
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((previous) => {
      const target = previous.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((item) => item.id !== id);
    });
  }, []);

  // Camera setup
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    async function setupCamera() {
      try {
        setCameraError("");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable.");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        activeStream = stream;

        const track = stream.getVideoTracks()[0];
        if (!track) throw new Error("No camera video track available.");
        cameraTrackRef.current = track;

        const win = window as WindowWithImageCapture;
        if (win.ImageCapture) {
          try { imageCaptureRef.current = new win.ImageCapture(track); }
          catch { imageCaptureRef.current = null; }
        }

        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        if (cancelled) return;
        setCameraError(error instanceof Error ? error.message : "Camera access is unavailable.");
      }
    }

    void setupCamera();

    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      cameraTrackRef.current = null;
      imageCaptureRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => { if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current); };
  }, []);

  const captureFrame = useCallback(async () => {
    const track = cameraTrackRef.current;
    if (!track || track.readyState !== "live") { setCameraError("Camera is not ready."); return; }

    try {
      let blob: Blob | null = null;
      if (imageCaptureRef.current) {
        try { blob = await imageCaptureRef.current.takePhoto(); }
        catch { /* fallback */ }
      }

      if (!blob) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) throw new Error("Camera capture is unavailable.");
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to create capture canvas.");
        context.drawImage(video, 0, 0, width, height);
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
      }

      if (!blob) throw new Error("Unable to capture image.");
      addImage(blob);
      setCameraError("");
      setFocusPoint(null);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Unable to capture image.");
    }
  }, [addImage]);

  const triggerFocus = useCallback((x: number, y: number) => {
    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    setFocusPoint({ x, y });
    const track = cameraTrackRef.current;
    if (track && typeof track.applyConstraints === "function") {
      void track.applyConstraints({
        advanced: [{ focusMode: "continuous", exposureMode: "continuous" } as unknown as MediaTrackConstraintSet]
      }).catch(() => {});
    }
    focusTimerRef.current = window.setTimeout(() => setFocusPoint(null), 700);
  }, []);

  useEffect(() => {
    const handleCaptureEvent = () => {
      const rect = videoRef.current?.getBoundingClientRect();
      triggerFocus(rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
      window.setTimeout(() => void captureFrame(), 200);
    };
    window.addEventListener("trigger-camera-capture", handleCaptureEvent);
    return () => window.removeEventListener("trigger-camera-capture", handleCaptureEvent);
  }, [captureFrame, triggerFocus]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) { setCameraError("Please select a valid image file."); return; }
    valid.forEach((f) => addImage(f));
    setCameraError("");
    event.target.value = "";
  };

  const handleProceed = async () => {
    if (!images.length || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onAccept(images.map((item) => item.blob), { wardNumber, employabilityStatus });
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Unable to submit the document.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScannerTap = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    triggerFocus(event.clientX - rect.left, event.clientY - rect.top);
  };

  const metaFieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--fg)",
    fontSize: "14px",
    fontWeight: 500,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div className="capture-wrap">
      <div className="screen-head" style={{ position: "relative", zIndex: 10 }}>
        <div>
          <p className="eyebrow">DOCUMENT DIGITIZATION</p>
          <h1>SCAN</h1>
        </div>
      </div>

      {uploadNotice && (
        <div
          aria-live="polite"
          style={{
            margin: "0 16px 8px", padding: "8px 12px", borderRadius: "8px",
            background: "var(--success-bg)", border: "1px solid var(--success)", color: "var(--fg)",
            fontSize: "14px", fontWeight: 700, textAlign: "center", zIndex: 30,
            position: "relative", boxShadow: "var(--shadow-sm)",
          }}
        >
          {uploadNotice}
        </div>
      )}

      {/* Metadata fields */}
      <div
        style={{
          margin: "0 16px 12px", padding: "14px 16px", borderRadius: "12px",
          background: "var(--surface-warm)", border: "1px solid var(--border)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          display: "flex", flexDirection: "column", gap: "10px", zIndex: 10, position: "relative",
        }}
      >
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
          Document Metadata
        </p>

        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px", color: "var(--muted)" }}>
              Ward No. <span style={{ color: "var(--meta)" }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Ward 12"
              value={wardNumber}
              onChange={(e) => setWardNumber(e.target.value)}
              style={metaFieldStyle}
            />
          </div>

          <div style={{ flex: 1.4 }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px", color: "var(--muted)" }}>
              Employability Status <span style={{ color: "var(--meta)" }}>(optional)</span>
            </label>
            <select
              value={employabilityStatus}
              onChange={(e) => setEmployabilityStatus(e.target.value)}
              style={{ ...metaFieldStyle, cursor: "pointer" }}
            >
              <option value="">— Select —</option>
              {EMPLOYABILITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Camera viewfinder */}
      <div
        className="scanner"
        data-od-id="scanner"
        onPointerDown={handleScannerTap}
        style={{ overflow: "hidden", position: "relative", cursor: "pointer" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {focusPoint && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute", left: `${focusPoint.x}px`, top: `${focusPoint.y}px`,
              width: "72px", height: "72px", border: "2px solid rgba(255,255,255,0.95)",
              borderRadius: "50%", boxShadow: "0 0 0 2px rgba(0,0,0,0.2),0 0 12px rgba(255,255,255,0.6)",
              transform: "translate(-50%,-50%)", zIndex: 4, pointerEvents: "none",
            }}
          >
            <div style={{ position: "absolute", inset: "18px", border: "2px solid rgba(255,255,255,0.8)", borderRadius: "50%" }} />
          </div>
        )}

        <div className="scanner-grid" style={{ zIndex: 1 }} />
        <i className="bracket tl" style={{ zIndex: 2 }} />
        <i className="bracket tr" style={{ zIndex: 2 }} />
        <i className="bracket bl" style={{ zIndex: 2 }} />
        <i className="bracket br" style={{ zIndex: 2 }} />

        {showScanHint && (
          <div
            className="scan-center"
            style={{ zIndex: 2, background: "color-mix(in oklab,var(--bg) 60%,transparent)", padding: "16px", borderRadius: "12px" }}
          >
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h6" />
            </svg>
            <strong>A4 DETECT</strong>
            <span>Place document inside frame</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="capture-actions" style={{ position: "relative", zIndex: 10 }}>
        <input
          id="camera-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileUpload}
        />

        {images.length === 0 ? (
          <button
            className="btn btn-primary"
            data-od-id="upload-image"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            UPLOAD IMAGE
          </button>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "12px" }}>
              <span className="hint">Review {images.length} page{images.length > 1 ? "s" : ""}</span>
              <button type="button" className="btn btn-secondary" onClick={resetCollection}>Clear</button>
            </div>

            <div
              className="preview-strip"
              aria-live="polite"
              style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px", width: "100%" }}
            >
              {images.map((image, index) => (
                <div
                  key={image.id}
                  onClick={() => setSelectedImage(image.previewUrl)}
                  style={{ position: "relative", width: "calc((100% - 20px) / 3)", minWidth: "88px", maxWidth: "110px", cursor: "pointer" }}
                >
                  <img
                    src={image.previewUrl}
                    alt={`Page ${index + 1}`}
                    style={{ width: "100%", height: "110px", objectFit: "cover", borderRadius: "8px", display: "block" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", gap: "6px" }}>
                    <span className="hint">Page {index + 1}</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "11px" }}
                      onClick={(e) => { e.stopPropagation(); removeImage(image.id); }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", width: "100%" }}>
              <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                Upload Image
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleProceed()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : "Proceed"}
              </button>
            </div>
          </>
        )}

        {cameraError && <div className="review-error" style={{ marginTop: "12px" }}>{cameraError}</div>}

        {selectedImage && (
          <div
            onClick={() => setSelectedImage(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: "relative", width: "min(90vw,420px)", background: "var(--bg)", borderRadius: "12px", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
            >
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                style={{ position: "absolute", top: "10px", right: "10px", border: "none", borderRadius: "50%", background: "var(--surface)", color: "var(--fg)", width: "32px", height: "32px", fontSize: "20px", cursor: "pointer", zIndex: 2 }}
              >
                ×
              </button>
              <img src={selectedImage} alt="Selected document page" style={{ display: "block", width: "100%", maxHeight: "75vh", objectFit: "contain", background: "var(--bg)" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}