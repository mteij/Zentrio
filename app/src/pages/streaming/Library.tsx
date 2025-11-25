import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { LibraryItem } from '../../services/database'

interface StreamingLibraryProps {
  items: LibraryItem[]
  profileId: number
}

export const StreamingLibrary = ({ items, profileId }: StreamingLibraryProps) => {
  return (
    <Layout title="My List">
      <Navbar profileId={profileId} activePage="library" />
      <div className="streaming-home">
        <h1>My List</h1>
        {items.length === 0 ? (
          <div className="loading">Your list is empty.</div>
        ) : (
          <div className="items-grid">
            {items.map(item => (
              <a key={item.meta_id} href={`/streaming/${profileId}/${item.type}/${item.meta_id}`} className="item-card">
                <div className="poster-wrapper">
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} loading="lazy" />
                  ) : (
                    <div className="no-poster">{item.title}</div>
                  )}
                </div>
                <div className="item-info">
                  <span className="item-name">{item.title}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .streaming-home {
          padding: 20px;
          color: #fff;
          padding-bottom: 80px;
        }
        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
        }
        .item-card {
          display: block;
          text-decoration: none;
          color: inherit;
          transition: transform 0.2s;
        }
        .item-card:hover {
          transform: scale(1.05);
        }
        .poster-wrapper {
          aspect-ratio: 2/3;
          background: #333;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .poster-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .no-poster {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          text-align: center;
          font-size: 0.9rem;
          color: #aaa;
        }
        .item-name {
          font-size: 0.9rem;
          font-weight: 500;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </Layout>
  )
}