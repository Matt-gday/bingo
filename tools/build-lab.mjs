// Builds avatar-lab-standalone.html: the avatar test page as ONE file with everything inside, so it opens by
// double-clicking with no server. Run: node tools/build-lab.mjs
import { build } from 'esbuild';
import { writeFileSync, readFileSync } from 'node:fs';

async function page(entry, htmlFile, outFile, scriptTag) {
  const result = await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  loader: { '.json': 'json' },
});
  const script = result.outputFiles[0].text.replaceAll('</script>', '<\\/script>');
  const html = readFileSync(htmlFile, 'utf8').replace(scriptTag, `<script>${script}</script>`);
  writeFileSync(outFile, html);
  console.log('Wrote', outFile);
}

await page('prototype3d/lab.js', 'avatar-lab.html', 'avatar-lab-standalone.html', '<script type="module" src="/prototype3d/lab.js"></script>');
await page('prototype3d/wearables.js', 'wearables-sheet.html', 'wearables-sheet-standalone.html', '<script type="module" src="/prototype3d/wearables.js"></script>');
