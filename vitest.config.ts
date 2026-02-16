import { defineConfig } from 'vitest/config';
import { compileModule } from 'svelte/compiler';

/** Minimal Vite plugin to compile .svelte.ts files (runes) for vitest */
function svelteModule() {
  return {
    name: 'svelte-module',
    transform(code: string, id: string) {
      if (!id.endsWith('.svelte.ts') && !id.endsWith('.svelte.js')) return;
      const result = compileModule(code, {
        filename: id,
        dev: true,
        generate: 'client',
      });
      return {
        code: result.js.code,
        map: result.js.map,
      };
    },
  };
}

export default defineConfig({
  plugins: [svelteModule()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
