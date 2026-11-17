import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const base =
    process.env.VITE_BASE ?? (mode === 'gh-pages' && repo ? `/${repo}/` : '/');

  return {
    base,
    root: 'client',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: '../dist/client',
      emptyOutDir: true
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:3000'
      }
    }
  };
});
