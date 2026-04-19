import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Download,
  Palette,
  Play,
  Puzzle,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'

export type SettingsPlatform = 'standard' | 'tv'
export type SettingsTabKey =
  | 'general'
  | 'appearance'
  | 'addons'
  | 'streaming'
  | 'downloads'
  | 'danger'
export type SettingsControlKind =
  | 'toggle'
  | 'action'
  | 'select'
  | 'range'
  | 'text'
  | 'notice'
  | 'custom'
export type SettingsScope = 'settings-profile' | 'account' | 'device' | 'server'

export interface SettingsTabDefinition {
  key: SettingsTabKey
  label: string
  icon: LucideIcon
  hiddenInGuest?: boolean
  requiresNativeShell?: boolean
}

export interface SettingsSelectOption {
  label: string
  value: string
}

interface SettingsItemBase {
  id: string
  kind: SettingsControlKind
  label?: string
  description?: ReactNode
  summary?: ReactNode
  disabled?: boolean
  platforms?: SettingsPlatform[]
}

export interface SettingsToggleItemDefinition extends SettingsItemBase {
  kind: 'toggle'
  checked: boolean
  onChange: (checked: boolean) => void
}

export interface SettingsActionItemDefinition extends SettingsItemBase {
  kind: 'action'
  actionLabel?: string
  onActivate: () => void
  variant?: 'secondary' | 'danger' | 'primary'
  saving?: boolean
}

export interface SettingsSelectItemDefinition extends SettingsItemBase {
  kind: 'select'
  value: string
  options: SettingsSelectOption[]
  onChange: (value: string) => void
}

export interface SettingsRangeItemDefinition extends SettingsItemBase {
  kind: 'range'
  value: number
  min: number
  max: number
  step?: number
  valueLabel?: ReactNode
  onChange: (value: number) => void
  onCommit?: (value: number) => void
}

export interface SettingsTextItemDefinition extends SettingsItemBase {
  kind: 'text'
  value: string
  placeholder?: string
  inputType?: 'text' | 'password'
  onChange: (value: string) => void
}

export interface SettingsNoticeItemDefinition extends SettingsItemBase {
  kind: 'notice'
  tone?: 'default' | 'warning' | 'danger'
  content: ReactNode
}

export interface SettingsCustomItemDefinition extends SettingsItemBase {
  kind: 'custom'
  render: (platform: SettingsPlatform) => ReactNode
}

export type SettingsItemDefinition =
  | SettingsToggleItemDefinition
  | SettingsActionItemDefinition
  | SettingsSelectItemDefinition
  | SettingsRangeItemDefinition
  | SettingsTextItemDefinition
  | SettingsNoticeItemDefinition
  | SettingsCustomItemDefinition

export interface SettingsSectionDefinition {
  id: string
  title?: string
  description?: ReactNode
  scope?: SettingsScope
  items: SettingsItemDefinition[]
  platforms?: SettingsPlatform[]
  /** When true, the section opens as a fullscreen overlay on mobile instead of inline */
  mobileOverlay?: boolean
}

export interface SettingsSectionContentDefinition {
  mode: 'sections'
  sections: SettingsSectionDefinition[]
}

export interface SettingsCustomContentDefinition {
  mode: 'custom'
  render: (platform: SettingsPlatform) => ReactNode
}

export type SettingsContentDefinition =
  | SettingsSectionContentDefinition
  | SettingsCustomContentDefinition

export const SETTINGS_TAB_DEFINITIONS: SettingsTabDefinition[] = [
  { key: 'general', label: 'General', icon: SettingsIcon },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'addons', label: 'Addons', icon: Puzzle },
  { key: 'streaming', label: 'Streaming', icon: Play },
  { key: 'downloads', label: 'Downloads', icon: Download, requiresNativeShell: true },
  { key: 'danger', label: 'Danger Zone', icon: AlertTriangle, hiddenInGuest: true },
]

export function getVisibleSettingsTabs(isGuestMode: boolean, isTauri: boolean): SettingsTabDefinition[] {
  return SETTINGS_TAB_DEFINITIONS.filter((tab) => {
    if (isGuestMode && tab.hiddenInGuest) return false
    if (tab.requiresNativeShell && !isTauri) return false
    return true
  })
}
