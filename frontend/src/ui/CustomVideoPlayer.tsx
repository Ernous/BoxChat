import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, IconButton } from '@mui/material'
import { ArrowLeft, Download, Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react'

export default function CustomVideoPlayer({ src }: { src: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fsVideoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [meta, setMeta] = useState<{ w: number; h: number } | null>(null)
  const [hover, setHover] = useState(false)
  const [fsOpen, setFsOpen] = useState(false)
  const [fsHover, setFsHover] = useState(false)
  const fsOpenRef = useRef(false)

  function getActiveVideo(): HTMLVideoElement | null {
    if (fsOpenRef.current && fsVideoRef.current) return fsVideoRef.current
    return videoRef.current
  }

  async function downloadNow() {
    try {
      const res = await fetch(src, { credentials: 'include' })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const name = src.split('/').pop() || 'video'
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }

  const progressPct = useMemo(() => {
    if (!duration) return 0
    return Math.max(0, Math.min(100, (progress / duration) * 100))
  }, [progress, duration])

  useEffect(() => {
    const active = getActiveVideo()
    if (!active) return
    const v = active

    function onTime() {
      setProgress(v.currentTime || 0)
      setDuration(v.duration || 0)
    }

    function onMeta() {
      setMeta({ w: v.videoWidth || 0, h: v.videoHeight || 0 })
      onTime()
    }

    function onPlay() {
      setPlaying(true)
    }

    function onPause() {
      setPlaying(false)
    }

    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    onTime()

    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [fsOpen])

  useEffect(() => {
    const inline = videoRef.current
    const fs = fsVideoRef.current
    if (inline) inline.muted = muted
    if (fs) fs.muted = muted
  }, [muted])

  function toggle() {
    const v = getActiveVideo()
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  function seek(clientX: number, barEl: HTMLDivElement) {
    const v = getActiveVideo()
    if (!v || !duration) return
    const rect = barEl.getBoundingClientRect()
    const pct = (clientX - rect.left) / rect.width
    v.currentTime = Math.max(0, Math.min(duration, pct * duration))
  }

  function openFs() {
    const v = videoRef.current
    if (!v) return
    fsOpenRef.current = true
    setFsOpen(true)
  }

  function closeFs() {
    const inline = videoRef.current
    const fs = fsVideoRef.current
    fsOpenRef.current = false
    if (inline && fs) {
      const wasPlaying = !fs.paused
      inline.currentTime = fs.currentTime || 0
      inline.muted = fs.muted
      if (wasPlaying) void inline.play()
      else inline.pause()
    }
    setFsOpen(false)
  }

  useEffect(() => {
    fsOpenRef.current = fsOpen
  }, [fsOpen])

  useEffect(() => {
    if (!fsOpen) return
    const inline = videoRef.current
    const fs = fsVideoRef.current
    if (!inline || !fs) return

    const wasPlaying = !inline.paused
    const t = inline.currentTime || 0

    inline.pause()

    fs.muted = inline.muted
    fs.currentTime = t
    if (wasPlaying) {
      void fs.play()
      setPlaying(true)
    } else {
      setPlaying(false)
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeFs()
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [fsOpen])

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      return Boolean(target.closest('[contenteditable="true"]'))
    }

    function onGlobalKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      if (isTypingTarget(e.target)) return

      const root = rootRef.current
      const active = document.activeElement
      const focusedInsidePlayer = Boolean(root && active && root.contains(active))

      // In fullscreen always handle Space; inline only when player is focused.
      if (!fsOpen && !focusedInsidePlayer) return

      e.preventDefault()
      toggle()
    }

    window.addEventListener('keydown', onGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown)
    }
  }, [fsOpen])

  const isPortrait = meta ? meta.h > meta.w : false
  const maxW = isPortrait ? 360 : 520

  function Controls({ visible, onToggle, onSeek, onMute, onDownload, onFullscreen }: {
    visible: boolean
    onToggle: () => void
    onSeek: (clientX: number, el: HTMLDivElement) => void
    onMute: () => void
    onDownload: () => void
    onFullscreen: () => void
  }) {
    return (
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          px: 1,
          py: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity .15s ease',
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.52) 70%, rgba(0,0,0,.62) 100%)',
        }}
      >
        <IconButton size="small" onClick={onToggle} sx={{ color: '#fff' }}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </IconButton>

        <Box
          role="progressbar"
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,.18)',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
          onClick={(e) => {
            onSeek(e.clientX, e.currentTarget)
          }}
        >
          <Box sx={{ width: `${progressPct}%`, height: '100%', bgcolor: '#fff' }} />
        </Box>

        <IconButton size="small" onClick={onMute} sx={{ color: '#fff' }}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </IconButton>

        <IconButton size="small" onClick={onDownload} sx={{ color: '#fff' }}>
          <Download size={18} />
        </IconButton>

        <IconButton size="small" onClick={onFullscreen} sx={{ color: '#fff' }}>
          <Maximize size={18} />
        </IconButton>
      </Box>
    )
  }

  return (
    <Box
      ref={rootRef}
      sx={{
        display: 'block',
        width: '100%',
        minWidth: 0,
        maxWidth: maxW,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'transparent',
      }}
    >
      <Box
        sx={{ position: 'relative' }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.code === 'Space') {
            e.preventDefault()
            toggle()
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <video
          ref={videoRef}
          src={src}
          controls={false}
          preload="metadata"
          style={{
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            maxHeight: 360,
            display: 'block',
            objectFit: 'cover',
            borderRadius: 8,
            background: 'transparent',
          }}
          onClick={toggle}
        />

        <Controls
          visible={hover}
          onToggle={toggle}
          onSeek={seek}
          onMute={() => setMuted((prev) => !prev)}
          onDownload={downloadNow}
          onFullscreen={openFs}
        />
      </Box>

      {fsOpen ? (
        <Box
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFs()
          }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            bgcolor: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
            onMouseEnter={() => setFsHover(true)}
            onMouseLeave={() => setFsHover(false)}
          >
            <video
              ref={fsVideoRef}
              src={src}
              controls={false}
              preload="metadata"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'contain',
                background: 'black',
              }}
              onClick={toggle}
            />

            <IconButton
              onClick={closeFs}
              sx={{
                position: 'absolute',
                top: 14,
                left: 14,
                zIndex: 3,
                width: 40,
                height: 40,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,.46)',
                border: '1px solid rgba(255,255,255,.22)',
                '&:hover': { bgcolor: 'rgba(0,0,0,.62)' },
              }}
            >
              <ArrowLeft size={20} />
            </IconButton>

            <Controls
              visible={fsHover}
              onToggle={toggle}
              onSeek={seek}
              onMute={() => setMuted((prev) => !prev)}
              onDownload={downloadNow}
              onFullscreen={closeFs}
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
