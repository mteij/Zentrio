import { LoadErrorState, LoadingSpinner } from '../../components'
import { TvFocusItem, TvGrid, TvSection, TvShelf } from '../../components/tv'
import { sanitizeImgSrc } from '../../lib/url'
import type { LibraryScreenModel } from './Library.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Library.tv.module.css'

export function StreamingLibraryTvView({ model }: { model: LibraryScreenModel }) {
  if (model.status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (model.status === 'error') {
    return (
      <LoadErrorState
        message={model.errorMessage || 'Failed to load the library.'}
        onRetry={() => model.actions.retry()}
        onBack={model.navigation.goBack}
      />
    )
  }

  const initialZoneId = model.myLists[0] ? 'library-my-lists' : model.sharedLists[0] ? 'library-shared-lists' : 'library-items'

  return (
    <StreamingTvScaffold
      profileId={model.profileId}
      activeNav="library"
      eyebrow="Library"
      title={model.activeList?.name || 'Your saved lists'}
      description="Switch between personal and shared lists, then jump straight into a saved title."
      initialZoneId={initialZoneId}
      onBack={model.navigation.goBack}
    >
      {model.pendingInvites.length > 0 ? (
        <TvSection title="Pending Invites" subtitle="Accept or decline shared library invitations right from TV.">
          <TvShelf zoneId="library-invites" nextLeft="streaming-rail" nextDown="library-my-lists">
            {model.pendingInvites.map((invite, index) => (
              <TvFocusItem
                key={invite.id}
                id={`library-invite-${invite.id}`}
                index={index}
                className={`${styles.card} ${styles.inviteCard}`}
                onActivate={() => void model.actions.acceptInvite(invite)}
              >
                <p className={styles.cardTitle}>{invite.listName}</p>
                <p className={styles.cardMeta}>Shared by {invite.sharedByName || 'another user'} · Press to accept</p>
              </TvFocusItem>
            ))}
          </TvShelf>
        </TvSection>
      ) : null}

      {model.myLists.length > 0 ? (
        <TvSection title="My Lists">
          <TvShelf zoneId="library-my-lists" nextLeft="streaming-rail" nextUp={model.pendingInvites.length > 0 ? 'library-invites' : undefined} nextDown="library-items">
            {model.myLists.map((list, index) => (
              <TvFocusItem
                key={list.id}
                id={`library-list-${list.id}`}
                index={index}
                className={styles.listChip}
                onActivate={() => model.actions.selectList(list)}
              >
                <p className={styles.listChipTitle}>{list.name}</p>
                <p className={styles.listChipMeta}>{model.activeList?.id === list.id ? 'Selected' : 'Open list'}</p>
              </TvFocusItem>
            ))}
          </TvShelf>
        </TvSection>
      ) : null}

      {model.sharedLists.length > 0 ? (
        <TvSection title="Shared Lists">
          <TvShelf zoneId="library-shared-lists" nextLeft="streaming-rail" nextUp={model.myLists.length > 0 ? 'library-my-lists' : 'library-invites'} nextDown="library-items">
            {model.sharedLists.map((list, index) => (
              <TvFocusItem
                key={list.id}
                id={`library-shared-${list.id}`}
                index={index}
                className={styles.listChip}
                onActivate={() => model.actions.selectList(list)}
              >
                <p className={styles.listChipTitle}>{list.name}</p>
                <p className={styles.listChipMeta}>Open shared list</p>
              </TvFocusItem>
            ))}
          </TvShelf>
        </TvSection>
      ) : null}

      {model.availableFromOtherProfiles.length > 0 ? (
        <TvSection title="Available to Add" subtitle="Link lists shared from your other profiles.">
          <TvShelf zoneId="library-profile-links" nextLeft="streaming-rail" nextUp={model.sharedLists.length > 0 ? 'library-shared-lists' : 'library-my-lists'} nextDown="library-items">
            {model.availableFromOtherProfiles.map((list, index) => (
              <TvFocusItem
                key={list.id}
                id={`library-link-${list.id}`}
                index={index}
                className={`${styles.card} ${styles.inviteCard}`}
                onActivate={() => void model.actions.linkShareToProfile(list)}
              >
                <p className={styles.cardTitle}>{list.name}</p>
                <p className={styles.cardMeta}>{list.linkedProfiles.length} linked profile{list.linkedProfiles.length === 1 ? '' : 's'} · Press to add</p>
              </TvFocusItem>
            ))}
          </TvShelf>
        </TvSection>
      ) : null}

      <TvSection title={model.activeList?.name || 'Saved Titles'} subtitle="Every card opens the content details screen.">
        {model.items.length > 0 ? (
          <TvGrid zoneId="library-items" columns={4} nextLeft="streaming-rail" nextUp={model.availableFromOtherProfiles.length > 0 ? 'library-profile-links' : model.sharedLists.length > 0 ? 'library-shared-lists' : 'library-my-lists'}>
            {model.items.map((item, index) => (
              <TvFocusItem
                key={`${item.list_id}-${item.meta_id}`}
                id={`library-item-${item.meta_id}`}
                index={index}
                className={styles.card}
                onActivate={() => model.navigation.openItem(item)}
              >
                <div className={styles.poster} style={{ backgroundImage: `url(${sanitizeImgSrc(item.poster || '')})` }} />
                <p className={styles.cardTitle}>{item.title}</p>
                <p className={styles.cardMeta}>{item.type === 'series' ? 'Series' : 'Movie'}</p>
              </TvFocusItem>
            ))}
          </TvGrid>
        ) : (
          <TvShelf zoneId="library-items" nextLeft="streaming-rail" nextUp={model.availableFromOtherProfiles.length > 0 ? 'library-profile-links' : model.sharedLists.length > 0 ? 'library-shared-lists' : 'library-my-lists'}>
            <TvFocusItem id="library-empty" className={`${styles.card} ${styles.emptyCard}`}>
              <p className={styles.cardTitle}>This list is empty</p>
              <p className={styles.cardMeta}>Add titles from any details page and they will appear here.</p>
            </TvFocusItem>
          </TvShelf>
        )}
      </TvSection>
    </StreamingTvScaffold>
  )
}

export default StreamingLibraryTvView
