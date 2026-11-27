import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// cubing.js resolves its module worker next to the compiled scramble module.
const scrambleWorker = fileURLToPath(
  new URL('../chunks/search-worker-entry.js', import.meta.resolve('cubing/scramble')),
);

export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    target: 'es2022',
    outDir: 'dist-wordpress/site',
    manifest: true,
    minify: true,
    lib: {
      entry: {
        entrenamiento: 'src/wordpress-training/main.tsx',
        'search-worker-entry': scrambleWorker,
      },
      formats: ['es'],
      cssFileName: 'entrenamiento',
    },
    rollupOptions: {
      output: {
        minify: true,
        entryFileNames: ({ name }) =>
          name === 'search-worker-entry'
            ? 'assets/search-worker-entry.js'
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
