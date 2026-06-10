import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['iwaa.png'],
      manifest: {
        name: 'IWA',
        short_name: 'IWA',
        description: 'IWA - Sistem Absensi Digital Internal',
        theme_color: '#1e293b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'iwaa.png', sizes: '192x192', type: 'image/png' },
          { src: 'iwaa.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5005', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5005', changeOrigin: true }
    }
  }
})
