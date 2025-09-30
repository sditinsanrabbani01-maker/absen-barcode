import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // HTTPS disabled for Windows compatibility
    // Use HTTP for development, HTTPS in production
    proxy: {
      '/api/whatsapp': {
        target: 'https://api.whacenter.com',
        changeOrigin: true,
        rewrite: (path) => {
          if (path.includes('/sendgroup')) {
            return '/api/sendGroup';
          } else if (path.includes('/send')) {
            return '/api/send';
          }
          return '/api';
        }
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      '@supabase/supabase-js',
      'xlsx',
      'jspdf'
    ]
  },
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          utils: ['xlsx', 'jspdf', 'html5-qrcode', 'qrcode']
        }
      }
    }
  },
  // Define environment variables for build
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL || 'https://localhost:3000'),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || 'dummy-key')
  }
})
