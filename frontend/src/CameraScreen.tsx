import { useEffect, useRef, useState } from "react";
import "./CameraScreen.css";

interface CameraScreenProps {
  onCapture: (imageDataUrl: string, blob: Blob) => void
}

export default function CameraScreen({ onCapture }: CameraScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [cameraError, setCameraError] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // =========================
  // START CAMERA
  // =========================

  const startCamera = async (): Promise<void> => {
    try {
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Camera access is not supported by this browser."
        );
        return;
      }

      const stream: MediaStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
            width: {
              ideal: 1920,
            },
            height: {
              ideal: 1080,
            },
          },
          audio: false,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await videoRef.current.play().catch(() => {
          // Browser may require user interaction before playback.
        });
      }
    } catch (error: unknown) {
      console.error("Camera access error:", error);

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          setCameraError(
            "Camera permission was denied. Please allow camera access."
          );
        } else if (error.name === "NotFoundError") {
          setCameraError(
            "No camera was found on this device."
          );
        } else if (error.name === "NotReadableError") {
          setCameraError(
            "The camera is already being used by another application."
          );
        } else {
          setCameraError(
            "Camera access is unavailable. Please check your camera permissions."
          );
        }
      } else {
        setCameraError(
          "Camera access is unavailable. Please allow camera permission."
        );
      }
    }
  };

  // =========================
  // STOP CAMERA
  // =========================

  const stopCamera = (): void => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // =========================
  // CAPTURE IMAGE
  // =========================

  const captureImage = (): void => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    // Make sure the camera has produced a valid frame.
    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setCameraError(
        "Camera is not ready yet. Please wait a moment and try again."
      );
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError(
        "Unable to capture the image."
      );
      return;
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const image: string = canvas.toDataURL(
      "image/jpeg",
      0.95
    );

    setCapturedImage(image);

    stopCamera();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const blob = await fetch(url).then(r => r.blob())
    stopCamera()
    onCapture(url, blob)
  }

  // =========================
  // RETAKE IMAGE
  // =========================

  const retakeImage = async (): Promise<void> => {
    setCapturedImage(null);

    await startCamera();
  };

  // =========================
  // ACCEPT IMAGE
  // =========================

  const acceptImage = async (): Promise<void> => {
    if (!capturedImage) return
    const blob = await fetch(capturedImage).then(r => r.blob())
    onCapture(capturedImage, blob)
  };

  return (
    <div className="mcl-app">

      {/* ================= HEADER ================= */}

      <header className="mcl-header">

        <button
          className="header-icon-button"
          aria-label="Open menu"
          type="button"
        >
          <span className="material-symbols-outlined">
            menu
          </span>
        </button>

        <div className="mcl-brand">

          <h1>MCL PATR</h1>

          <span>
            Document Digitization
          </span>

        </div>

        <button
          className="header-icon-button"
          aria-label="Account"
          type="button"
        >
          <span className="material-symbols-outlined">
            account_circle
          </span>
        </button>

      </header>


      {/* ================= CAMERA AREA ================= */}

      <main className="camera-container">

        {!capturedImage ? (

          <>
            {/* REAL CAMERA */}

            <video
              ref={videoRef}
              className="camera-video"
              autoPlay
              playsInline
              muted
            />

            {/* DARK OVERLAY */}

            <div className="camera-overlay" />


            {/* CAMERA ERROR */}

            {cameraError && (
              <div className="camera-error">

                <span className="material-symbols-outlined">
                  videocam_off
                </span>

                <p>
                  {cameraError}
                </p>

                <button
                  type="button"
                  onClick={startCamera}
                >
                  Try Again
                </button>

              </div>
            )}


            {/* DOCUMENT GUIDE */}

            <div className="document-guide">

              <div className="corner corner-tl" />
              <div className="corner corner-tr" />
              <div className="corner corner-bl" />
              <div className="corner corner-br" />


              {/* SCANNER LINE */}

              <div className="scanner-line" />


              {/* CENTER CROSSHAIR */}

              <div className="crosshair">

                <div />

                <span />

              </div>


              {/* CAMERA INFORMATION */}

              <div className="camera-readout">

                <span>
                  ISO: AUTO
                </span>

                <span>
                  EXP: 0.0
                </span>

                <strong>
                  ALIGN DOC
                </strong>

              </div>

            </div>


            {/* CAMERA CONTROL */}

            <div className="camera-controls">

              <button
                className="upload-button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload from gallery"
                type="button"
              >
                <span className="material-symbols-outlined">
                  upload_file
                </span>
              </button>

              <button
                className="capture-button"
                onClick={captureImage}
                aria-label="Capture document"
                type="button"
              >
                <div className="capture-inner">
                  <span className="material-symbols-outlined">
                    photo_camera
                  </span>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

            </div>

          </>

        ) : (

          /* ================= IMAGE REVIEW ================= */

          <div className="review-container">

            <img
              src={capturedImage}
              alt="Captured document"
              className="captured-image"
            />

            <div className="review-overlay" />


            <div className="review-header">

              <span>
                Review Document
              </span>

            </div>


            <div className="review-actions">

              {/* RETAKE */}

              <button
                className="review-button retake"
                onClick={retakeImage}
                type="button"
                aria-label="Retake document"
              >

                <span className="material-symbols-outlined">
                  close
                </span>

                <span>
                  Retake
                </span>

              </button>


              {/* ACCEPT */}

              <button
                className="review-button accept"
                onClick={acceptImage}
                type="button"
                aria-label="Use captured document"
              >

                <span className="material-symbols-outlined">
                  check
                </span>

                <span>
                  Use
                </span>

              </button>

            </div>

          </div>

        )}


        {/* HIDDEN CANVAS */}

        <canvas
          ref={canvasRef}
          style={{
            display: "none",
          }}
        />

      </main>


      {/* ================= MOBILE NAVIGATION ================= */}

      <nav className="bottom-navigation">

        <button
          className="nav-item active"
          type="button"
        >

          <span className="material-symbols-outlined">
            photo_camera
          </span>

          <span>
            Capture
          </span>

        </button>


        <button
          className="nav-item"
          type="button"
        >

          <span className="material-symbols-outlined">
            inventory_2
          </span>

          <span>
            Archive
          </span>

        </button>


        <button
          className="nav-item"
          type="button"
        >

          <span className="material-symbols-outlined">
            sync
          </span>

          <span>
            Queue
          </span>

        </button>


        <button
          className="nav-item"
          type="button"
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