import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material'
import { Search, Star, X } from 'lucide-react'

type GifItem = { id: string; url: string; preview: string; title?: string }

type Variant = 'dialog' | 'panel'
const FAVORITES_KEY = 'boxchat-gif-favorites'

export default function GifPicker({
  open,
  onClose,
  onPick,
  variant = 'dialog',
}: {
  open: boolean
  onClose: () => void
  onPick: (gifUrl: string) => void
  variant?: Variant
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<GifItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<GifItem[]>([])
  const [showFavorites, setShowFavorites] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const keepSearchFocusRef = useRef(false)
  const [tab, setTab] = useState(0)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const next = parsed
        .map((x: any) => ({
          id: String(x?.id ?? ''),
          url: String(x?.url ?? ''),
          preview: String(x?.preview ?? ''),
          title: x?.title ? String(x.title) : undefined,
        }))
        .filter((x: GifItem) => Boolean(x.id && x.url && x.preview))
        .slice(0, 200)
      setFavorites(next)
    } catch {
      // ignore invalid local storage payload
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQ('')
    setItems([])
    setError(null)
    setShowFavorites(false)
    setTab(0)
  }, [open])

  useEffect(() => {
    if (!open || tab !== 0 || showFavorites) return
    if (!keepSearchFocusRef.current) return
    const el = searchInputRef.current
    if (!el) return
    if (document.activeElement === el) return
    window.requestAnimationFrame(() => {
      try {
        el.focus({ preventScroll: true })
      } catch {
        el.focus()
      }
    })
  }, [open, tab, showFavorites, q, items.length, loading])

  function persistFavorites(next: GifItem[]) {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next.slice(0, 200)))
    } catch {
      // ignore storage write errors
    }
  }

  function isFavorite(g: GifItem) {
    return favorites.some((x) => x.id === g.id)
  }

  function toggleFavorite(g: GifItem) {
    setFavorites((prev) => {
      const exists = prev.some((x) => x.id === g.id)
      const next = exists ? prev.filter((x) => x.id !== g.id) : [g, ...prev].slice(0, 200)
      persistFavorites(next)
      return next
    })
  }

  async function loadGifs() {
    if (!open) return
    if (tab !== 0) return
    if (showFavorites) return
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const endpoint = q.trim()
        ? `/api/v1/gifs/search?q=${encodeURIComponent(q.trim())}&limit=50`
        : `/api/v1/gifs/trending?limit=50`
      const res = await fetch(endpoint, {
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }).catch(() => null)
      const payload = await res?.json().catch(() => null)
      if (!res?.ok) {
        const msg = payload?.error ? String(payload.error) : `GIF request failed (${res?.status || 0})`
        setError(msg)
        setItems([])
        return
      }
      const mapped: GifItem[] = (payload?.gifs ?? []) as GifItem[]
      setItems(mapped)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    if (tab !== 0) return
    if (showFavorites) return
    setItems([])
    setError(null)
    const t = window.setTimeout(() => {
      void loadGifs()
    }, q.trim() ? 250 : 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, tab])

  const visibleItems = showFavorites ? favorites : items

  function Content() {
    return (
      <Box sx={{ width: '100%' }}>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 1.2 }}>
          <Tab label="Гифки" />
          <Tab label="Стикеры" />
          <Tab label="Эмодзи" />
        </Tabs>

        {tab === 0 ? (
          <>
            <TextField
              fullWidth
              size="small"
              placeholder="Поиск в Giphy"
              value={q}
              inputRef={searchInputRef}
              autoFocus
              onChange={(e) => {
                if (showFavorites) setShowFavorites(false)
                setQ(e.target.value)
              }}
              onFocus={() => {
                keepSearchFocusRef.current = true
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  const el = searchInputRef.current
                  if (!el) return
                  keepSearchFocusRef.current = document.activeElement === el
                }, 0)
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1.2 }}
            />

            {!q.trim() ? (
              <Stack direction="row" spacing={1} sx={{ mb: 1.2 }}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setShowFavorites(false)
                    setQ('')
                    void loadGifs()
                  }}
                  sx={{
                    flex: 1,
                    height: 78,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: showFavorites ? 'rgba(255,255,255,.04)' : 'rgba(88,101,242,.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <Typography sx={{ fontWeight: 900 }}>Популярные GIF</Typography>
                </Box>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setShowFavorites(true)
                    setQ('')
                  }}
                  sx={{
                    flex: 1,
                    height: 78,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: showFavorites ? 'rgba(88,101,242,.18)' : 'rgba(255,255,255,.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    opacity: showFavorites ? 1 : 0.75,
                  }}
                >
                  <Typography sx={{ fontWeight: 900 }}>Избранное</Typography>
                </Box>
              </Stack>
            ) : null}

            {showFavorites && !favorites.length ? (
              <Alert severity="info" sx={{ mb: 1.2 }}>
                Здесь пока пусто. Нажми на звезду у GIF, чтобы добавить в избранное.
              </Alert>
            ) : null}

            {error ? (
              <Alert severity="warning" sx={{ mb: 1.2 }}>
                {error}
              </Alert>
            ) : null}

            <Box
              className="bc-scroll"
              sx={{
                maxHeight: variant === 'dialog' ? 420 : 'min(520px, calc(100vh - 340px))',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                overflowAnchor: 'none',
                pr: 0.5,
              }}
            >
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                {visibleItems.map((g) => (
                  <Box
                    key={g.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPick(g.url)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onPick(g.url)
                    }}
                    sx={{
                      width: 160,
                      height: 112,
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                      opacity: loading ? 0.7 : 1,
                      position: 'relative',
                    }}
                  >
                    <Box component="img" src={g.preview} alt={g.title || 'gif'} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <Tooltip title={isFavorite(g) ? 'Убрать из избранного' : 'Добавить в избранное'}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(g)
                        }}
                        sx={{
                          position: 'absolute',
                          right: 6,
                          top: 6,
                          width: 30,
                          height: 30,
                          borderRadius: 1.5,
                          bgcolor: 'rgba(0,0,0,.46)',
                          color: isFavorite(g) ? '#fbbf24' : '#e5e7eb',
                          '&:hover': { bgcolor: 'rgba(0,0,0,.58)' },
                        }}
                      >
                        <Star size={16} fill={isFavorite(g) ? 'currentColor' : 'none'} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Stack>

              {loading && !showFavorites ? (
                <Box sx={{ py: 1.2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Loading...
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </>
        ) : (
          <Alert severity="info">Скоро</Alert>
        )}
      </Box>
    )
  }

  if (variant === 'panel') {
    return <Content />
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography fontWeight={900}>GIF</Typography>
        <IconButton onClick={onClose}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 1.2 }}>
          GIF поиск идёт через сервер.
        </Alert>
        <Content />
      </DialogContent>
    </Dialog>
  )
}
