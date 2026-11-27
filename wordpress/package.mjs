import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../dist-wordpress/', import.meta.url);
const site = new URL('site/', output);
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', site), 'utf8'));
const entry = manifest['src/wordpress-training/main.tsx'];
const files = [...new Set(Object.values(manifest).map(({ file }) => file))].sort();
const fingerprint = createHash('sha256');
for (const file of files) fingerprint.update(file).update(await readFile(new URL(file, site)));
const version = fingerprint.digest('hex').slice(0, 12);
const assetPath = `/wp-content/uploads/cubing-entrenamiento/${version}`;
const pagePath = '/herramientas/entrenamiento/';
const styles = files.filter((file) => file.endsWith('.css'));
const styleLinks = styles.map((file) => `<link rel="stylesheet" href="${assetPath}/${file}">`);

const page = `<!-- wp:paragraph -->
<p>Practica con mezclas para 3×3, 2×2 y Pyraminx. El tiempo se muestra solo durante el intento.</p>
<!-- /wp:paragraph -->

<!-- wp:group {"align":"wide","layout":{"type":"default"}} -->
<div class="wp-block-group alignwide"><!-- wp:html -->
${styleLinks.join('\n')}
<div class="cb-training" data-cubing-training>
  <p>Cargando el cronómetro…</p>
  <noscript><p>Habilita JavaScript para generar mezclas y usar el cronómetro.</p></noscript>
</div>
<script data-cfasync="false" type="module" src="${assetPath}/${entry.file}"></script>
<!-- /wp:html --></div>
<!-- /wp:group -->
`;

const link = `<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${pagePath}">Abrir el cronómetro</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
`;

const noticeFiles = [
  ['cubing.js', new URL('licenses/cubing-mpl-2.0.md', import.meta.url)],
  ['React', new URL('../node_modules/react/LICENSE', import.meta.url)],
  ['React DOM', new URL('../node_modules/react-dom/LICENSE', import.meta.url)],
  ['Scheduler', new URL('../node_modules/scheduler/LICENSE', import.meta.url)],
  ['Lucide', new URL('../node_modules/lucide-react/LICENSE', import.meta.url)],
  ['three.js', new URL('../node_modules/three/LICENSE', import.meta.url)],
  ['random-uint-below', new URL('../node_modules/random-uint-below/LICENSE.md', import.meta.url)],
];
const cubingPackage = JSON.parse(
  await readFile(new URL('../node_modules/cubing/package.json', import.meta.url), 'utf8'),
);
const cubingSource = `https://github.com/cubing/cubing.js/tree/v${cubingPackage.version}`;
const notices = await Promise.all(
  noticeFiles.map(async ([name, file]) => `## ${name}\n\n${await readFile(file, 'utf8')}`),
);
const credits =
  `Entrenamiento de Cubing.es\n\nCódigo de la integración: https://github.com/kadyto/cube\n` +
  `Código fuente de cubing.js ${cubingPackage.version}, incluidas las licencias del código incorporado: ${cubingSource}\n` +
  `Licencia de @cubing/lazy-promise: MIT, https://codeberg.org/cubing/lazy-promise\n\n` +
  notices.join('\n\n');

await Promise.all([
  writeFile(new URL('page.blocks.html', output), page),
  writeFile(new URL('tools-link.blocks.html', output), link),
  writeFile(
    new URL('deploy.json', output),
    JSON.stringify({ version, assetPath, pagePath, entry: entry.file, styles }, null, 2) + '\n',
  ),
  writeFile(new URL('third-party-notices.txt', site), credits),
]);
console.log(`WordPress: ${pagePath} · archivos estáticos en ${assetPath}/`);
