import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative base path for Databricks deployment
  // This ensures assets load correctly under any route prefix
  base: './',
  
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  },
  
  build: {
    // Build to backend/static for integrated deployment
    outDir: path.resolve(__dirname, '../backend/static'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    
    // Reduce bundle size warning by splitting vendor chunks
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split React libs
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          
          // Split router
          if (id.includes('node_modules/react-router-dom')) {
            return 'router-vendor'
          }
          
          // Split charts
          if (id.includes('node_modules/recharts')) {
            return 'charts-vendor'
          }
          
          // Split other large node_modules automatically
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    },
    
    // Increase warning limit to avoid noise
    chunkSizeWarningLimit: 1000
  }
})
