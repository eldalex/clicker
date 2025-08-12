import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build directly into backend/build so both Nginx and Express can serve the same files
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/build',
    emptyOutDir: true,
    assetsDir: 'assets'
  }
});
