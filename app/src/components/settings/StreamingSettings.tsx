import { Input } from '../index'

export function StreamingSettings() {
  return (
    <div id="streaming-settings-container" className="settings-card">
      <h2 className="section-title">Streaming</h2>

      <div id="streaming-loading">Loading settings...</div>
      
      <div id="streaming-content" style={{ display: 'none' }}>
        {/* Profile Selector */}
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="setting-info" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
                <h3>Profile</h3>
                <p>Select profile to configure.</p>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select id="streaming-profile-select" style={{ padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}>
                    <option value="">Default (Global)</option>
                </select>
                <button id="create-settings-profile-btn" className="btn btn-secondary" style={{ padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555', cursor: 'pointer' }} title="Create new profile">+</button>
                <button id="rename-settings-profile-btn" className="btn btn-secondary" style={{ padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555', cursor: 'pointer', display: 'none' }} title="Rename profile">✎</button>
                <button id="delete-settings-profile-btn" className="btn btn-danger" style={{ padding: '8px', borderRadius: '4px', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer', display: 'none' }} title="Delete profile">🗑️</button>
             </div>
          </div>
        </div>

        {/* Cache */}
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="setting-info">
            <h3>Cache</h3>
            <p>Filter streams based on cache status.</p>
          </div>
          <div className="setting-control" style={{ width: '100%', marginTop: '15px', display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label>Cached</label>
              <div id="cache-cached" className="toggle"></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label>Uncached</label>
              <div id="cache-uncached" className="toggle"></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label>Mode</label>
              <select id="cache-mode" style={{ padding: '5px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}>
                <option value="OR">OR</option>
                <option value="AND">AND</option>
              </select>
            </div>
          </div>
        </div>

        {/* Resolutions */}
        <FilterSection title="Resolution" description="Filter by video resolution." category="resolution" types={['preferred', 'required', 'excluded']} />

        {/* Encodes */}
        <FilterSection title="Encode" description="Filter by video codec." category="encode" types={['preferred', 'required', 'excluded']} />

        {/* Visual Tags */}
        <FilterSection title="Visual Tags" description="Filter by visual features." category="visualTag" types={['preferred', 'required', 'excluded']} />

        {/* Audio Tags */}
        <FilterSection title="Audio Tags" description="Filter by audio features." category="audioTag" types={['preferred', 'required', 'excluded']} />

        {/* Matching */}
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="setting-info">
            <h3>Matching</h3>
            <p>Strictness of title and episode matching.</p>
          </div>
          <div className="setting-control" style={{ width: '100%', marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Title Matching</span>
              <div id="matching-title-enabled" className="toggle"></div>
            </div>
            <div id="matching-title-mode-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px' }}>
              <label>Mode</label>
              <select id="matching-title-mode" style={{ padding: '5px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}>
                <option value="Exact">Exact</option>
                <option value="Partial">Partial</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Season/Episode Matching</span>
              <div id="matching-season-enabled" className="toggle"></div>
            </div>
          </div>
        </div>

        {/* Limits */}
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="setting-info">
            <h3>Limits</h3>
            <p>Control the number of results.</p>
          </div>
          <div className="setting-control" style={{ width: '100%', marginTop: '15px', display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label>Max Results</label>
              <Input type="number" id="limit-maxResults" style={{ width: '100px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label>Per Addon</label>
              <Input type="number" id="limit-perAddon" style={{ width: '100px' }} />
            </div>
          </div>
        </div>

        {/* Deduplication */}
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="setting-info">
            <h3>Deduplication</h3>
            <p>Remove duplicate streams.</p>
          </div>
          <div className="setting-control" style={{ width: '100%', marginTop: '15px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label>Mode: </label>
              <select id="dedup-mode" style={{ padding: '5px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}>
                <option value="Single Result">Single Result</option>
                <option value="Per Service">Per Service</option>
                <option value="Per Addon">Per Addon</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input type="checkbox" id="dedup-filename" /> Filename
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input type="checkbox" id="dedup-infoHash" /> InfoHash
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input type="checkbox" id="dedup-smartDetect" /> Smart Detect
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterSection({ title, description, category, types = ['preferred', 'excluded'] }: { title: string, description: string, category: string, types?: string[] }) {
  return (
    <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
      <div className="setting-info">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="setting-control" style={{ width: '100%', marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {types.includes('preferred') && <ChipList label="Preferred" id={`chips-${category}-preferred`} />}
        {types.includes('required') && <ChipList label="Required" id={`chips-${category}-required`} />}
        {types.includes('excluded') && <ChipList label="Excluded" id={`chips-${category}-excluded`} />}
      </div>
    </div>
  )
}

function ChipList({ label, id }: { label: string, id: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <label style={{ width: '80px', fontSize: '14px', color: '#aaa' }}>{label}</label>
      <div id={id} style={{ flex: '1', display: 'flex', flexWrap: 'wrap', gap: '5px' }}></div>
    </div>
  )
}