import { Avatar, Box, Paper, Popover, Typography } from '@mui/material'
import { useMemo } from 'react'

export type MemberLike = {
  id: number
  username: string
  avatar_url?: string | null
  role?: string | null
  presence_status?: string | null
}

export default function UserCardPopover({
  anchorEl,
  userId,
  members,
  onClose,
}: {
  anchorEl: HTMLElement | null
  userId: number | null
  members: MemberLike[]
  onClose: () => void
}) {
  const user = useMemo(() => {
    if (!userId) return null
    return members.find((m) => Number(m.id) === Number(userId)) || null
  }, [members, userId])

  return (
    <Popover
      open={Boolean(anchorEl && userId)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: { borderRadius: 3, width: 320, overflow: 'hidden' } }}
    >
      <Box sx={{ height: 54, bgcolor: 'background.default' }} />
      <Box sx={{ px: 2, pb: 2, pt: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, mt: -3 }}>
          <Avatar
            src={user?.avatar_url ?? undefined}
            sx={{ width: 56, height: 56, border: '4px solid', borderColor: 'background.paper' }}
          >
            {(user?.username || '?').slice(0, 2).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0, pb: 0.6 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 18 }} noWrap>
              {user?.username ?? 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.presence_status ? `Status: ${user.presence_status}` : ''}
            </Typography>
          </Box>
        </Box>

        <Paper elevation={0} sx={{ mt: 1.2, p: 1.2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Profile
          </Typography>
          <Typography sx={{ mt: 0.8, fontWeight: 700 }}>{user?.role ? `Role: ${user.role}` : ' '}</Typography>
        </Paper>
      </Box>
    </Popover>
  )
}
