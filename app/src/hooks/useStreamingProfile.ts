import { User } from 'lucide-react'
import { createElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { buildAvatarUrl, sanitizeImgSrc } from '../lib/url'

interface StreamingProfile {
  name?: string
  avatar?: string
  avatar_style?: string
}

/**
 * Reads the streaming profile from the TanStack Query cache populated by
 * StreamingLayout. Makes no network request — enabled: false.
 *
 * Returns:
 * - profile: the raw profile data (may be undefined before layout loads)
 * - profileAvatarNode: <img> if an avatar exists, otherwise a <User> icon element
 */
export function useStreamingProfile(profileId: string) {
  const { data: profile } = useQuery<StreamingProfile | null>({
    queryKey: ['streaming-profile', profileId],
    queryFn: async (): Promise<StreamingProfile | null> => null,
    enabled: false,
  })

  const profileAvatarNode = profile?.avatar
    ? createElement('img', {
        src: sanitizeImgSrc(
          buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral')
        ),
        alt: '',
      })
    : createElement(User, { size: 18, 'aria-hidden': true })

  return { profile, profileAvatarNode }
}
