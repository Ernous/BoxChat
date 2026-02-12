export type AppNotification = {
  id: string
  createdAt: number
  title: string
  body: string
  href?: string
  read: boolean
}

export type NotificationPermissionState = 'unsupported' | 'default' | 'denied' | 'granted'

const KEY = 'bc_notifications_v1'
const EVT = 'bc_notifications_changed'

function safeParse(raw: string | null): AppNotification[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as AppNotification[]
  } catch {
    return []
  }
}

export function getNotifications(): AppNotification[] {
  return safeParse(localStorage.getItem(KEY))
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length
}

export function addNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
  const full: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    read: false,
    ...n,
  }

  const list = getNotifications()
  list.unshift(full)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)))
  window.dispatchEvent(new CustomEvent(EVT))
  return full
}

export function markAllRead(): void {
  const list = getNotifications().map((n) => ({ ...n, read: true }))
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent(EVT))
}

export function markRead(id: string): void {
  const list = getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n))
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent(EVT))
}

export function subscribeNotifications(cb: () => void): () => void {
  const handler = () => cb()
  window.addEventListener(EVT, handler as EventListener)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVT, handler as EventListener)
    window.removeEventListener('storage', handler)
  }
}

export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermissionState> {
  const state = getBrowserNotificationPermission()
  if (state === 'unsupported') return state
  if (state !== 'default') return state
  try {
    const res = await Notification.requestPermission()
    return res
  } catch {
    return getBrowserNotificationPermission()
  }
}

export function showBrowserNotification(title: string, body: string, href?: string): void {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    const n = new Notification(title, { body })
    n.onclick = () => {
      try {
        window.focus()
        if (href) window.location.href = href
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
