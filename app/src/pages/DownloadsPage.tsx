import { SimpleLayout, Button, Message } from '../components/index'

interface DownloadsPageProps {}

export function DownloadsPage({}: DownloadsPageProps) {
  return (
    <SimpleLayout title="Downloads">
      <div className="container" style={{ maxWidth: 1200, margin: '100px auto 80px', padding: '0 20px' }}>
        <h1 style={{ fontSize: 42, marginBottom: 28, fontWeight: 700 }}>Downloads</h1>

        <button
          id="downloadsBackBtn"
          className="back-btn"
          aria-label="Back to profiles"
          title="Back to Profiles"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back to Profiles
        </button>

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
            No downloads yet. Start a stream and click the <i data-lucide="download" style={{ width: 16, height: 16, verticalAlign: 'middle' }}></i> button.
          </div>
          <div id="downloadsList" className="downloads-grid"></div>
        </div>

        <Message id="downloadsMessage" />

      </div>

      <style>{`
        .back-btn {
          position: fixed;
          top: 40px;
          left: 40px;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          background: rgba(20, 20, 20, 0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: var(--text, white);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
          color: white;
        }

        .back-btn svg {
          transition: transform 0.3s ease;
        }

        .back-btn:hover svg {
          transform: translateX(-4px);
        }

        @media (max-width: 768px) {
          .back-btn {
            top: 20px;
            left: 20px;
            padding: 10px 16px;
            font-size: 14px;
          }
          .container {
            margin-top: 80px !important;
          }
        }

        .downloads-container {
          min-height: 240px;
          position: relative;
        }
        .downloads-empty {
          text-align: center;
          color: var(--muted,#b3b3b3);
          font-size: 15px;
          padding: 40px 0;
        }
        .downloads-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }
        .download-card {
          background: #181818;
          border-radius: 4px;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          aspect-ratio: 2/3;
          display: flex;
          flex-direction: column;
        }
        .download-card:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 16px rgba(0,0,0,0.5);
          z-index: 1;
        }
        .download-poster {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #222;
        }
        .download-poster-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #222;
          color: #444;
        }
        .download-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0));
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .download-title {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        }
        .download-meta {
          font-size: 11px;
          color: #ccc;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .download-status-badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-downloading { background: #1e3a8a; color: #bfdbfe; }
        .status-completed { background: #064e3b; color: #6ee7b7; }
        .status-failed { background: #7f1d1d; color: #fecaca; }
        
        .download-progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: #e50914;
          transition: width 0.3s;
          z-index: 2;
        }
        
        .download-actions-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .download-card:hover .download-actions-overlay {
          opacity: 1;
        }
        
        .action-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .action-btn:hover {
          background: rgba(255,255,255,0.2);
          transform: scale(1.1);
        }
        .action-btn.delete:hover {
          background: rgba(220, 38, 38, 0.8);
          border-color: rgba(220, 38, 38, 0.8);
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
      `}</style>

      <script src="/static/js/downloads.js"></script>
    </SimpleLayout>
  )
}
