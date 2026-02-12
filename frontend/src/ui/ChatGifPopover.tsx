import { Box, ClickAwayListener, IconButton, Paper, Tooltip, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import GifPicker from './GifPicker'

export default function ChatGifPopover({
  disabled,
  onPick,
}: {
  disabled: boolean
  onPick: (url: string) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <Tooltip title="GIF">
        <span>
          <IconButton size="small" onClick={() => setOpen((prev) => !prev)} disabled={disabled} sx={{ px: { xs: 0.7, md: 1 } }}>
            <Box sx={{ display: { xs: 'inline-flex', md: 'none' }, alignItems: 'center' }}>
              <Gift size={16} />
            </Box>
            <Typography sx={{ display: { xs: 'none', md: 'inline' }, fontWeight: 900, fontSize: 12, letterSpacing: 0.6 }}>GIF</Typography>
          </IconButton>
        </span>
      </Tooltip>

      {open ? (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Paper
            sx={{
              position: 'absolute',
              right: 0,
              bottom: 'calc(100% + 12px)',
              width: 720,
              maxWidth: '92vw',
              maxHeight: 'calc(100vh - 140px)',
              borderRadius: 3,
              p: 2,
              overflow: 'hidden',
              zIndex: (t) => t.zIndex.modal + 1,
              boxShadow: (t) => (t.palette.mode === 'dark' ? '0 18px 60px rgba(0,0,0,.55)' : '0 18px 60px rgba(0,0,0,.18)'),
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <GifPicker
              open={open}
              variant="panel"
              onClose={() => {
                setOpen(false)
              }}
              onPick={(url) => {
                setOpen(false)
                onPick(url)
              }}
            />
          </Paper>
        </ClickAwayListener>
      ) : null}
    </Box>
  )
}
