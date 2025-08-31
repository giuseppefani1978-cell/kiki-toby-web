import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // !!! IMPORTANT pour GitHub Pages
  base: '/kiki-toby-web/'
});
