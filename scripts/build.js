import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { gzipSync } from 'zlib';

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

// Build all source files
const entryPoints = [
  'src/index.ts',
  'src/observe/index.ts',
  'src/observe/observe.svelte.ts',
  'src/observe/vitals.ts',
  'src/observe/errors.ts',
  'src/observe/sampling.ts',
  'src/observe/session.ts',
  'src/machine/index.ts',
  'src/machine/machine.svelte.ts',
  'src/machine/types.ts',
  'src/transport/index.ts',
  'src/transport/transport.ts',
  'src/transport/fetch.ts',
  'src/types/index.ts',
];

await esbuild.build({
  ...shared,
  entryPoints,
  outdir: 'dist',
  outExtension: { '.js': '.js' },
});

// Step 3: Report sizes
console.log('\n📊 Bundle sizes:');

const files = [
  { name: 'Full bundle', paths: ['dist/index.js', 'dist/observe/index.js', 'dist/observe/observe.svelte.js', 'dist/observe/vitals.js', 'dist/observe/errors.js', 'dist/observe/sampling.js', 'dist/observe/session.js', 'dist/machine/index.js', 'dist/machine/machine.svelte.js', 'dist/machine/types.js', 'dist/transport/index.js', 'dist/transport/fetch.js', 'dist/transport/transport.js', 'dist/types/index.js'] },
  { name: 'observe() only', paths: ['dist/observe/observe.svelte.js', 'dist/observe/vitals.js', 'dist/observe/errors.js', 'dist/observe/sampling.js', 'dist/observe/session.js', 'dist/transport/fetch.js'] },
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
