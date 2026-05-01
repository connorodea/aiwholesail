import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable CSS code splitting so each route only loads its own CSS
    cssCodeSplit: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached long-term
          'vendor-react': ['react', 'react-dom'],
          // Router separate so it can be cached independently
          'vendor-router': ['react-router-dom'],
          // Animation library — only loaded when needed
          'vendor-motion': ['framer-motion'],
          // Icons — large library, separate chunk
          'vendor-icons': ['lucide-react'],
          // Radix UI primitives
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-accordion',
            '@radix-ui/react-select',
          ],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
}));
