import { Input } from '../index'

export function StreamingSettings() {
  return (
    <div id="streaming-settings-container" className="settings-card">
      <h2 className="section-title">Streaming Preferences <span className="info-icon" title="Configure your streaming preferences">?</span></h2>

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

        {/* Parental Guide */}
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="setting-info" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3>Parental Guide</h3>
                    <p>Restrict content visibility based on maturity ratings. Hidden content will not appear in catalogs or search results.</p>
                </div>
                <div className="setting-control">
                    <div id="parental-enabled" className="toggle"></div>
                </div>
            </div>
            <div id="parental-options" style={{ display: 'none', flexDirection: 'column', gap: '10px', marginTop: '15px', width: '100%' }}>
                <label>Hide content rated above:</label>
                <select id="parental-rating-limit" style={{ padding: '8px', borderRadius: '4px', background: '#333', color: 'white', border: '1px solid #555' }}>
                    <option value="G">G (General Audiences)</option>
                    <option value="PG">PG (Parental Guidance Suggested)</option>
                    <option value="PG-13">PG-13 (Parents Strongly Cautioned)</option>
                    <option value="R">R (Restricted)</option>
                    <option value="NC-17">NC-17 (Adults Only)</option>
                </select>
            </div>
        </div>

        {/* Collapsible Sorting & Filtering Section */}
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="setting-info" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3>Sorting & Filtering</h3>
                    <p>Configure advanced sorting and filtering options.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div id="sorting-enabled" className="toggle active" title="Enable/Disable Sorting & Filtering"></div>
                    <span className="arrow" style={{ cursor: 'pointer', transition: 'transform 0.3s', fontSize: '1.2rem' }} onclick="const content = document.getElementById('sorting-filters-content'); content.style.display = content.style.display === 'none' ? 'block' : 'none'; this.style.transform = content.style.display === 'none' ? 'rotate(0deg)' : 'rotate(180deg)';">▼</span>
                </div>
            </div>
            
            <div id="sorting-filters-content" style={{ display: 'none', marginTop: '20px', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                {/* Streaming Resolutions */}
                <div className="setting-section">
                    <div className="section-header">
                        <h3>Select Streaming Resolutions: <span className="info-icon" title="Select preferred resolutions">?</span></h3>
                    </div>
                    <div className="grid-options" id="resolution-options">
                        {/* Populated by JS */}
                    </div>
                </div>

                {/* Quality Filter */}
                <div className="setting-section">
                    <div className="section-header">
                        <h3>Select Quality Filter: <span className="info-icon" title="Select preferred qualities">?</span></h3>
                    </div>
                    <div className="grid-options" id="quality-options">
                        {/* Populated by JS */}
                    </div>
                </div>

                {/* File Size Filter */}
                <div className="setting-section">
                    <div className="section-header">
                        <h3>Set File Size Filter: <span className="info-icon" title="Set maximum file size">?</span></h3>
                    </div>
                    <div className="slider-container">
                        <input type="range" id="file-size-slider" min="0" max="100" step="1" className="slider" />
                        <div className="slider-value">Max File Size: <span id="file-size-value">Unlimited</span></div>
                    </div>
                </div>

                {/* Sorting Priority */}
                <div className="setting-section">
                    <div className="section-header">
                        <h3>Select & Arrange Sorting Priority: <span className="info-icon" title="Drag and drop to reorder sorting priority">?</span></h3>
                    </div>
                    <div className="sortable-grid" id="sorting-priority-list">
                        {/* Populated by JS */}
                    </div>
                </div>

                {/* Language Selection & Priority */}
                <div className="setting-section">
                    <div className="section-header">
                        <h3>Language Preferences: <span className="info-icon" title="Select and prioritize languages">?</span></h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select id="language-select-input" style={{ flex: 1, padding: '10px', borderRadius: '6px', background: '#333', color: 'white', border: '1px solid #555' }}>
                                <option value="">Select a language to add...</option>
                                {/* Populated by JS */}
                            </select>
                            <button id="add-language-btn" className="btn btn-primary" style={{ padding: '0 20px' }}>Add</button>
                        </div>
                        
                        <div className="sortable-list" id="language-priority-list">
                            {/* Populated by JS */}
                        </div>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  )
}