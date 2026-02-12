import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

type Role = { id: number; name: string; mention_tag: string }
type Member = { id: number; username: string; role?: string }

export default function ServerSettingsDialog({
  open,
  onClose,
  roomId,
}: {
  open: boolean
  onClose: () => void
  roomId: number
}) {
  const [tab, setTab] = useState(0)
  const [roles, setRoles] = useState<Role[]>([])
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    if (!open) return
    let alive = true
    async function load() {
      const [rolesRes, membersRes] = await Promise.all([
        fetch(`/api/v1/room/${roomId}/roles`, { credentials: 'include', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }).catch(() => null),
        fetch(`/api/v1/room/${roomId}/members`, { credentials: 'include', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }).catch(() => null),
      ])
      if (!alive) return
      if (rolesRes?.ok) {
        const p = await rolesRes.json().catch(() => null)
        setRoles(Array.isArray(p?.roles) ? p.roles : [])
      }
      if (membersRes?.ok) {
        const p = await membersRes.json().catch(() => null)
        setMembers(Array.isArray(p?.members) ? p.members : [])
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [open, roomId])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>Server settings</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
          <Tab label="Обзор" />
          <Tab label="Роли" />
          <Tab label="Участники" />
        </Tabs>

        {tab === 0 ? (
          <Box sx={{ mt: 2 }}>
            <Typography color="text.secondary">
              Здесь будут настройки сервера (роли/права/инвайты/баны). Сейчас восстановила рабочую основу.
            </Typography>
          </Box>
        ) : null}

        {tab === 1 ? (
          <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
            {roles.map((r) => (
              <Box key={r.id} sx={{ p: 1.2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Typography fontWeight={800}>{r.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  @{r.mention_tag}
                </Typography>
              </Box>
            ))}
            {!roles.length ? <Typography color="text.secondary">Нет ролей</Typography> : null}
          </Box>
        ) : null}

        {tab === 2 ? (
          <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
            {members.map((m) => (
              <Box key={m.id} sx={{ p: 1.2, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
                <Typography fontWeight={800} sx={{ flex: 1 }}>
                  {m.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {m.role || 'member'}
                </Typography>
              </Box>
            ))}
            {!members.length ? <Typography color="text.secondary">Нет участников</Typography> : null}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 2.4, pb: 2.2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
