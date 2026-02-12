import { createContext } from 'react'

export type ThemePreset = 'boxchat' | 'discord' | 'discord-ash' | 'discord-midnight' | 'discord-mint'

export type ThemeModeContextValue = {
  mode: 'light' | 'dark'
  preset: ThemePreset
  toggleMode: () => void
  setMode: (mode: 'light' | 'dark') => void
  setPreset: (preset: ThemePreset) => void
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  preset: 'boxchat',
  toggleMode: () => {},
  setMode: () => {},
  setPreset: () => {},
})
