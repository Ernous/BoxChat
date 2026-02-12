import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouteLoaderData, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ArrowDown, ArrowLeft, CornerUpLeft, Forward, MoreHorizontal, Reply, SmilePlus, Download, FileText, Settings2 } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import CustomVideoPlayer from '../ui/CustomVideoPlayer'
import CustomAudioPlayer from '../ui/CustomAudioPlayer'
import UserCardPopover from '../ui/UserCardPopover'
import ChatComposer from '../ui/ChatComposer'
import MessageContextMenu from '../ui/MessageContextMenu'
import ServerSettingsDialog from '../ui/ServerSettingsDialog'
import { addNotification, showBrowserNotification } from '../ui/notificationsStore'

type SessionPayload = { user?: { id: number; username: string } }
type Channel = { id: number; name: string; description?: string }
type Room = { id: number; name: string; channels: Channel[]; type?: string }
type MessageItem = {
  id: number
  user_id: number
  username: string
  avatar_url?: string | null
  content: string
  timestamp: string
  message_type?: string
  file_url?: string | null
  reactions?: Record<string, string[]>
  reply_to_id?: number | null
  reply_to?: { id: number; username: string; snippet: string } | null
}

type RenderRow =
  | { type: 'date'; key: string; dateLabel: string }
  | { type: 'message'; key: string; m: MessageItem; showHeader: boolean }
type RoomMember = {
  id: number
  username: string
  role?: string
  avatar_url?: string | null
  presence_status?: string
}
type RoomRole = { id: number; name: string; mention_tag: string }

