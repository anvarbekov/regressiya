import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
          reveal: ['reveal.js'],
          katex: ['katex'],
        },
      },
    },
  },
  test: { environment: 'node' },
});
