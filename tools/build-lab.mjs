// Builds avatar-lab-standalone.html: the avatar test page as ONE file with everything inside, so it opens by
// double-clicking with no server. Run: node tools/build-lab.mjs
import { build } from 'esbuild';
import { writeFileSync, readFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['prototype3d/lab.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  loader: { '.json': 'json' },
});
const script = result.outputFiles[0].text.replace(/<\/script>/g, '<\/script>');
const html = readFileSync('avatar-lab.html', 'utf8').replace('<script type="module" src="/prototype3d/lab.js"></script>', `<script>${script}</script>`);
writeFileSync('avatar-lab-standalone.html', html);
console.log('Wrote avatar-lab-standalone.html');
