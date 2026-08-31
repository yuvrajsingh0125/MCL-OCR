import { useEffect, useState } from "react";

import CameraScreen from "./screens/CameraScreen";
import ProcessingScreen from "./screens/ProcessingScreen";
import type { ProcessingStage } from "./screens/ProcessingScreen";
import ResultScreen from "./screens/ResultScreen";
import HistoryScreen from "./screens/HistoryScreen";

import TopNav from "./components/TopNav";
import DockNavigation from "./components/DockNavigation";

type Screen = "camera" | "processing" | "result" | "history";

const INITIAL_STAGES: ProcessingStage[] = [
  { id: "preprocess", label: "Preprocessing image", status: "pending" },
  { id: "ocr", label: "Running OCR", status: "pending" },
  { id: "extraction", label: "Extracting ward table", status: "pending" },
  { id: "sheets", label: "Syncing to Google Sheets", status: "pending" },
];

interface ExtractedData {
  status: string;
  submission_id: string;
  ward: string;
  columns: string[];
  rows_written: number;
  rows: Record<string, string | null>[];
  error_message?: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("camera");
  const [stages, setStages] = useState<ProcessingStage[]>(INITIAL_STAGES);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<string>("scan");
  const [cameraSessionKey, setCameraSessionKey] = useState(0);

