import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  base: process.env.BASE || '/',
  outDir: '../frontend-astro/dist',
  vite: {
    server: {
      proxy: {
        '/api': 'http://localhost:3000'
      }
    }
  }
});
