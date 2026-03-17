import { describe, expect, it } from 'vitest'
import { buildContinueWatchingDeepLink, buildContinueWatchingProviderId } from './tv-launcher'

describe('tv-launcher helpers', () => {
  it('builds stable provider ids for launcher rows', () => {
    expect(
      buildContinueWatchingProviderId({
        profileId: '7',
        metaId: 'tt0944947',
        season: 1,
        episode: 2,
      })
    ).toBe('7:tt0944947:1:2')
  })

  it('builds a launcher deep link that targets the streaming route context', () => {
    expect(
      buildContinueWatchingDeepLink({
        profileId: '7',
        metaId: 'tt0944947',
        metaType: 'series',
        season: 1,
        episode: 2,
      })
    ).toBe('zentrio://launcher/open?profileId=7&type=series&id=tt0944947&season=1&episode=2')
  })
})