  useEffect(() => {
    if (!error) return;

    const timer = window.setTimeout(() => {
      setError(null);
      setStages(INITIAL_STAGES);
      setProgressMessage(null);
      setActiveNavItem("scan");
      setScreen("camera");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [error]);

  const handleNavigation = (tab: string) => {
    setActiveNavItem(tab);

    if (tab === "home") {
      setScreen("processing");
      setActiveNavItem("home");
    } else if (tab === "scan") {
      setScreen("camera");
      setActiveNavItem("scan");
    } else if (tab === "history") {
      setScreen("history");
    }
  };

  const updateStage = (id: string, status: ProcessingStage["status"], message?: string) => {
    setStages((previous) =>
      previous.map((stage) =>
        stage.id === id ? { ...stage, status, message } : stage
      )
    );
  };

  const handleReset = () => {
    setStages(INITIAL_STAGES);
    setExtractedData(null);
    setProgressMessage(null);
    setError(null);
    setActiveNavItem("scan");
    setCameraSessionKey((previous) => previous + 1);
    setScreen("camera");
  };

  const handleProceed = async (files: Blob[], meta?: { wardNumber: string; employabilityStatus: string }) => {
    if (!files.length) return;

    setStages(INITIAL_STAGES);
    setProgressMessage("Starting pipeline...");
    setError(null);
    setScreen("processing");
    setActiveNavItem("scan");

    const formData = new FormData();
    files.forEach((blob, index) => {
      const ext = blob.type === "application/pdf" ? "pdf" : "jpg";
      const fileName = `document-${index + 1}.${ext}`;
      formData.append("files", blob, fileName);
    });

    // Append metadata fields if provided
    if (meta?.wardNumber) formData.append("ward_number", meta.wardNumber);
    if (meta?.employabilityStatus) formData.append("employability_status", meta.employabilityStatus);

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
      
      // 1. Initialize
      setProgressMessage("Initializing document processing...");
      updateStage("preprocess", "processing", "Uploading and splitting files...");
      
      const response = await fetch(`${apiUrl}/upload-ward/initialize/`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorDetail = await response.json().catch(() => ({ detail: "Initialization failed" }));
        throw new Error(errorDetail.detail || `Server error: ${response.status}`);
      }

      const initData = await response.json();
      const { submission_id, total_chunks, chunks } = initData as {
        submission_id: string;
        total_chunks: number;
        chunks: Array<{
          chunk_index: number;
          type: "pdf" | "image";
          filename: string;
          original_name: string;
          start_page: number;
          end_page: number;
        }>;
      };
      
      setProgressMessage(`Initialized. Found ${total_chunks} chunk(s) to process.`);
      updateStage("preprocess", "complete");

      let processedChunksCount = 0;
      let finalStatus = "complete";
      let runningWard: string | null = null;

      // 2. Loop Chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkNum = i + 1;
        
        setProgressMessage(`Processing chunk ${chunkNum} of ${total_chunks}...`);
        
        // Reset stages for this chunk
        updateStage("ocr", "processing", `[Chunk ${chunkNum}/${total_chunks}] Running OCR...`);
        updateStage("extraction", "pending");
        updateStage("sheets", "pending");

        const chunkResponse = await fetch(`${apiUrl}/upload-ward/process-chunk/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submission_id,
            chunk_index: chunk.chunk_index,
            type: chunk.type,
            filename: chunk.filename,
            original_name: chunk.original_name,
            current_ward: runningWard,
          }),
        });

        if (!chunkResponse.ok) {
          const errorDetail = await chunkResponse.json().catch(() => ({ detail: `Chunk ${chunkNum} failed` }));
          const errMsg = errorDetail.detail || `Server error processing chunk ${chunkNum}: ${chunkResponse.status}`;
          console.error(errMsg);
          
          if (processedChunksCount > 0) {
            finalStatus = "partial_complete";
            setProgressMessage(`Chunk ${chunkNum} failed. Finalizing partial results...`);
            updateStage("ocr", "error", errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }

        const chunkResult = await chunkResponse.json() as {
          chunk_index: number;
          ward: string | null;
          columns: string[];
          rows: Record<string, string | null>[];
          rows_written: number;
        };
        processedChunksCount++;

        if (!runningWard && chunkResult.ward && chunkResult.ward !== "Unknown") {
          runningWard = chunkResult.ward;
        }
        
        updateStage("ocr", "complete");
        updateStage("extraction", "processing", `[Chunk ${chunkNum}/${total_chunks}] Extracting tables...`);
        updateStage("extraction", "complete");
        updateStage("sheets", "processing", `[Chunk ${chunkNum}/${total_chunks}] Syncing to Sheets...`);
        updateStage("sheets", "complete", `Synced ${chunkResult.rows_written} row(s)`);
      }

      // 3. Finalize
      setProgressMessage("Finalizing submission...");
      const finalizeResponse = await fetch(`${apiUrl}/upload-ward/finalize/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submission_id,
          status: finalStatus,
        }),
      });

      if (!finalizeResponse.ok) {
        const errorDetail = await finalizeResponse.json().catch(() => ({ detail: "Finalize failed" }));
        throw new Error(errorDetail.detail || `Server error during finalization: ${finalizeResponse.status}`);
      }

      const finalResult = await finalizeResponse.json() as ExtractedData;
      
      updateStage("preprocess", "complete");
      updateStage("ocr", "complete");
      updateStage("extraction", "complete");
      updateStage("sheets", "complete");

      setExtractedData(finalResult);
      setScreen("result");

    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
      setProgressMessage(`Error: ${message}`);
      
      setStages((prev) =>
        prev.map((stage) =>
          stage.status === "processing" || stage.status === "pending"
            ? { ...stage, status: "error", message: stage.status === "processing" ? message : undefined }
            : stage
        )
      );
    }
  };

  return (
    <div className="app">
      <TopNav />
      <main className="viewport" id="content">
        <div className={`screen ${screen === "camera" ? "active" : ""}`} id="capture" data-od-id="capture-screen">
          <CameraScreen key={cameraSessionKey} onAccept={(imgs, meta) => handleProceed(imgs, meta)} />
        </div>
        <div className={`screen ${screen === "processing" ? "active" : ""}`} id="processing" data-od-id="processing-screen">
          <ProcessingScreen
            stages={stages}
            session={{ source: "Portal", timestamp: new Date().toLocaleString() }}
            onAbort={handleReset}
            error={error}
            progressMessage={progressMessage}
          />
        </div>
        <div className={`screen ${screen === "history" ? "active" : ""}`} id="history" data-od-id="history-screen">
          <HistoryScreen />
        </div>
        <div className={`screen ${screen === "result" ? "active" : ""}`} id="result" data-od-id="result-screen">
          {extractedData && (
            <ResultScreen data={extractedData} onProcessAnother={handleReset} />
          )}
        </div>
      </main>
      <DockNavigation currentTab={activeNavItem} onTabChange={handleNavigation} />
    </div>
  );
}