export default function RoomPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { roomId } = useParams()
  const session = useRouteLoaderData('root') as SessionPayload | undefined
  const [searchParams, setSearchParams] = useSearchParams()
  const currentChannelIdFromUrl = Number(searchParams.get('channel_id') || 0)

  const [room, setRoom] = useState<Room | null>(null)
  const [channelId, setChannelId] = useState<number | null>(currentChannelIdFromUrl || null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [roles, setRoles] = useState<RoomRole[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sendingFile, setSendingFile] = useState(false)

  const [msgMenu, setMsgMenu] = useState<{ mouseX: number; mouseY: number; msg: MessageItem } | null>(null)
  const [reactionMenu, setReactionMenu] = useState<{ mouseX: number; mouseY: number; msg: MessageItem } | null>(null)
  const [allowedReactions, setAllowedReactions] = useState<string[]>([])

  const [replyTo, setReplyTo] = useState<{ id: number; username: string; snippet: string } | null>(null)

  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const lastChannelIdRef = useRef<number | null>(null)
  const [jumpToPresent, setJumpToPresent] = useState(false)
  const [highlightMsgId, setHighlightMsgId] = useState<number | null>(null)
  const pendingBottomRef = useRef(false)
  const prefetchingRef = useRef(false)
  const pendingPrependRef = useRef<{ prevHeight: number; prevTop: number } | null>(null)

  const [userCardAnchor, setUserCardAnchor] = useState<HTMLElement | null>(null)
  const [userCardUserId, setUserCardUserId] = useState<number | null>(null)

  const myMember = useMemo(() => members.find((m) => m.id === session?.user?.id), [members, session?.user?.id])
  const isRoomAdmin = myMember?.role === 'owner' || myMember?.role === 'admin'
  const activeChannel = useMemo(() => room?.channels.find((c) => c.id === channelId) ?? null, [room?.channels, channelId])

  const mentionCandidates = useMemo(() => {
    if (mentionStart == null) return []
    const q = mentionQuery.toLowerCase()
    const roleItems = roles
      .filter((r) => !q || r.mention_tag.toLowerCase().startsWith(q))
      .map((r) => ({ type: 'role' as const, value: r.mention_tag }))
    const userItems = members
      .filter((m) => m.id !== session?.user?.id)
      .filter((m) => !q || m.username.toLowerCase().startsWith(q))
      .map((m) => ({ type: 'user' as const, value: m.username }))
    return [...roleItems, ...userItems].slice(0, 10)
  }, [mentionStart, mentionQuery, roles, members, session?.user?.id])

  async function loadRoomData() {
    const roomRes = await fetch('/api/v1/rooms', {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    }).catch(() => null)
    if (!roomRes?.ok) return
    const roomPayload = await roomRes.json().catch(() => null)
    const foundRoom = (roomPayload?.rooms ?? []).find((r: Room) => String(r.id) === String(roomId))
    if (!foundRoom) return

    setRoom(foundRoom)
    const firstChannelId = foundRoom.channels?.[0]?.id ?? null
    const nextChannelId = currentChannelIdFromUrl || (isMobile ? null : firstChannelId)
    setChannelId(nextChannelId)
    if (nextChannelId && !isMobile) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)
        params.set('channel_id', String(nextChannelId))
        return params
      })
    }
    const [membersRes, rolesRes] = await Promise.all([
      fetch(`/api/v1/room/${roomId}/members`, {
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }).catch(() => null),
      fetch(`/api/v1/room/${roomId}/roles`, {
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }).catch(() => null),
    ])
    if (membersRes?.ok) {
      const p = await membersRes.json().catch(() => null)
      setMembers(p?.members ?? [])
    }
    if (rolesRes?.ok) {
      const p = await rolesRes.json().catch(() => null)
      setRoles(p?.roles ?? [])
    }
  }

  async function sendGif(url: string) {
    if (!socket || !roomId || !channelId) return
    socket.emit('send_message', {
      room_id: Number(roomId),
      channel_id: channelId,
      msg: '',
      message_type: 'image',
      file_url: url,
      reply_to: replyTo ? { id: replyTo.id } : null,
    })
    setReplyTo(null)
  }

  async function toggleReaction(messageId: number, emoji: string) {
    const res = await fetch(`/message/${messageId}/reaction`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ emoji, reaction_type: 'emoji' }),
    }).catch(() => null)

    if (!res?.ok) return
    const payload = await res.json().catch(() => null)
    const reactions = payload?.reactions
    if (reactions && typeof reactions === 'object') {
      setMessages((prev) => prev.map((m) => (Number(m.id) === Number(messageId) ? { ...m, reactions } : m)))
    }
  }

  function renderReactions(m: MessageItem) {
    const reactions = m.reactions ?? {}
    const me = session?.user?.username
    const items = Object.entries(reactions)
      .map(([emoji, users]) => ({ emoji, users: Array.isArray(users) ? users : [], count: Array.isArray(users) ? users.length : 0 }))
      .filter((x) => x.count > 0)
    if (!items.length) return null
    return (
      <Stack direction="row" spacing={0.8} sx={{ mt: 0.7, px: 0.2, flexWrap: 'wrap' }}>
        {items.map((r) => (
          (() => {
            const mine = Boolean(me && r.users.includes(me))
            return (
          <Button
            key={r.emoji}
            size="small"
            variant={mine ? 'contained' : 'outlined'}
            onClick={() => void toggleReaction(m.id, r.emoji)}
            sx={{
              minWidth: 0,
              px: 1.1,
              py: 0.35,
              borderRadius: 2.2,
              borderColor: mine ? 'primary.main' : 'divider',
              color: mine ? 'primary.contrastText' : 'text.primary',
              lineHeight: 1,
              fontWeight: 800,
            }}
          >
            {r.emoji} {r.count}
          </Button>
            )
          })()
        ))}
      </Stack>
    )
  }

  async function deleteMessageById(messageId: number) {
    const res = await fetch(`/message/${messageId}/delete`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    }).catch(() => null)
    if (!res?.ok) return
    setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(messageId)))
  }

  async function loadMessagesPage(nextOffset: number, reset: boolean) {
    if (!channelId) return
    if (!reset && scrollRef.current) {
      const el = scrollRef.current
      pendingPrependRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop }
    }
    const limit = 50
    const res = await fetch(`/api/v1/channel/${channelId}/messages?limit=${limit}&offset=${nextOffset}`, {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    }).catch(() => null)
    if (!res?.ok) return
    const payload = await res.json().catch(() => null)
    const base: MessageItem[] = (payload?.messages ?? []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      username: m.username,
      avatar_url: m.avatar_url ?? null,
      content: m.content,
      timestamp: m.timestamp,
      message_type: m.message_type,
      file_url: m.file_url,
      reactions: m.reactions ?? {},
      reply_to_id: m.reply_to_id ?? null,
      reply_to: null,
    }))

    const byId = new Map<number, MessageItem>()
    for (const m of base) byId.set(Number(m.id), m)
    for (const m of base) {
      const rid = m.reply_to_id ? Number(m.reply_to_id) : 0
      if (!rid) continue
      const orig = byId.get(rid)
      if (!orig) continue
      const snippet = (orig.content || '').split('\n')[0].slice(0, 140)
      m.reply_to = { id: orig.id, username: orig.username, snippet }
    }

    setHasMore(base.length === limit)
    setOffset(nextOffset)
    setMessages((prev) => {
      if (reset) return base
      const existing = new Set(prev.map((m) => Number(m.id)))
      const merged = [...base.filter((m) => !existing.has(Number(m.id))), ...prev]
      return merged
    })
  }

  useEffect(() => {
    let active = true
    async function loadAllowedReactions() {
      const res = await fetch('/api/v1/reactions', {
        credentials: 'include',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }).catch(() => null)
      if (!res?.ok) return
      const p = await res.json().catch(() => null)
      if (!active) return
      setAllowedReactions(Array.isArray(p?.reactions) ? p.reactions : [])
    }
    void loadAllowedReactions()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    void loadRoomData()
  }, [roomId, currentChannelIdFromUrl, isMobile])

  useEffect(() => {
    if (!channelId) return
    pendingBottomRef.current = true
    setHasMore(true)
    setOffset(0)
    void loadMessagesPage(0, true)
  }, [channelId])

  useEffect(() => {
    if (!pendingBottomRef.current) return
    if (!messages.length) return

    let rowCount = 0
    for (let idx = 0; idx < messages.length; idx += 1) {
      const m = messages[idx]
      const prev = idx > 0 ? messages[idx - 1] : null
      const showDate = !prev || dayKey(prev.timestamp) !== dayKey(m.timestamp)
      if (showDate) rowCount += 1
      rowCount += 1
    }

    if (rowCount <= 0) return
    window.requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }
      pendingBottomRef.current = false
      setJumpToPresent(false)
    })
  }, [messages.length])

  useEffect(() => {
    const pend = pendingPrependRef.current
    const el = scrollRef.current
    if (!pend || !el) return
    pendingPrependRef.current = null
    window.requestAnimationFrame(() => {
      const nextHeight = el.scrollHeight
      const delta = nextHeight - pend.prevHeight
      el.scrollTop = pend.prevTop + delta
    })
  }, [messages.length])

  useEffect(() => {
    if (!channelId) return
    const s = io({ withCredentials: true })
    setSocket(s)
    s.on('connect', () => s.emit('join', { channel_id: channelId }))
    s.on('receive_message', (data: any) => {
      if (Number(data.channel_id ?? channelId) !== Number(channelId)) return
      const el = scrollRef.current
      const wasNearBottom =
        !!el && (el.scrollHeight - el.scrollTop - el.clientHeight < 180)

      const isFocused = typeof document !== 'undefined' ? document.hasFocus() : true
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          user_id: data.user_id,
          username: data.username,
          avatar_url: data.avatar ?? null,
          content: data.msg ?? '',
          timestamp: data.timestamp_iso ?? new Date().toISOString(),
          message_type: data.message_type,
          file_url: data.file_url,
          reactions: data.reactions ?? {},
          reply_to_id: data?.reply_to?.id ?? null,
          reply_to: data?.reply_to ?? null,
        },
      ])

      if (!wasNearBottom || !isFocused) {
        const msgText = (data.msg ?? '').toString().trim()
        const body = msgText ? msgText.slice(0, 180) : (data.file_url ? 'Attachment' : 'New message')
        const href = `/room/${roomId}?channel_id=${channelId}`
        addNotification({ title: data.username ?? 'Message', body, href })
        showBrowserNotification(data.username ?? 'Message', body, href)
      }
      if (wasNearBottom) {
        window.requestAnimationFrame(() => {
          const el2 = scrollRef.current
          if (el2) el2.scrollTop = el2.scrollHeight
        })
      }
    })
    s.on('reactions_updated', (data: any) => {
      const messageId = Number(data?.message_id ?? 0)
      if (!messageId) return
      setMessages((prev) =>
        prev.map((m) => (Number(m.id) === messageId ? { ...m, reactions: data?.reactions ?? {} } : m)),
      )
    })
    s.on('message_deleted', (data: any) => {
      if (Number(data?.channel_id ?? 0) !== Number(channelId)) return
      const messageId = Number(data?.message_id ?? 0)
      if (!messageId) return
      setMessages((prev) => prev.filter((m) => Number(m.id) !== messageId))
    })
    return () => {
      s.disconnect()
      setSocket(null)
    }
  }, [channelId])

  useEffect(() => {
    lastChannelIdRef.current = channelId
  }, [channelId])

  function formatTime(ts: string) {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateLabel(ts: string) {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  }

  function dayKey(ts: string) {
    const d = new Date(ts)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }

  function trackMention(value: string, caret: number) {
    const left = value.slice(0, caret)
    const match = left.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/)
    if (!match) {
      setMentionStart(null)
      setMentionQuery('')
      return
    }
    const q = match[1] ?? ''
    setMentionQuery(q)
    setMentionStart(caret - q.length - 1)
  }

  function applyMention(mentionValue: string) {
    if (mentionStart === null) return
    const before = input.slice(0, mentionStart)
    const next = `${before}@${mentionValue} `
    setInput(next)
    setMentionQuery('')
    setMentionStart(null)
  }

  function openChannelOnMobile(nextChannelId: number) {
    setChannelId(nextChannelId)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('channel_id', String(nextChannelId))
      return params
    })
  }

  function backToChannelPicker() {
    setChannelId(null)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.delete('channel_id')
      return params
    })
  }

  async function sendMessage() {
    if (!socket || !roomId || !channelId) return
    const text = input.trim()
    if (!text) return
    socket.emit('send_message', {
      room_id: Number(roomId),
      channel_id: channelId,
      msg: text,
      message_type: 'text',
      reply_to: replyTo ? { id: replyTo.id } : null,
    })
    setInput('')
    setMentionQuery('')
    setMentionStart(null)
    setReplyTo(null)
  }

  async function uploadAndSendFile(file: File) {
    if (!socket || !roomId || !channelId) return
    const MAX_5GB = 5 * 1024 * 1024 * 1024
    if (file.size > MAX_5GB) {
      setError('Лимит файла — 5 GB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setSendingFile(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const uploadRes = await fetch('/upload_file', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const payload = await uploadRes.json().catch(() => null)
      if (!uploadRes.ok || !payload?.url) throw new Error(payload?.error ?? 'upload failed')

      socket.emit('send_message', {
        room_id: Number(roomId),
        channel_id: channelId,
        msg: input.trim(),
        message_type: payload.type || 'file',
        file_url: payload.url,
        reply_to: replyTo ? { id: replyTo.id } : null,
      })
      setInput('')
      setReplyTo(null)
    } catch (e: any) {
      setError(e?.message ?? 'upload failed')
    } finally {
      setSendingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function renderMentions(content: string) {
    const parts = content.split(/(@[a-zA-Z0-9_-]+)/g)
    return parts.map((part, i) =>
      /^@[a-zA-Z0-9_-]+$/.test(part) ? (
        <Box key={`${part}-${i}`} component="span" sx={{ color: 'secondary.main', fontWeight: 700 }}>
          {part}
        </Box>
      ) : (
        <span key={`${part}-${i}`}>{part}</span>
      ),
    )
  }

  function renderReplyHeader(m: MessageItem) {
    const r = m.reply_to
    if (!r) return null
    return (
      <Stack
        direction="row"
        spacing={0.8}
        alignItems="center"
        sx={{ mb: 0.4, color: 'text.secondary', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => {
          const el = document.getElementById(`msg-${r.id}`)
          if (el) {
            el.scrollIntoView({ behavior: 'auto', block: 'center' })
            setHighlightMsgId(r.id)
            window.setTimeout(() => setHighlightMsgId((prev) => (prev === r.id ? null : prev)), 1400)
          }
        }}
      >
        <Box sx={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CornerUpLeft size={14} />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 800 }} noWrap>
          {r.username}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }} noWrap>
          {r.snippet}
        </Typography>
      </Stack>
    )
  }

  function renderMessageBody(m: MessageItem) {
    const type = m.message_type || 'text'
    const mediaMaxWidth = { xs: 'min(100%, calc(100vw - 112px))', sm: 'min(100%, 420px)', md: 420 }
    if (type === 'image' && !m.file_url) {
      const maybeUrl = (m.content || '').trim()
      if (/^https?:\/\//.test(maybeUrl)) {
        return <Box component="img" src={maybeUrl} alt="attachment" sx={{ width: '100%', maxWidth: mediaMaxWidth, borderRadius: 1, display: 'block' }} />
      }
    }
    if ((type === 'image' || type === 'sticker') && m.file_url) {
      return <Box component="img" src={m.file_url} alt="attachment" sx={{ width: '100%', maxWidth: mediaMaxWidth, borderRadius: 1, display: 'block' }} />
    }
    if (type === 'video' && m.file_url) {
      return (
        <CustomVideoPlayer src={m.file_url} />
      )
    }
    if (type === 'music' && m.file_url) {
      return (
        <CustomAudioPlayer src={m.file_url} title={m.file_url.split('/').pop()} />
      )
    }
    if (type === 'file' && m.file_url) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 0.8, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <FileText size={15} />
          <Typography sx={{ maxWidth: 180 }} noWrap>{m.file_url.split('/').pop()}</Typography>
          <Button size="small" href={m.file_url} target="_blank" startIcon={<Download size={14} />}>Open</Button>
        </Stack>
      )
    }
    return <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderMentions(m.content || '')}</Typography>
  }

  const rendered = useMemo<RenderRow[]>(() => {
    const rows: RenderRow[] = []
    for (let idx = 0; idx < messages.length; idx += 1) {
      const m = messages[idx]
      const prev = idx > 0 ? messages[idx - 1] : null
      const showDate = !prev || dayKey(prev.timestamp) !== dayKey(m.timestamp)

      if (showDate) {
        rows.push({ type: 'date', key: `date-${dayKey(m.timestamp)}-${m.id}`, dateLabel: formatDateLabel(m.timestamp) })
      }

      const sameAuthor = prev && prev.user_id === m.user_id
      const withinWindow = prev ? Math.abs(new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime()) < 5 * 60 * 1000 : false
      const grouped = Boolean(prev && sameAuthor && withinWindow && !showDate)
      const showHeader = !grouped

      rows.push({ type: 'message', key: `msg-${m.id}`, m, showHeader })
    }
    return rows
  }, [messages])

  return (
    <Box sx={{ height: '100%', minHeight: 0, width: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {error ? <Alert severity="warning" sx={{ borderRadius: 0 }}>
        {error}
      </Alert> : null}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: 0,
          gridTemplateColumns: { xs: '1fr', md: '1fr 240px' },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            bgcolor: 'background.default',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            height: '100%',
            minWidth: 0,
            width: '100%',
            overflowX: 'hidden',
          }}
        >
          {isMobile && !channelId ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ px: 1.2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1.1 }}>{room?.name ?? 'Server'}</Typography>
                <Typography variant="caption" color="text.secondary">Выберите канал</Typography>
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
                  {(room?.channels ?? []).map((ch) => (
                    <ListItemButton
                      key={`m-ch-${ch.id}`}
                      onClick={() => openChannelOnMobile(ch.id)}
                      sx={{ borderRadius: 2, mb: 0.25 }}
                    >
                      <Typography sx={{ minWidth: 26, color: 'text.secondary' }}>#</Typography>
                      <ListItemText primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 700 } }} primary={ch.name} />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            </Box>
          ) : null}

          {!(isMobile && !channelId) ? (
          <>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              px: { xs: 1.2, md: 2.2 },
              height: { xs: 56, md: 64 },
              bgcolor: 'background.paper',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                {isMobile ? (
                  <IconButton size="small" onClick={backToChannelPicker} sx={{ ml: -0.6, mr: 0.2 }}>
                    <ArrowLeft size={18} />
                  </IconButton>
                ) : null}
                {room?.type === 'broadcast' ? '📢' : '#'}
                {activeChannel ? activeChannel.name : 'Chat'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                {room?.name ?? `Room ${roomId}`}
              </Typography>
            </Box>
            {isRoomAdmin ? (
              <Button size="small" startIcon={<Settings2 size={14} />} onClick={() => setSettingsOpen(true)} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                Server settings
              </Button>
            ) : null}
          </Stack>

          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {!messages.length ? <Typography color="text.secondary" sx={{ px: 3, py: 2 }}>no messages yet</Typography> : null}

            <Box
              ref={(el: HTMLDivElement | null) => {
                scrollRef.current = el
              }}
              className="bc-scroll"
              sx={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', overflowAnchor: 'none' }}
              onScroll={(e) => {
                const el = e.currentTarget
                const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
                setJumpToPresent(remaining > 220)

                if (prefetchingRef.current) return
                if (!hasMore || loadingOlder) return
                if (el.scrollTop > 140) return
                prefetchingRef.current = true
                setLoadingOlder(true)
                void loadMessagesPage(offset + 50, false).finally(() => {
                  prefetchingRef.current = false
                  setLoadingOlder(false)
                })
              }}
            >
              {loadingOlder ? (
                <Box sx={{ pt: 1.2, pb: 0.6, display: 'flex', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Loading messages...
                  </Typography>
                </Box>
              ) : null}

              {rendered.map((item) => {
                if (item.type === 'date') {
                  return (
                    <Box key={item.key} sx={{ py: 1.1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        {item.dateLabel}
                      </Typography>
                      <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
                    </Box>
                  )
                }

                const m = item.m
                return (
                  <Box
                    key={item.key}
                    id={`msg-${m.id}`}
                    sx={{
                      px: 1,
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      borderRadius: 2,
                      transition: 'background-color .25s ease',
                      bgcolor: highlightMsgId === m.id ? 'rgba(88,101,242,.22)' : 'transparent',
                    }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ py: 0.6, width: '100%', minWidth: 0 }}>
                      <Box sx={{ width: 44, display: 'flex', justifyContent: 'center' }}>
                        {item.showHeader ? (
                          <Avatar
                            src={m.avatar_url ?? undefined}
                            sx={{ width: 34, height: 34, cursor: 'pointer' }}
                            onClick={(e) => {
                              setUserCardAnchor(e.currentTarget)
                              setUserCardUserId(m.user_id)
                            }}
                          >
                            {m.username.slice(0, 2).toUpperCase()}
                          </Avatar>
                        ) : null}
                      </Box>

                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          position: 'relative',
                          borderRadius: 1.5,
                          px: 0.8,
                          py: 0.4,
                          '&:hover': { bgcolor: 'rgba(255,255,255,.04)' },
                          '&:hover .bc-msg-toolbar': { opacity: 1, pointerEvents: 'auto' },
                          '&:focus-within .bc-msg-toolbar': { opacity: 1, pointerEvents: 'auto' },
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setMsgMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6, msg: m })
                        }}
                        tabIndex={0}
                      >
                        <Box
                          className="bc-msg-toolbar"
                          sx={{
                            position: 'absolute',
                            right: 6,
                            top: -18,
                            display: 'flex',
                            gap: 0.4,
                            zIndex: 5,
                            opacity: 0,
                            pointerEvents: 'none',
                            transition: 'opacity .12s ease',
                          }}
                        >
                          <Box sx={{ display: 'flex', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setReactionMenu({ mouseX: window.innerWidth - 340, mouseY: 120, msg: m })
                              }}
                              sx={{ borderRadius: 0 }}
                            >
                              <SmilePlus size={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                const snippet = (m.content || '').split('\n')[0].slice(0, 140)
                                setReplyTo({ id: m.id, username: m.username, snippet })
                              }}
                              sx={{ borderRadius: 0 }}
                            >
                              <Reply size={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setError('Функция пересылки пока недоступна')
                              }}
                              sx={{ borderRadius: 0 }}
                            >
                              <Forward size={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setMsgMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6, msg: m })
                              }}
                              sx={{ borderRadius: 0 }}
                            >
                              <MoreHorizontal size={16} />
                            </IconButton>
                          </Box>
                        </Box>

                        {item.showHeader ? (
                          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.15 }}>
                            <Typography
                              sx={{ fontWeight: 900, cursor: 'pointer' }}
                              noWrap
                              onClick={(e) => {
                                setUserCardAnchor(e.currentTarget)
                                setUserCardUserId(m.user_id)
                              }}
                            >
                              {m.username}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {formatTime(m.timestamp)}
                            </Typography>
                          </Stack>
                        ) : null}

                        {m.reply_to ? renderReplyHeader(m) : null}
                        {renderMessageBody(m)}
                        {renderReactions(m)}
                      </Box>
                    </Stack>
                  </Box>
                )
              })}
              <div ref={messagesEndRef} style={{ height: 1 }} />
            </Box>

            {jumpToPresent ? (
              <Box sx={{ position: 'absolute', right: 14, bottom: 14, display: 'flex', justifyContent: 'flex-end', zIndex: 28 }}>
                <IconButton
                  size="medium"
                  color="primary"
                  onClick={() => {
                    try {
                      const el = scrollRef.current
                      if (el) el.scrollTop = el.scrollHeight
                    } catch {
                      // ignore
                    }
                    setJumpToPresent(false)
                  }}
                  sx={{
                    width: 46,
                    height: 46,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: (t) => (t.palette.mode === 'dark' ? '0 10px 26px rgba(0,0,0,.45)' : '0 10px 26px rgba(0,0,0,.2)'),
                    '&:hover': { bgcolor: 'background.default' },
                  }}
                >
                  <ArrowDown size={20} />
                </IconButton>
              </Box>
            ) : null}
          </Box>

        <ChatComposer
          channelId={channelId}
          input={input}
          setInput={setInput}
          placeholder={channelId ? `Message #${activeChannel?.name ?? ''}` : 'Select a channel'}
          onSend={() => void sendMessage()}
          sendingFile={sendingFile}
          fileInputRef={fileInputRef}
          onPickFile={(f) => {
            void uploadAndSendFile(f)
          }}
          mentionCandidates={mentionCandidates as any}
          applyMention={applyMention}
          onTrackMention={trackMention}
          replyTo={replyTo as any}
          onClearReply={() => setReplyTo(null)}
          onPickGif={(url) => {
            void sendGif(url)
          }}
        />
          </>
          ) : null}

        </Paper>

        <Paper
          elevation={0}
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRadius: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Members
            </Typography>
          </Box>
          <Box className="bc-scroll" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.2, py: 1.1 }}>
            <List disablePadding>
              {members.map((m) => {
                const dot = m.presence_status === 'online' ? '#23a559' : m.presence_status === 'away' ? '#f0b232' : '#80848e'
                return (
                  <ListItemButton
                    key={m.id}
                    sx={{ borderRadius: 2, mb: 0.25, py: 0.7 }}
                    onClick={(e) => {
                      setUserCardAnchor(e.currentTarget)
                      setUserCardUserId(m.id)
                    }}
                  >
                    <Box sx={{ position: 'relative', mr: 1 }}>
                      <Avatar src={m.avatar_url ?? undefined} sx={{ width: 30, height: 30 }}>
                        {m.username.slice(0, 2).toUpperCase()}
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          right: -1,
                          bottom: -1,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: dot,
                          border: '2px solid',
                          borderColor: 'background.paper',
                        }}
                      />
                    </Box>
                    <ListItemText
                      primary={m.username}
                      primaryTypographyProps={{ sx: { fontWeight: 700 } }}
                      secondary={m.role && m.role !== 'member' ? m.role : undefined}
                      secondaryTypographyProps={{ sx: { color: 'text.secondary' } }}
                    />
                  </ListItemButton>
                )
              })}
            </List>
          </Box>
        </Paper>
      </Box>

      <ServerSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={Number(roomId || 0)}
      />

      <MessageContextMenu
        menu={msgMenu as any}
        onClose={() => setMsgMenu(null)}
        canDelete={Boolean(msgMenu?.msg && (Number(msgMenu.msg.user_id) === Number(session?.user?.id) || isRoomAdmin))}
        onAddReaction={() => {
          if (!msgMenu) return
          setReactionMenu({ mouseX: msgMenu.mouseX + 260, mouseY: msgMenu.mouseY, msg: msgMenu.msg })
          setMsgMenu(null)
        }}
        onReply={() => {
          const m = msgMenu?.msg
          if (!m) return
          const snippet = (m.content || '').split('\n')[0].slice(0, 140)
          setReplyTo({ id: m.id, username: m.username, snippet })
          setMsgMenu(null)
        }}
        onForward={() => {
          setError('Функция пересылки пока недоступна')
          setMsgMenu(null)
        }}
        onCopy={() => {
          const m = msgMenu?.msg
          if (!m) return
          try {
            void navigator.clipboard.writeText(m.content || m.file_url || '')
          } catch {
            // ignore
          }
          setMsgMenu(null)
        }}
        onDelete={() => {
          const m = msgMenu?.msg
          if (!m) return
          void deleteMessageById(m.id)
          setMsgMenu(null)
        }}
      />

      <Menu
        open={Boolean(reactionMenu)}
        onClose={() => setReactionMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={reactionMenu ? { top: reactionMenu.mouseY, left: reactionMenu.mouseX } : undefined}
      >
        <Box sx={{ px: 1, py: 0.6, display: 'flex', gap: 0.6, flexWrap: 'wrap', maxWidth: 260 }}>
          {allowedReactions.map((e) => (
            <Button
              key={e}
              size="small"
              variant="outlined"
              onClick={() => {
                const m = reactionMenu?.msg
                if (!m) return
                void toggleReaction(m.id, e)
                setReactionMenu(null)
              }}
              sx={{ minWidth: 0, px: 1.1, py: 0.35, borderRadius: 2.2, fontWeight: 800 }}
            >
              {e}
            </Button>
          ))}
        </Box>
      </Menu>

      <UserCardPopover
        anchorEl={userCardAnchor}
        userId={userCardUserId}
        members={members as any}
        onClose={() => {
          setUserCardAnchor(null)
          setUserCardUserId(null)
        }}
      />
    </Box>
  )
}
