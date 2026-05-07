import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // Keep legacy global handlers stable while the app is being modularized.
    minify: false
  }
});
