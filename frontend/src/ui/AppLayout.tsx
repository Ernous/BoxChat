import { useContext, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useNavigate, useRouteLoaderData } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  CirclePlus,
  Bell,
  Compass,
  Hash,
  Home,
  LogOut,
  Moon,
  Settings,
  Server,
  Sun,
  User,
} from 'lucide-react'
import { ThemeModeContext } from './theme-mode'
import SettingsPage from '../views/SettingsPage'
import { getUnreadCount, subscribeNotifications, requestBrowserNotificationPermission } from './notificationsStore'

type SessionPayload = {
  user?: {
    id: number
    username: string
    avatar_url?: string
    banner_url?: string
  }
}

type Channel = { id: number; name: string }
type Room = {
  id: number
  name: string
  type: string
  avatar_url?: string | null
  banner_url?: string | null
  channels?: Channel[]
}

const navIconSx = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  transition: 'all .18s ease',
  '&:hover': { color: 'text.primary', borderColor: 'primary.main', borderRadius: 2.2 },
}

const serverIconSx = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  border: '1px solid',
  borderColor: 'divider',
  transition: 'all .18s ease',
  '&:hover': { borderColor: 'primary.main', borderRadius: 2.2 },
}

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = useRouteLoaderData('root') as SessionPayload | undefined
  const { mode, toggleMode } = useContext(ThemeModeContext)
  const [rooms, setRooms] = useState<Room[]>([])
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomType, setRoomType] = useState<'server' | 'broadcast'>('server')
  const [creating, setCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileAnchorEl, setProfileAnchorEl] = useState<HTMLElement | null>(null)
  const [unread, setUnread] = useState(0)
  const [askedNotifPermission, setAskedNotifPermission] = useState(false)

  useEffect(() => {
    setUnread(getUnreadCount())
    return subscribeNotifications(() => setUnread(getUnreadCount()))
  }, [])

  useEffect(() => {
    if (askedNotifPermission) return
    const handler = () => {
      setAskedNotifPermission(true)
      void requestBrowserNotificationPermission()
    }
    window.addEventListener('pointerdown', handler, { once: true })
    window.addEventListener('keydown', handler, { once: true })
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [askedNotifPermission])

  useEffect(() => {
    let active = true
    async function loadRooms() {
      const res = await fetch('/api/v1/rooms', {
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }).catch(() => null)
      if (!res?.ok) return
      const payload = await res.json().catch(() => null)
      if (active) {
        setRooms(payload?.rooms ?? [])
      }
    }
    void loadRooms()
    return () => {
      active = false
    }
  }, [location.pathname])

  const dms = useMemo(() => rooms.filter((room) => room.type === 'dm'), [rooms])
  const servers = useMemo(() => rooms.filter((room) => room.type !== 'dm'), [rooms])

  const roomIdFromPath = useMemo(() => {
    const match = location.pathname.match(/^\/room\/(\d+)/)
    return match ? Number(match[1]) : null
  }, [location.pathname])

  const channelIdFromUrl = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('channel_id')
    const id = raw ? Number(raw) : null
    return id && !Number.isNaN(id) ? id : null
  }, [location.search])

  const activeRoom = useMemo(() => {
    if (!roomIdFromPath) return null
    return rooms.find((r) => Number(r.id) === Number(roomIdFromPath)) ?? null
  }, [rooms, roomIdFromPath])

  const isServerRoom = Boolean(activeRoom && activeRoom.type !== 'dm')
  const isMobileFocusedChat = Boolean(roomIdFromPath && channelIdFromUrl)

  async function handleCreateRoom() {
    const name = roomName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const body = new URLSearchParams()
      body.set('name', name)
      body.set('type', roomType)
      const res = await fetch('/create_room', {
        method: 'POST',
        body,
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        redirect: 'follow',
      })
      setCreateOpen(false)
      setRoomName('')
      if (res.url) {
        window.location.href = res.url
      } else {
        navigate('/')
      }
    } finally {
      setCreating(false)
    }
  }

  const isDashboard = location.pathname === '/'
  const isExplore = location.pathname === '/explore'
  const isNotifications = location.pathname === '/notifications'
  const isMe = location.pathname === '/settings'

  const profileOpen = Boolean(profileAnchorEl)

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: isMobileFocusedChat ? '1fr' : '72px 1fr', md: '72px 280px 1fr' },
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: { xs: isMobileFocusedChat ? 'none' : 'flex', md: 'flex' },
          flexDirection: 'column',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          height: '100vh',
          py: { xs: 1.2, md: 2 },
          gap: { xs: 0.9, md: 1.5 },
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) => (t.palette.mode === 'dark' ? '#11131c' : 'background.default'),
        }}
      >
        <Tooltip title="Dashboard">
          <IconButton
            component={RouterLink}
            to="/"
            sx={{
              ...navIconSx,
              width: { xs: 44, md: 48 },
              height: { xs: 44, md: 48 },
              ...(isDashboard ? { color: 'primary.main', borderColor: 'primary.main', borderRadius: 2.2 } : {}),
            }}
          >
            <Home size={20} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Explore">
          <IconButton
            component={RouterLink}
            to="/explore"
            sx={{
              ...navIconSx,
              width: { xs: 44, md: 48 },
              height: { xs: 44, md: 48 },
              display: 'inline-flex',
              ...(isExplore ? { color: 'primary.main', borderColor: 'primary.main', borderRadius: 2.2 } : {}),
            }}
          >
            <Compass size={20} />
          </IconButton>
        </Tooltip>
        <Divider flexItem sx={{ my: 0.3, display: { xs: 'none', md: 'block' } }} />

        <Box className="bc-scroll" sx={{ width: '100%', px: 1, overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0 }}>
          <Stack alignItems="center" spacing={1}>
            {servers.map((room) => {
              const active = roomIdFromPath === room.id
              return (
                <Tooltip key={`s-icon-${room.id}`} title={room.name} placement="right">
                  <Box sx={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 4,
                        height: active ? 26 : 0,
                        borderRadius: 999,
                        bgcolor: 'primary.main',
                        transition: 'height .16s ease',
                      }}
                    />
                    <IconButton
                      onClick={() => navigate(`/room/${room.id}${room.channels?.[0] ? `?channel_id=${room.channels[0].id}` : ''}`)}
                      sx={{
                        ...serverIconSx,
                        width: { xs: 44, md: 48 },
                        height: { xs: 44, md: 48 },
                        ...(active
                          ? {
                              borderColor: 'primary.main',
                              borderRadius: 2.2,
                              bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(88,101,242,.18)' : 'rgba(88,101,242,.12)'),
                            }
                          : {}),
                      }}
                    >
                      <Avatar
                        src={room.avatar_url ?? undefined}
                        sx={{
                          width: { xs: 32, md: 36 },
                          height: { xs: 32, md: 36 },
                          bgcolor: active ? 'primary.main' : (t) => (t.palette.mode === 'dark' ? 'background.paper' : 'background.default'),
                          color: active ? '#fff' : 'text.primary',
                          border: active ? '2px solid' : '1px solid',
                          borderColor: active ? 'primary.main' : 'divider',
                        }}
                      >
                        {room.name.slice(0, 2).toUpperCase()}
                      </Avatar>
                    </IconButton>
                  </Box>
                </Tooltip>
              )
            })}
            {!servers.length ? (
              <IconButton sx={{ ...serverIconSx, opacity: 0.5 }} disabled>
                <Server size={18} />
              </IconButton>
            ) : null}
          </Stack>
        </Box>

        <Divider flexItem sx={{ my: 0.3 }} />
        <Tooltip title="Create room">
          <IconButton onClick={() => setCreateOpen(true)} sx={{ ...navIconSx, width: { xs: 44, md: 48 }, height: { xs: 44, md: 48 }, color: 'success.main', borderColor: 'success.main' }}>
            <CirclePlus size={20} />
          </IconButton>
        </Tooltip>
        <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
          <IconButton onClick={toggleMode} sx={{ ...navIconSx, width: { xs: 44, md: 48 }, height: { xs: 44, md: 48 }, display: { xs: 'none', md: 'inline-flex' } }}>
            {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {isServerRoom ? (
          <>
            <Box
              sx={{
                px: 2,
                py: 1.6,
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundImage: activeRoom?.banner_url ? `url(${activeRoom.banner_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <Typography fontWeight={800} noWrap>
                {activeRoom?.name ?? 'Server'}
              </Typography>
            </Box>

            <Box className="bc-scroll" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.1, py: 1.1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ px: 1, py: 0.8, display: 'block', fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}
              >
                Text Channels
              </Typography>
              <List disablePadding>
                {(activeRoom?.channels ?? []).map((ch) => (
                  <ListItemButton
                    key={`ch-${ch.id}`}
                    component={RouterLink}
                    to={`/room/${activeRoom?.id}?channel_id=${ch.id}`}
                    selected={Number(channelIdFromUrl ?? 0) === Number(ch.id)}
                    sx={{ borderRadius: 2, mb: 0.25 }}
                  >
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <Hash size={16} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ noWrap: true }} primary={ch.name} />
                  </ListItemButton>
                ))}
              </List>
            </Box>

            <Box
              onClick={(e) => setProfileAnchorEl(e.currentTarget)}
              role="button"
              tabIndex={0}
              sx={{
                px: 1.4,
                py: 1.2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Avatar
                    src={session?.user?.avatar_url}
                    sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#1c0f2a' }}
                  >
                    {(session?.user?.username ?? 'U').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800} noWrap>
                      {session?.user?.username ?? 'User'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      Online
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.2}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSettingsOpen(true)
                    }}
                  >
                    <Settings size={18} />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.location.href = '/logout'
                    }}
                  >
                    <LogOut size={18} />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>
          </>
        ) : (
          <>
            <Box
              sx={{
                px: 2,
                py: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundImage: session?.user?.banner_url ? `url(${session.user.banner_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Avatar src={session?.user?.avatar_url} sx={{ width: 38, height: 38, bgcolor: 'primary.main', color: '#1c0f2a' }}>
                  {(session?.user?.username ?? 'U').slice(0, 2).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {session?.user?.username ?? 'User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    BoxChat
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Box className="bc-scroll" sx={{ px: 1.1, py: 1.2, overflowY: 'auto', minHeight: 0, flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.8, display: 'block' }}>
                Direct Messages
              </Typography>
              <List disablePadding>
                {dms.map((room) => (
                  <ListItemButton
                    key={`dm-${room.id}`}
                    component={RouterLink}
                    to={`/room/${room.id}${room.channels?.[0] ? `?channel_id=${room.channels[0].id}` : ''}`}
                    selected={roomIdFromPath === room.id}
                    sx={{ borderRadius: 2, mb: 0.4 }}
                  >
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <User size={16} />
                    </ListItemIcon>
                    <ListItemText primaryTypographyProps={{ noWrap: true }} primary={room.name} />
                  </ListItemButton>
                ))}
                {!dms.length ? (
                  <Typography variant="caption" color="text.secondary" sx={{ px: 1.2 }}>
                    no direct messages
                  </Typography>
                ) : null}
              </List>
            </Box>

            <Box
              onClick={(e) => setProfileAnchorEl(e.currentTarget)}
              role="button"
              tabIndex={0}
              sx={{
                px: 1.4,
                py: 1.2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Avatar
                    src={session?.user?.avatar_url}
                    sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#1c0f2a' }}
                  >
                    {(session?.user?.username ?? 'U').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={800} noWrap>
                      {session?.user?.username ?? 'User'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      Online
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.2}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSettingsOpen(true)
                    }}
                  >
                    <Settings size={18} />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.location.href = '/logout'
                    }}
                  >
                    <LogOut size={18} />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>
          </>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          minWidth: 0,
          height: '100vh',
          overflow: 'hidden',
          p: 0,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          className="bc-scroll"
          sx={{
            height: { xs: 'calc(100vh - 76px)', md: '100vh' },
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            pb: { xs: 'env(safe-area-inset-bottom)', md: 0 },
          }}
        >
          <Outlet context={{ rooms }} />
        </Box>

        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            height: 76,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: (t) => (t.palette.mode === 'dark' ? '#20222b' : 'background.paper'),
            px: 1.2,
            pb: 'env(safe-area-inset-bottom)',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          <Box
            role="button"
            tabIndex={0}
            onClick={() => navigate('/')}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.4,
              color: isDashboard ? 'primary.main' : 'text.secondary',
              userSelect: 'none',
            }}
          >
            <Badge color="error" badgeContent={unread ? unread : 0} invisible={!unread}>
              <Home size={20} />
            </Badge>
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              Главная
            </Typography>
          </Box>

          <Box
            role="button"
            tabIndex={0}
            onClick={() => navigate('/notifications')}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.4,
              color: isNotifications ? 'primary.main' : 'text.secondary',
              userSelect: 'none',
            }}
          >
            <Badge color="error" badgeContent={unread ? unread : 0} invisible={!unread}>
              <Bell size={20} />
            </Badge>
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              Уведомления
            </Typography>
          </Box>

          <Box
            role="button"
            tabIndex={0}
            onClick={() => setSettingsOpen(true)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.4,
              color: isMe || settingsOpen ? 'primary.main' : 'text.secondary',
              userSelect: 'none',
            }}
          >
            <Avatar src={session?.user?.avatar_url} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider' }}>
              {(session?.user?.username ?? 'U').slice(0, 1).toUpperCase()}
            </Avatar>
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              Вы
            </Typography>
          </Box>
        </Box>
      </Box>

      <Dialog open={isCreateOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create Server</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: 0.6 }}>
            <TextField label="Server Name" value={roomName} onChange={(e) => setRoomName(e.target.value)} autoFocus />
            <TextField
              select
              label="Type"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value as 'server' | 'broadcast')}
              SelectProps={{ native: true }}
            >
              <option value="server">Server</option>
              <option value="broadcast">Broadcast</option>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRoom} variant="contained" disabled={creating || !roomName.trim()}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          className: 'bc-scroll',
          sx: {
            height: { xs: '92vh', md: '86vh' },
            overflow: 'hidden',
            borderRadius: 3,
            bgcolor: 'background.default',
          },
        }}
      >
        <Box className="bc-scroll" sx={{ height: '100%', overflowY: 'auto', px: { xs: 1.2, md: 2 }, py: { xs: 1.2, md: 2 } }}>
          <Box sx={{ maxWidth: 980, mx: 'auto' }}>
            <SettingsPage />
          </Box>
        </Box>
      </Dialog>

      <Popover
        anchorEl={profileAnchorEl}
        open={profileOpen}
        onClose={() => setProfileAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { borderRadius: 3, width: 320, overflow: 'hidden' } }}
      >
        <Box
          sx={{
            height: 54,
            bgcolor: 'background.default',
            backgroundImage: session?.user?.banner_url ? `url(${session.user.banner_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <Box sx={{ px: 2, pb: 2, pt: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, mt: -3 }}>
            <Avatar
              src={session?.user?.avatar_url}
              sx={{ width: 56, height: 56, border: '4px solid', borderColor: 'background.paper', bgcolor: 'primary.main', color: '#1c0f2a' }}
            >
              {(session?.user?.username ?? 'U').slice(0, 2).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0, pb: 0.6 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 18 }} noWrap>
                {session?.user?.username ?? 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Online
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 1.2, display: 'flex', gap: 0.6, justifyContent: 'flex-end' }}>
            <IconButton
              size="small"
              onClick={() => {
                setProfileAnchorEl(null)
                setSettingsOpen(true)
              }}
            >
              <Settings size={18} />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setProfileAnchorEl(null)
                window.location.href = '/logout'
              }}
            >
              <LogOut size={18} />
            </IconButton>
          </Box>

          <Box sx={{ mt: 1.2, p: 1.2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Profile
            </Typography>
            <Typography sx={{ mt: 0.8, fontWeight: 700 }}>Role: member</Typography>
          </Box>
        </Box>
      </Popover>
    </Box>
  )
}
