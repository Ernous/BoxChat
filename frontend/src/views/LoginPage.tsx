import { useContext, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Lock, Moon, Shield, Sun } from 'lucide-react'
import { ThemeModeContext } from '../ui/theme-mode'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { mode, toggleMode } = useContext(ThemeModeContext)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          remember_me: true,
        }),
        credentials: 'include',
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? 'Login failed')
        return
      }

      const payload = await res.json().catch(() => null)
      window.location.href = payload?.redirect ?? '/'
    } catch {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 430px' },
        backgroundColor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'flex-end',
          p: { md: 6, lg: 8 },
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #3a304a 0%, #4e4463 100%)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-10%',
            left: '-10%',
            width: '50%',
            height: '50%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,.35) 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <Typography
          sx={{
            position: 'relative',
            fontSize: { md: '3.2rem', lg: '4.2rem' },
            fontWeight: 800,
            lineHeight: 1.08,
            maxWidth: 540,
            background: 'linear-gradient(90deg, #f3e8ff 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Welcome to BoxChat
        </Typography>
      </Box>

      <Box
        sx={{
          px: { xs: 2, sm: 4 },
          py: { xs: 3, sm: 4 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: 'background.paper',
          boxShadow: { md: '-12px 0 30px rgba(0,0,0,.18)' },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Shield size={20} />
            <Typography variant="h5" fontWeight={800}>Login</Typography>
          </Stack>
          <IconButton onClick={toggleMode}>{mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
        </Stack>

        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              fullWidth
              InputProps={{ startAdornment: <Lock size={16} style={{ marginRight: 8 }} /> }}
            />
            <Button type="submit" size="large" variant="contained" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
            <Typography textAlign="center" variant="body2" color="text.secondary">
              Don&apos;t have an account?{' '}
              <Box component="a" href="/register" sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 700 }}>
                Sign up
              </Box>
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
