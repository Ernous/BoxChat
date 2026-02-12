import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { ThemeModeContext, type ThemePreset } from './ui/theme-mode'

function readStoredMode(): 'light' | 'dark' {
  const raw = window.localStorage.getItem('boxchat-theme-mode')
  return raw === 'light' ? 'light' : 'dark'
}

function readStoredPreset(): ThemePreset {
  const raw = window.localStorage.getItem('boxchat-theme-preset')
  if (raw === 'discord' || raw === 'discord-ash' || raw === 'discord-midnight' || raw === 'discord-mint') return raw
  return 'boxchat'
}

function AppRoot() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => readStoredMode())
  const [preset, setPreset] = useState<ThemePreset>(() => readStoredPreset())

  const theme = useMemo(
    () =>
      createTheme({
        palette:
          preset === 'discord' || preset === 'discord-ash' || preset === 'discord-midnight' || preset === 'discord-mint'
            ? mode === 'dark'
              ? {
                  mode: 'dark',
                  primary: { main: preset === 'discord-mint' ? '#3ba55c' : '#5865f2' },
                  secondary: { main: '#b5bac1' },
                  background:
                    preset === 'discord-ash'
                      ? { default: '#232428', paper: '#2b2d31' }
                      : preset === 'discord-midnight'
                        ? { default: '#0f1115', paper: '#151820' }
                        : { default: '#1e1f22', paper: '#2b2d31' },
                  text: { primary: '#f2f3f5', secondary: '#b5bac1' },
                  divider: preset === 'discord-midnight' ? '#0f1115' : '#1e1f22',
                }
              : {
                  mode: 'light',
                  primary: { main: preset === 'discord-mint' ? '#3ba55c' : '#5865f2' },
                  secondary: { main: '#4e5058' },
                  background: { default: '#f2f3f5', paper: '#ffffff' },
                  text: { primary: '#060607', secondary: '#4e5058' },
                  divider: '#dfe1e5',
                }
            : mode === 'dark'
              ? {
                  mode: 'dark',
                  primary: { main: '#a78bfa' },
                  secondary: { main: '#c4b5fd' },
                  background: { default: '#3a304a', paper: '#4e4463' },
                  text: { primary: '#f3e8ff', secondary: '#c4b5fd' },
                  divider: '#5a5072',
                }
              : {
                  mode: 'light',
                  primary: { main: '#5f4a8a' },
                  secondary: { main: '#8f78bf' },
                  background: { default: '#f4f1fb', paper: '#ffffff' },
                  text: { primary: '#30234a', secondary: '#665b82' },
                  divider: '#d4cce8',
                },
        shape: { borderRadius: 14 },
        typography: {
          fontFamily: '"Manrope", "Segoe UI", "Arial", sans-serif',
          h4: { fontWeight: 800 },
          h5: { fontWeight: 800 },
          h6: { fontWeight: 700 },
          button: { textTransform: 'none', fontWeight: 700 },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
        },
      }),
    [mode, preset],
  )

  const contextValue = useMemo(
    () => ({
      mode,
      preset,
      toggleMode: () => {
        setMode((prev) => {
          const next = prev === 'dark' ? 'light' : 'dark'
          window.localStorage.setItem('boxchat-theme-mode', next)
          return next
        })
      },
      setMode: (next: 'light' | 'dark') => {
        window.localStorage.setItem('boxchat-theme-mode', next)
        setMode(next)
      },
      setPreset: (next: ThemePreset) => {
        window.localStorage.setItem('boxchat-theme-preset', next)
        setPreset(next)
      },
    }),
    [mode, preset],
  )

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
