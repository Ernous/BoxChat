import { useContext, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Lock, Moon, Sun, User, UserRoundPlus } from 'lucide-react'
import { ThemeModeContext } from '../ui/theme-mode'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { mode, toggleMode } = useContext(ThemeModeContext)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          confirm_password: confirmPassword,
          remember_me: rememberMe,
        }),
        credentials: 'include',
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? 'Registration failed')
        return
      }

      const payload = await res.json().catch(() => null)
      window.location.href = payload?.redirect ?? '/'
    } catch {
      setError('Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background:
          'radial-gradient(1200px 520px at 10% 0%, rgba(45,212,191,.18), transparent 55%), radial-gradient(900px 400px at 90% 100%, rgba(245,158,11,.16), transparent 55%)',
      }}
    >
      <Container maxWidth="sm" sx={{ py: 5 }}>
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            p: { xs: 2.2, sm: 3.5 },
            boxShadow: '0 22px 60px rgba(0,0,0,.18)',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <UserRoundPlus size={20} />
              <Typography variant="h5">Create Account</Typography>
            </Stack>
            <IconButton onClick={toggleMode}>{mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
          </Stack>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>
            Strong password is required: uppercase, lowercase, number and special symbol.
          </Typography>

          {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

          <Stack spacing={1.4} component="form" onSubmit={onSubmit}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <User size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControlLabel
              control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
              label="Remember me on this device"
            />
            <Button type="submit" size="large" variant="contained" disabled={loading}>
              {loading ? 'Creating...' : 'Create account'}
            </Button>
            <Button href="/login" variant="text">
              Already have an account
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
