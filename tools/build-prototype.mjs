// Bundles the 3D caller prototype (prototype3d/) into caller-3d-prototype.js, which caller-3d-prototype.html loads.
// It is a plain script, so the page opens by double-clicking with no server.
import { build } from 'esbuild';

await build({
  entryPoints: ['prototype3d/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: 'caller-3d-prototype.js',
  logLevel: 'info',
});
