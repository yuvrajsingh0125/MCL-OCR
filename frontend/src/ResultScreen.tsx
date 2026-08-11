import "./ResultScreen.css"

interface ResultScreenProps {
  data: Record<string, string | null>
  error?: string
  onProcessAnother?: () => void
}

const FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  subject: 'Subject',
  summary: 'Summary',
  department: 'Department',
  sender_name: 'Sender Name',
  sender_contact: 'Sender Contact',
  receiver: 'Receiver',
  reference_number: 'Reference Number',
}

export default function ResultScreen({ data, error, onProcessAnother }: ResultScreenProps) {
  return (
    <div className="result-screen">
      <header className="result-header">
        <button className="result-header-button" type="button" aria-label="Open menu">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="result-brand">MCL PATR</h1>
        <button className="result-header-button" type="button" aria-label="Account">
          <span className="material-symbols-outlined">account_circle</span>
        </button>
      </header>

      <main className="result-main">
        <section className="result-heading">
          <div>
            <h2>Extracted Data</h2>
            <p>Document successfully processed.</p>
          </div>
        </section>

        {error && (
          <div className="result-error">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        <section className="ocr-canvas">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #2a2c2d' }}>
              <p style={{ color: '#8b919d', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                {FIELD_LABELS[key] ?? key}
              </p>
              <p style={{ color: value ? '#e2e2e2' : '#414751', margin: 0, fontSize: '15px' }}>
                {value ?? '—'}
              </p>
            </div>
          ))}
        </section>

        {onProcessAnother && (
          <div className="result-footer">
            <button type="button" className="process-another-button" onClick={onProcessAnother}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                add_a_photo
              </span>
              Process Another Document
            </button>
          </div>
        )}
      </main>
    </div>
  )
}