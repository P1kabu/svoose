import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { gzipSync } from 'zlib';

// Step 0: Clean dist
if (existsSync('dist')) {
  rmSync('dist', { recursive: true });
}

// Step 1: Generate TypeScript declarations
console.log('📝 Generating TypeScript declarations...');
execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit' });

// Step 2: Build with esbuild
console.log('📦 Building with esbuild...');

const shared = {
  bundle: false,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  minify: true,
  sourcemap: true,
  treeShaking: true,
};

// Split entry points: .svelte.ts files need special minification
const svelteEntryPoints = [
  'src/observe/observe.svelte.ts',
  'src/machine/machine.svelte.ts',
  'src/svelte/index.svelte.ts',
];

const regularEntryPoints = [
  'src/index.ts',
  'src/observe/index.ts',
  'src/observe/vitals.ts',
  'src/observe/errors.ts',
  'src/observe/sampling.ts',
  'src/observe/session.ts',
  'src/observe/presets.ts',
  'src/metrics/index.ts',
  'src/metrics/metric.ts',
  'src/metrics/typed.ts',
  'src/machine/index.ts',
  'src/machine/types.ts',
  'src/transport/index.ts',
  'src/transport/transport.ts',
  'src/transport/fetch.ts',
  'src/transport/beacon.ts',
  'src/transport/hybrid.ts',
  'src/transport/retry.ts',
  'src/types/index.ts',
];

// Regular files: full minification
await esbuild.build({
  ...shared,
  entryPoints: regularEntryPoints,
  outdir: 'dist',
  outExtension: { '.js': '.js' },
});

// Svelte files: no identifier minification (Svelte 5 reserves $ prefix)
await esbuild.build({
  ...shared,
  minify: false,
  minifySyntax: true,
  minifyWhitespace: true,
  minifyIdentifiers: false,
  entryPoints: svelteEntryPoints,
  outdir: 'dist',
  outExtension: { '.js': '.js' },
});

// Step 3: Report sizes
console.log('\n📊 Bundle sizes:');

const files = [
  { name: 'Full bundle', paths: ['dist/index.js', 'dist/observe/index.js', 'dist/observe/observe.svelte.js', 'dist/observe/vitals.js', 'dist/observe/errors.js', 'dist/observe/sampling.js', 'dist/observe/session.js', 'dist/observe/presets.js', 'dist/metrics/index.js', 'dist/metrics/metric.js', 'dist/metrics/typed.js', 'dist/machine/index.js', 'dist/machine/machine.svelte.js', 'dist/machine/types.js', 'dist/svelte/index.svelte.js', 'dist/transport/index.js', 'dist/transport/fetch.js', 'dist/transport/beacon.js', 'dist/transport/hybrid.js', 'dist/transport/retry.js', 'dist/transport/transport.js', 'dist/types/index.js'] },
  { name: 'observe() only', paths: ['dist/observe/observe.svelte.js', 'dist/observe/vitals.js', 'dist/observe/errors.js', 'dist/observe/sampling.js', 'dist/observe/session.js', 'dist/metrics/metric.js', 'dist/transport/fetch.js', 'dist/transport/beacon.js', 'dist/transport/hybrid.js', 'dist/transport/retry.js'] },
  { name: 'createMachine() only', paths: ['dist/machine/machine.svelte.js', 'dist/machine/types.js'] },
];

for (const { name, paths } of files) {
  let content = '';
  for (const p of paths) {
    if (existsSync(p)) {
      content += readFileSync(p, 'utf-8');
    }
  }
  const raw = Buffer.byteLength(content, 'utf-8');
  const gzip = gzipSync(content).length;
  console.log(`  ${name}: ${raw} bytes (${gzip} bytes gzip)`);
}

console.log('\n✅ Build complete!');
