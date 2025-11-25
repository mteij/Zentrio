import { Button, FormGroup, Input } from './index'

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
            


            <FormGroup label="Age Rating" htmlFor="ageRatingInput" id="ageRatingGroup">
              <select id="ageRatingInput" name="ageRating" defaultValue="18">
                <option value="6">6+</option>
                <option value="9">9+</option>
                <option value="12">12+</option>
                <option value="14">14+</option>
                <option value="16">16+</option>
                <option value="18">18+</option>
              </select>
            </FormGroup>

            <div className="profile-action-row">
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
                style={{ display: 'none' }}
              >
                Delete Profile
              </Button>
            </div>
          </div>
        </form>
        
      </div>
    </div>
  )
}
