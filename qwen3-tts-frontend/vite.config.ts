import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['@arraypress/waveform-player']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'form-vendor';
            }
            if (id.includes('i18next')) {
              return 'i18n';
            }
            if (id.includes('@arraypress/waveform-player') || id.includes('sonner')) {
              return 'audio';
            }
            if (id.includes('axios') || id.includes('clsx') || id.includes('tailwind-merge') ||
                id.includes('class-variance-authority') || id.includes('next-themes')) {
              return 'utils';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
