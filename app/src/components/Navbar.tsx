import { Button } from './Button'

interface NavbarProps {
  profileId: number
  activePage?: 'home' | 'series' | 'movie' | 'library' | 'search' | 'explore'
  profile?: any
}

export const Navbar = ({ profileId, activePage, profile }: NavbarProps) => {
  return (
    <>
      <nav className="streaming-navbar" id="streamingNavbar">
        <div className="logo">
          <span className="iconify" data-icon="lucide:play" data-width="20" data-height="20" style={{ marginLeft: '2px' }}></span>
        </div>
        
        <div className="nav-left">
          <a href={`/streaming/${profileId}`} className={`nav-link ${activePage === 'home' ? 'active' : ''}`} title="Home">
            <span className="iconify" data-icon="lucide:home" data-width="24" data-height="24"></span>
            <span>Home</span>
          </a>
          <a href={`/streaming/${profileId}/explore`} className={`nav-link ${activePage === 'explore' ? 'active' : ''}`} title="Explore">
            <span className="iconify" data-icon="lucide:compass" data-width="24" data-height="24"></span>
            <span>Explore</span>
          </a>
          <a href={`/streaming/${profileId}/library`} className={`nav-link ${activePage === 'library' ? 'active' : ''}`} title="My List">
            <span className="iconify" data-icon="lucide:library" data-width="24" data-height="24"></span>
            <span>My List</span>
          </a>
          <a href="#" className={`nav-link ${activePage === 'search' ? 'active' : ''}`} title="Search" id="navSearchBtn">
            <span className="iconify" data-icon="lucide:search" data-width="24" data-height="24"></span>
            <span>Search</span>
          </a>
        </div>

        <div className="search-overlay" id="searchOverlay">
          <button className="close-search" id="closeSearchBtn">
            <span className="iconify" data-icon="lucide:x" data-width="24" data-height="24"></span>
          </button>
          <div className="search-container">
            <span className="iconify search-icon" data-icon="lucide:search"></span>
            <input type="text" id="searchInput" placeholder="Search movies & series..." autoComplete="off" />
          </div>
        </div>

        <div className="nav-right">
          <a href="/profiles" className="nav-profile" aria-label="Switch Profile" title="Switch Profile">
            <div className="nav-avatar">
              {profile?.avatar ? (
                <img src={profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? profile.avatar : `/api/avatar/${encodeURIComponent(profile.avatar)}`} alt={profile.name} />
              ) : (
                <span className="iconify" data-icon="lucide:user" data-width="20" data-height="20"></span>
              )}
            </div>
            <span>{profile?.name || 'Profile'}</span>
          </a>
        </div>
      </nav>
    </>
  )
}