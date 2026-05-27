/**
 * Build content-script.js as a standalone IIFE bundle.
 * Runs before the main Vite build.
 */
import { build } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function buildContentScript() {
  console.log('[build-content] Building content-script.js as IIFE...');
  await build({
    configFile: false,
    root: resolve(__dirname, '..'),
    plugins: [],
    resolve: {
      alias: {
        '@': resolve(__dirname, '../src'),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, '../src/content/content-script.ts'),
        output: {
          format: 'iife',
          entryFileNames: 'content-script.js',
        },
      },
      outDir: resolve(__dirname, '../dist'),
      emptyOutDir: false,
      sourcemap: false,
      minify: false,
      target: 'esnext',
      modulePreload: false,
      cssCodeSplit: false,
    },
  });
  console.log('[build-content] Done');
}

buildContentScript().catch((err) => {
  console.error('[build-content] Failed:', err);
  process.exit(1);
});
