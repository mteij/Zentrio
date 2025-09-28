import { SimpleLayout, Button, Message } from '../components/index'

interface DownloadsPageProps {}

export function DownloadsPage({}: DownloadsPageProps) {
  return (
    <SimpleLayout title="Downloads">
      <div className="container" style={{ maxWidth: 980, margin: '60px auto 80px', padding: '0 20px' }}>
        <h1 style={{ fontSize: 42, marginBottom: 28, fontWeight: 700 }}>Downloads</h1>

        <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            id="downloadsBackBtn"
            type="button"
            variant="secondary"
            size="small"
            ariaLabel="Back to profiles"
            title="Back to Profiles"
          >
            ← Back
          </Button>
          <Button
            id="setDownloadFolderBtn"
            type="button"
            variant="primary"
            size="small"
            ariaLabel="Select download folder"
            title="Select Download Folder (choose once)"
          >
            Set Download Folder
          </Button>
          <span id="downloadFolderStatus" className="download-folder-status" style={{ fontSize: 12, color: '#9ca3af' }}>
            No folder selected
          </span>
        </div>

        <div id="downloadsSummary" style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          marginBottom: '28px'
        }}>
          <div className="dl-metric">
            <div className="dl-metric-label">Active</div>
            <div className="dl-metric-value" id="dlMetricActive">0</div>
          </div>
          <div className="dl-metric">
            <div className="dl-metric-label">Completed</div>
            <div className="dl-metric-value" id="dlMetricCompleted">0</div>
          </div>
          <div className="dl-metric">
            <div className="dl-metric-label">Failed</div>
            <div className="dl-metric-value" id="dlMetricFailed">0</div>
          </div>
          <div className="dl-metric">
            <div className="dl-metric-label">Total Size</div>
            <div className="dl-metric-value" id="dlMetricSize">0</div>
          </div>
        </div>

        <div id="downloadsContainer" className="downloads-container">
          <div id="downloadsEmpty" className="downloads-empty">
            No downloads yet. Start a stream and click the ⬇ button.
          </div>
          <div id="downloadsList" className="downloads-list"></div>
        </div>

        <Message id="downloadsMessage" />

      </div>

      <style>{`
        .downloads-container {
          background: var(--section-bg, #1d1d1d);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 26px 26px 8px;
          min-height: 240px;
          position: relative;
        }
        .downloads-empty {
          text-align: center;
          color: var(--muted,#b3b3b3);
          font-size: 15px;
          padding: 40px 0;
        }
        .downloads-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .download-item {
          position: relative;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 8px;
          padding: 12px 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .download-item-header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }
        .download-title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
          margin: 0;
          color: #f3f4f6;
          word-break: break-word;
          flex: 1;
        }
        .download-status {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .6px;
        }
        .download-status.initiated { color: #9ca3af; }
        .download-status.downloading { color: #60a5fa; }
        .download-status.completed { color: #10b981; }
        .download-status.failed { color: #f87171; }
        .download-progress-wrap {
          height: 8px;
          background: #374151;
          border-radius: 5px;
          overflow: hidden;
          position: relative;
        }
        .download-progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg,#dc2626,#ef4444);
          transition: width .3s ease;
        }
        .download-meta {
          font-size: 11px;
          color: #9ca3af;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          line-height: 1.4;
        }
        .download-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .download-actions button {
          background: #1f2937;
          border: 1px solid #374151;
          color: #d1d5db;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .download-actions button:hover {
          background: #374151;
          color: #fff;
        }
        .dl-metric {
          background: #111827;
          border: 1px solid #303b49;
          border-radius: 8px;
          padding: 10px 16px;
          min-width: 120px;
        }
        .dl-metric-label {
          font-size: 11px;
          letter-spacing: .5px;
          color: #9ca3af;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .dl-metric-value {
          font-size: 18px;
          font-weight: 600;
          color: #f9fafb;
        }
        .download-folder-status {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.2;
          max-width: 220px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .download-folder-status.ready {
          color: #10b981;
        }
      `}</style>

      <script src="/static/js/downloads.js"></script>
    </SimpleLayout>
  )
}
