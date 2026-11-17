import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function repoNameFromRemote(): string | undefined {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8'
    }).trim();
    const match = url.match(/(?:github\.com[:/])([^/]+)\/([^/.]+?)(?:\.git)?$/i);
    return match?.[2];
  } catch {
    return undefined;
  }
}

export default defineConfig(({ mode }) => {
  const repo =
    process.env.GITHUB_REPOSITORY?.split('/')[1] ??
    repoNameFromRemote() ??
    path.basename(process.cwd());
  const base =
    process.env.VITE_BASE ?? (mode === 'gh-pages' && repo ? `/${repo}/` : '/');

  return {
    base,
    root: 'client',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'nojekyll',
        apply: 'build',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
        }
      }
    ],
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
