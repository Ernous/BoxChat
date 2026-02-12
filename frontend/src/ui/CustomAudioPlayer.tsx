import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import { Download, FileAudio, Pause, Play, Volume2, VolumeX } from 'lucide-react'

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CustomAudioPlayer({ src, title }: { src: string; title?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [dur, setDur] = useState(0)
  const [muted, setMuted] = useState(false)

  const pct = useMemo(() => {
    if (!dur) return 0
    return Math.max(0, Math.min(100, (pos / dur) * 100))
  }, [pos, dur])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const a = el

    a.muted = muted

    function sync() {
      setPos(a.currentTime || 0)
      setDur(a.duration || 0)
    }

    function onPlay() {
      setPlaying(true)
    }

    function onPause() {
      setPlaying(false)
    }

    a.addEventListener('timeupdate', sync)
    a.addEventListener('loadedmetadata', sync)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)

    return () => {
      a.removeEventListener('timeupdate', sync)
      a.removeEventListener('loadedmetadata', sync)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
    }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.muted = muted
  }, [muted])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play()
    else a.pause()
  }

  async function download() {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = title || src.split('/').pop() || 'audio'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 520,
        minWidth: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        px: 1.2,
        py: 1,
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1,
            bgcolor: 'rgba(88,101,242,.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          <FileAudio size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={800} noWrap>
            {title || src.split('/').pop() || 'Audio'}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <IconButton size="small" onClick={() => void download()}>
          <Download size={18} />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton size="small" onClick={toggle}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </IconButton>

        <Typography variant="caption" color="text.secondary" sx={{ width: 70 }}>
          {fmt(pos)} / {fmt(dur)}
        </Typography>

        <Box
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,.12)',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            const el = audioRef.current
            if (!el || !dur) return
            const rect = e.currentTarget.getBoundingClientRect()
            const next = ((e.clientX - rect.left) / rect.width) * dur
            el.currentTime = Math.max(0, Math.min(dur, next))
          }}
        >
          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'primary.main' }} />
        </Box>

        <IconButton size="small" onClick={() => setMuted((p) => !p)}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </IconButton>
      </Stack>
    </Box>
  )
}
