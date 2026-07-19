import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('lightweight-charts')) return 'market-chart';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'report-chart';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        }
      }
    }
  }
})
