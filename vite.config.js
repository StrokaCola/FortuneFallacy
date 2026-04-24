import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  base: '/FortuneFallacy/',
  publicDir: 'public',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          tone: ['tone'],
          howler: ['howler'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
