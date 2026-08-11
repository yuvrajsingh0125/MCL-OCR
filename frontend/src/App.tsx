import { useState, useRef } from 'react'
import CameraScreen from './CameraScreen'
import ReviewScreen from './ReviewScreen'
import ProcessingScreen from './ProcessingScreen'
import type { ProcessingStage } from './ProcessingScreen'
import ResultScreen from './ResultScreen'

type Screen = 'camera' | 'review' | 'processing' | 'result'

const INITIAL_STAGES: ProcessingStage[] = [
  { id: 'upload', label: 'Uploading Document', status: 'pending' },
  { id: 'ocr', label: 'Mistral OCR', status: 'pending' },
  { id: 'claude', label: 'Claude Extraction', status: 'pending' },
  { id: 'done', label: 'Finalizing', status: 'pending' },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('camera')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [stages, setStages] = useState<ProcessingStage[]>(INITIAL_STAGES)
  const [extractedData, setExtractedData] = useState<Record<string, string | null> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const capturedBlob = useRef<Blob | null>(null)

  const updateStage = (id: string, status: ProcessingStage['status'], message?: string) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, status, message } : s))
  }

  const handleCapture = (imageDataUrl: string, blob: Blob) => {
    setCapturedImage(imageDataUrl)
    capturedBlob.current = blob
    setScreen('review')
  }

  const handleDiscard = () => {
    setCapturedImage(null)
    capturedBlob.current = null
    setStages(INITIAL_STAGES)
    setExtractedData(null)
    setError(null)
    setScreen('camera')
  }

  const handleProceed = async () => {
    if (!capturedBlob.current) return

    setStages(INITIAL_STAGES)
    setError(null)
    setScreen('processing')

    const formData = new FormData()
    formData.append('file', capturedBlob.current, 'document.jpg')

    try {
      updateStage('upload', 'processing', 'Uploading document...')
      // small delay so user sees the stage
      await new Promise(r => setTimeout(r, 600))
      updateStage('upload', 'complete')

      updateStage('ocr', 'processing', 'Extracting text from image...')

      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/upload/`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const data = await res.json()

      updateStage('ocr', 'complete')
      updateStage('claude', 'processing', 'Structuring fields...')
      await new Promise(r => setTimeout(r, 400))
      updateStage('claude', 'complete')

      updateStage('done', 'processing', 'Saving...')
      await new Promise(r => setTimeout(r, 300))
      updateStage('done', 'complete')

      setExtractedData(data.extracted_data)
      setScreen('result')

    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      updateStage('upload', 'error', message)
      updateStage('ocr', 'error')
      updateStage('claude', 'error')
      updateStage('done', 'error')
    }
  }

  if (screen === 'camera') {
    return <CameraScreen onCapture={handleCapture} />
  }

  if (screen === 'review' && capturedImage) {
    return (
      <ReviewScreen
        capturedImage={capturedImage}
        onDiscard={handleDiscard}
        onProceed={handleProceed}
      />
    )
  }

  if (screen === 'processing') {
    return (
      <ProcessingScreen
        stages={stages}
        session={{ source: 'Camera', timestamp: new Date().toLocaleString() }}
        onAbort={handleDiscard}
      />
    )
  }

  if (screen === 'result' && extractedData) {
    return (
      <ResultScreen
        data={extractedData}
        error={error ?? undefined}
        onProcessAnother={handleDiscard}
      />
    )
  }

  return null
}