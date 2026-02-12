import { createBrowserRouter, redirect } from 'react-router-dom'
import AppLayout from './ui/AppLayout'
import DashboardPage from './views/DashboardPage'
import ExplorePage from './views/ExplorePage'
import LoginPage from './views/LoginPage'
import NotificationsPage from './views/NotificationsPage'
import RegisterPage from './views/RegisterPage'
import RoomPage from './views/RoomPage'
import SettingsPage from './views/SettingsPage'

async function getSession() {
  const response = await fetch('/api/v1/auth/session', {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!response.ok) {
    return null
  }

  return response.json()
}

async function requireAuthLoader() {
  const session = await getSession()
  if (!session?.authenticated) {
    throw redirect('/login')
  }
  return session
}

async function guestOnlyLoader() {
  const session = await getSession()
  if (session?.authenticated) {
    throw redirect('/')
  }
  return null
}

export const router = createBrowserRouter([
  {
    id: 'root',
    path: '/',
    element: <AppLayout />,
    loader: requireAuthLoader,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'create_room', element: <ExplorePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'room/:roomId', element: <RoomPage /> },
      { path: '*', loader: async () => redirect('/') },
    ],
  },
  { path: '/login', element: <LoginPage />, loader: guestOnlyLoader },
  { path: '/register', element: <RegisterPage />, loader: guestOnlyLoader },
])
