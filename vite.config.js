import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [wasm(), topLevelAwait(), react()],
  base: '/FortuneFallacy/',
  publicDir: 'public',
  resolve: {
    alias: {
      '@next': path.resolve(process.cwd(), 'src-next'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), 'index.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          tone: ['tone'],
          howler: ['howler'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
