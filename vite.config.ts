import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Phaser is intentionally cached as a separate vendor bundle.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
