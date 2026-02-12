import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/upload_file': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/stickerpacks': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/stickerpack': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/message': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/start_dm': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/create_room': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/profile': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/logout': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
