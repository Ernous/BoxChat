import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material'
import { markAllRead, getNotifications, markRead, subscribeNotifications, type AppNotification } from '../ui/notificationsStore'

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ''
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>(() => getNotifications())

  useEffect(() => {
    return subscribeNotifications(() => setItems(getNotifications()))
  }, [])

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items])

  return (
    <Stack spacing={1.2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 1.4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={900}>
              Notifications
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Unread: {unread}
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => markAllRead()}
            disabled={!unread}
            variant="contained"
          >
            Mark all read
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={0} className="bc-scroll" sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        <Box className="bc-scroll" sx={{ overflowY: 'auto', height: '100%' }}>
          {!items.length ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              No notifications.
            </Typography>
          ) : null}

          {items.map((n, idx) => (
            <Box key={n.id}>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => {
                  markRead(n.id)
                  if (n.href) window.location.href = n.href
                }}
                sx={{
                  p: 1.4,
                  cursor: n.href ? 'pointer' : 'default',
                  bgcolor: n.read ? 'transparent' : 'rgba(88,101,242,.12)',
                  '&:hover': { bgcolor: n.read ? 'rgba(255,255,255,.04)' : 'rgba(88,101,242,.16)' },
                }}
              >
                <Stack spacing={0.2}>
                  <Typography fontWeight={900} noWrap>
                    {n.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {n.body}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(n.createdAt)}
                  </Typography>
                </Stack>
              </Box>
              {idx !== items.length - 1 ? <Divider /> : null}
            </Box>
          ))}
        </Box>
      </Paper>
    </Stack>
  )
}
