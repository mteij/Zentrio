import type { ReactNode } from 'react'
import { Check, Globe, Library as LibraryIcon, Lock, User, UserPlus } from 'lucide-react'
import { LoadErrorState, LoadingSpinner } from '../../components'
import { TvFocusItem, TvGrid, TvSection, TvShelf } from '../../components/tv'
import { scrollTvPageTop } from '../../components/tv/scrollTvPageTop'
import type { ProfileSharedList, SharedList } from '../../components/library/LibrarySidebar'
import { sanitizeImgSrc } from '../../lib/url'
import type { List } from '../../services/database'
import type { LibraryScreenModel } from './Library.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Library.tv.module.css'

type TvLibraryList = List | SharedList | ProfileSharedList

function isAccountSharedList(list: TvLibraryList | null | undefined): list is SharedList {
  return Boolean(list && 'share' in list)
}

function isProfileSharedList(list: TvLibraryList | null | undefined): list is ProfileSharedList {
  return Boolean(list && 'profileShare' in list)
}

function getListMeta(list: TvLibraryList) {
  if (isAccountSharedList(list)) {
    return list.sharedByName ? `Shared by ${list.sharedByName}` : 'Shared list'
  }

  if (isProfileSharedList(list)) {
    return list.ownerName ? `From ${list.ownerName}` : 'Profile share'
  }

  return list.is_default ? 'Main list' : 'Private list'
}

function getItemCountLabel(count: number) {
  return `${count} ${count === 1 ? 'title' : 'titles'}`
}

function LibraryListButton({
  id,
  index,
  list,
  activeList,
  onActivate,
}: {
  id: string
  index: number
  list: TvLibraryList
  activeList: TvLibraryList | null
  onActivate: () => void
}) {
  const isActive = activeList?.id === list.id
  const Icon = isAccountSharedList(list) ? Globe : isProfileSharedList(list) ? User : Lock

  return (
    <TvFocusItem
      id={id}
      index={index}
      className={`${styles.listButton} ${isActive ? styles.listButtonActive : ''}`}
      onFocus={() => scrollTvPageTop()}
      onActivate={onActivate}
    >
      <span className={styles.listButtonIcon}>
        <Icon size={16} />
      </span>
      <span className={styles.listButtonCopy}>
        <span className={styles.listButtonTitle}>{list.name}</span>
        <span className={styles.listButtonMeta}>{getListMeta(list)}</span>
      </span>
      {isActive ? (
        <span className={styles.listButtonState}>
          <Check size={14} />
        </span>
      ) : null}
    </TvFocusItem>
  )
}

function LibraryActionButton({
  id,
  index,
  icon,
  title,
  meta,
  accent = false,
  onActivate,
}: {
  id: string
  index: number
  icon: ReactNode
  title: string
  meta: string
  accent?: boolean
  onActivate: () => void
}) {
  return (
    <TvFocusItem
      id={id}
      index={index}
      className={`${styles.actionButton} ${accent ? styles.actionButtonAccent : ''}`}
      onFocus={() => scrollTvPageTop()}
      onActivate={onActivate}
    >
      <span className={styles.actionButtonIcon}>{icon}</span>
      <span className={styles.actionButtonCopy}>
        <span className={styles.actionButtonTitle}>{title}</span>
        <span className={styles.actionButtonMeta}>{meta}</span>
      </span>
    </TvFocusItem>
  )
}

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

  const lists = [...model.myLists, ...model.sharedLists]
  const hasLists = lists.length > 0
  const hasActions = model.pendingInvites.length > 0 || model.availableFromOtherProfiles.length > 0
  const initialZoneId = hasLists ? 'library-lists' : hasActions ? 'library-actions' : 'library-items'
  const itemsNextUp = hasActions ? 'library-actions' : hasLists ? 'library-lists' : undefined

  return (
    <StreamingTvScaffold
      profileId={model.profileId}
      activeNav="library"
      eyebrow="Library"
      title={model.activeList?.name || 'Your library'}
      initialZoneId={initialZoneId}
      onBack={model.navigation.goBack}
    >
      {hasLists ? (
        <TvSection title="Lists">
          <TvShelf
            zoneId="library-lists"
            nextLeft="streaming-rail"
            nextDown={hasActions ? 'library-actions' : 'library-items'}
          >
            {lists.map((list, index) => (
              <LibraryListButton
                key={`${list.id}-${isAccountSharedList(list) ? 'account' : isProfileSharedList(list) ? 'profile' : 'mine'}`}
                id={`library-list-${list.id}-${index}`}
                index={index}
                list={list}
                activeList={model.activeList}
                onActivate={() => model.actions.selectList(list)}
              />
            ))}
          </TvShelf>
        </TvSection>
      ) : null}

      {hasActions ? (
        <TvSection title="Shared">
          <TvShelf
            zoneId="library-actions"
            nextLeft="streaming-rail"
            nextUp={hasLists ? 'library-lists' : undefined}
            nextDown="library-items"
          >
            {model.pendingInvites.map((invite, index) => (
              <LibraryActionButton
                key={invite.id}
                id={`library-invite-${invite.id}`}
                index={index}
                icon={<Check size={16} />}
                title={invite.listName}
                meta={invite.sharedByName ? `Accept invite from ${invite.sharedByName}` : 'Accept shared invite'}
                accent
                onActivate={() => void model.actions.acceptInvite(invite)}
              />
            ))}
            {model.availableFromOtherProfiles.map((list, index) => (
              <LibraryActionButton
                key={list.id}
                id={`library-link-${list.id}`}
                index={model.pendingInvites.length + index}
                icon={<UserPlus size={16} />}
                title={list.name}
                meta={`Add to this profile • ${list.linkedProfiles.length} linked`}
                onActivate={() => void model.actions.linkShareToProfile(list)}
              />
            ))}
          </TvShelf>
        </TvSection>
      ) : null}

      <TvSection title={model.activeList?.name || 'Saved titles'} subtitle={getItemCountLabel(model.items.length)}>
        {model.items.length > 0 ? (
          <TvGrid zoneId="library-items" columns={4} nextLeft="streaming-rail" nextUp={itemsNextUp}>
            {model.items.map((item, index) => (
              <TvFocusItem
                key={`${item.list_id}-${item.meta_id}`}
                id={`library-item-${item.meta_id}-${index}`}
                index={index}
                className={styles.mediaCard}
                onActivate={() => model.navigation.openItem(item)}
              >
                <div
                  className={styles.mediaPoster}
                  style={{ backgroundImage: item.poster ? `url(${sanitizeImgSrc(item.poster)})` : undefined }}
                />
                <div className={styles.mediaBody}>
                  <p className={styles.mediaTitle}>{item.title}</p>
                  <p className={styles.mediaMeta}>{item.type === 'series' ? 'Series' : 'Movie'}</p>
                </div>
              </TvFocusItem>
            ))}
          </TvGrid>
        ) : (
          <TvShelf zoneId="library-items" nextLeft="streaming-rail" nextUp={itemsNextUp}>
            <TvFocusItem id="library-empty" className={styles.emptyCard}>
              <LibraryIcon size={22} />
              <div>
                <p className={styles.emptyTitle}>This list is empty</p>
                <p className={styles.emptyMeta}>Add titles from any details page.</p>
              </div>
            </TvFocusItem>
          </TvShelf>
        )}
      </TvSection>
    </StreamingTvScaffold>
  )
}

export default StreamingLibraryTvView
