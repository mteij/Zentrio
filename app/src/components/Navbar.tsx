import { Button } from './Button'

interface NavbarProps {
  profileId: number
  activePage?: 'home' | 'series' | 'movie' | 'library' | 'search'
  profile?: any
}

export const Navbar = ({ profileId, activePage, profile }: NavbarProps) => {
  return (
    <>
      <nav className="streaming-navbar" id="streamingNavbar">
        <a href={`/streaming/${profileId}`} className="logo">
          <span className="iconify" data-icon="lucide:play-circle" data-width="24" data-height="24" style={{ marginRight: '10px' }}></span>
          <span>Zentrio</span>
        </a>
        
        <div className="nav-left">
          <a href={`/streaming/${profileId}`} className={`nav-link ${activePage === 'home' ? 'active' : ''}`} title="Home">
            <span className="iconify" data-icon="lucide:home" data-width="24" data-height="24"></span>
            <span>Home</span>
          </a>
          <a href={`/streaming/${profileId}/series`} className={`nav-link ${activePage === 'series' ? 'active' : ''}`} title="Series">
            <span className="iconify" data-icon="lucide:tv" data-width="24" data-height="24"></span>
            <span>Series</span>
          </a>
          <a href={`/streaming/${profileId}/movie`} className={`nav-link ${activePage === 'movie' ? 'active' : ''}`} title="Films">
            <span className="iconify" data-icon="lucide:film" data-width="24" data-height="24"></span>
            <span>Films</span>
          </a>
          <a href={`/streaming/${profileId}/library`} className={`nav-link ${activePage === 'library' ? 'active' : ''}`} title="My List">
            <span className="iconify" data-icon="lucide:library" data-width="24" data-height="24"></span>
            <span>My List</span>
          </a>
          <a href={`/streaming/${profileId}/search`} className={`nav-link ${activePage === 'search' ? 'active' : ''}`} title="Search">
            <span className="iconify" data-icon="lucide:search" data-width="24" data-height="24"></span>
            <span>Search</span>
          </a>
        </div>

        <div className="nav-right">
          <a href="/profiles" className="nav-profile" aria-label="Switch Profile" title="Switch Profile">
            <div className="nav-avatar">
              {profile?.avatar && profile.avatar.startsWith('http') ? (
                <img src={profile.avatar} alt={profile.name} />
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