import { Divider, ListItemIcon, Menu, MenuItem } from '@mui/material'
import { Copy, Forward, Reply, SmilePlus, Trash2 } from 'lucide-react'

type MessageItem = {
  id: number
  user_id: number
  username: string
  content: string
  file_url?: string | null
}

export default function MessageContextMenu({
  menu,
  onClose,
  canDelete,
  onAddReaction,
  onReply,
  onForward,
  onCopy,
  onDelete,
}: {
  menu: { mouseX: number; mouseY: number; msg: MessageItem } | null
  onClose: () => void
  canDelete: boolean
  onAddReaction: () => void
  onReply: () => void
  onForward: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  return (
    <Menu
      open={Boolean(menu)}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={menu ? { top: menu.mouseY, left: menu.mouseX } : undefined}
      PaperProps={{
        sx: {
          borderRadius: 2,
          minWidth: 220,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        },
      }}
    >
      <MenuItem
        onClick={() => {
          onAddReaction()
        }}
      >
        <ListItemIcon sx={{ minWidth: 34 }}>
          <SmilePlus size={16} />
        </ListItemIcon>
        Добавить реакцию
      </MenuItem>

      <MenuItem
        onClick={() => {
          onReply()
        }}
      >
        <ListItemIcon sx={{ minWidth: 34 }}>
          <Reply size={16} />
        </ListItemIcon>
        Ответить
      </MenuItem>

      <MenuItem
        onClick={() => {
          onForward()
        }}
      >
        <ListItemIcon sx={{ minWidth: 34 }}>
          <Forward size={16} />
        </ListItemIcon>
        Переслать
      </MenuItem>

      <Divider />

      <MenuItem
        onClick={() => {
          onCopy()
        }}
      >
        <ListItemIcon sx={{ minWidth: 34 }}>
          <Copy size={16} />
        </ListItemIcon>
        Скопировать
      </MenuItem>

      {canDelete ? (
        <MenuItem
          onClick={() => {
            onDelete()
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ minWidth: 34, color: 'error.main' }}>
            <Trash2 size={16} />
          </ListItemIcon>
          Удалить
        </MenuItem>
      ) : null}
    </Menu>
  )
}
