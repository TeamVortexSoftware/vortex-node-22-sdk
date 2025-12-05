import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    tsconfig: './tsconfig.dts.json'
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
