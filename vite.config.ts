import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          
          if (id.includes('monaco-editor')) return 'vendor-monaco';
          if (id.includes('lightweight-charts')) return 'vendor-charts';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-recharts';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
          if (id.includes('@tauri-apps')) return 'vendor-tauri';
          if (id.includes('pixi.js')) return 'vendor-pixi';
          return 'vendor-core';
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lucide-react',
      'lightweight-charts',
      'recharts',
      'zustand',
      'framer-motion',
    ],
  },
})

