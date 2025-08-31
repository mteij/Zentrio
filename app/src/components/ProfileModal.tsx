import { Button, FormGroup, Input, Message } from './index'

export function ProfileModal() {
  return (
    <div id="profileModal" className="modal">
      <div className="modal-content">
        <span className="close">&times;</span>
        <h2 id="modalTitle">Create New Profile</h2>
        <form id="profileForm" className="profile-edit-form">
          <div className="profile-edit-container">
            <div className="avatar-section">
              <div className="avatar-preview" id="avatarPreview" aria-live="polite"></div>
              <Button
                type="button"
                variant="secondary"
                className="shuffle-btn"
                id="shuffleBtn"
              >
                🎲 Shuffle Avatar
              </Button>
            </div>
            
            <FormGroup label="Profile Name" htmlFor="profileName">
              <Input
                type="text"
                id="profileName"
                name="profileName"
                required
              />
            </FormGroup>
            
            <FormGroup htmlFor="stremioEmail">
              <label htmlFor="stremioEmail">
                Stremio Email <span style={{ color: '#e50914' }}>*</span>
              </label>
              <Input
                type="email"
                id="stremioEmail"
                name="stremioEmail"
                required
              />
            </FormGroup>
            
            <FormGroup label="Stremio Password" htmlFor="stremioPassword">
              <Input
                type="password"
                id="stremioPassword"
                name="stremioPassword"
                ariaDescribedBy="stremioPasswordHelp"
              />
            </FormGroup>

            <div className="form-group setting-item">
              <div className="setting-info">
                <label htmlFor="nsfwFilterEnabledToggle">Enable NSFW Filter</label>
                <p>Censor content based on age rating.</p>
              </div>
              <div className="setting-control">
                <div className="toggle" id="nsfwFilterEnabledToggle"></div>
              </div>
            </div>

            <FormGroup label="Age Rating" htmlFor="ageRatingInput" className="step-hidden" id="ageRatingGroup">
              <Input
                type="number"
                id="ageRatingInput"
                name="ageRating"
                min="0"
                max="18"
              />
            </FormGroup>

            <Button
              type="submit"
              className="btn-primary save-btn"
              id="saveProfileBtn"
            >
              Save Profile
            </Button>
            
            <Button
              type="button"
              variant="danger"
              size="small"
              id="deleteProfileBtn"
              style={{ display: 'none', marginTop: '8px' }}
            >
              Delete Profile
            </Button>
          </div>
        </form>
        
        <Message id="modalMessage" />
      </div>
    </div>
  )
}