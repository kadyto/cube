import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = new URL('../dist-wordpress/site/', import.meta.url);
const output = new URL('../dist-wordpress/media/', import.meta.url);
const workerEntry = fileURLToPath(
  new URL('../chunks/search-worker-entry.js', import.meta.resolve('cubing/scramble')),
);
const appEntry = resolve(root, 'src/wordpress-training/main.tsx');
const workerId = '\0cubing-training-media-worker';

async function bundle(entry, plugins = []) {
  const result = await build({
    root,
    configFile: false,
    publicDir: false,
    plugins,
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      target: 'es2022',
      write: false,
      lib: { entry, formats: ['es'], fileName: 'entrenamiento', cssFileName: 'entrenamiento' },
      rolldownOptions: { output: { codeSplitting: false, minify: true } },
    },
  });
  const [{ output: files }] = Array.isArray(result) ? result : [result];
  const chunks = files.filter((file) => file.type === 'chunk');
  if (
    chunks.length !== 1 ||
    chunks[0].imports.length ||
    chunks[0].dynamicImports.some((file) => file !== chunks[0].fileName)
  )
    throw new Error('La compilación para Medios debe poder ejecutarse con un solo archivo.');
  return {
    code: chunks[0].code,
    css: files.find((file) => file.fileName.endsWith('.css'))?.source,
  };
}

const worker = await bundle(workerEntry);
// The Media upload is one HTML document, so the app supplies cubing.js with its bundled worker.
const app = await bundle(appEntry, [
  react(),
  {
    name: 'cubing-training-media',
    enforce: 'pre',
    resolveId(id, importer) {
      if (
        id === './search-worker-entry.js' &&
        importer &&
        resolve(dirname(importer), id) === workerEntry
      )
        return workerId;
    },
    load(id) {
      if (id === workerId) {
        return `export const WORKER_ENTRY_FILE_URL = document.querySelector('[data-cubing-training]').dataset.cubingWorker;`;
      }
    },
    transform(code, id) {
      if (id === appEntry) {
        return `import { setSearchDebug } from 'cubing/search';
setSearchDebug({ allowNodeStyleWorkers: false, prioritizeEsbuildWorkaroundForWorkerInstantiation: true, logPerf: false });
${code}`;
      }
    },
  },
]);
if (typeof app.css !== 'string') throw new Error('Falta la hoja de estilos de Entrenamiento.');

const notices = await readFile(new URL('third-party-notices.txt', site), 'utf8');
const script = `export async function mountTraining() {
  const host = document.querySelector('[data-cubing-training]');
  if (!host) return;
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(app.css)};
  document.head.append(style);
  const moduleUrl = (source) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const workerUrl = moduleUrl(${JSON.stringify(worker.code)});
  const appUrl = moduleUrl(${JSON.stringify(app.code)});
  host.dataset.cubingWorker = workerUrl;
  try {
    await import(appUrl);
  } catch (error) {
    URL.revokeObjectURL(workerUrl);
    host.textContent = 'El cronómetro no se pudo cargar. Recarga la página para reintentarlo.';
    console.error(error);
  } finally {
    URL.revokeObjectURL(appUrl);
  }
}

void mountTraining();

${notices
  .split('\n')
  .map((line) => `// ${line}`)
  .join('\n')}
`;

const escapeScript = (code) => code.replace(/<\/script/gi, '<\\/script');
const themeDir = '/wp-content/themes/twentytwentyfive/assets/fonts';
const widget = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src blob:; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Cronómetro de entrenamiento</title>
<style>
@font-face{font-family:Manrope;src:url("${themeDir}/manrope/Manrope-VariableFont_wght.woff2") format("woff2");font-style:normal;font-weight:200 800;font-display:swap}
@font-face{font-family:"Fira Code";src:url("${themeDir}/fira-code/FiraCode-VariableFont_wght.woff2") format("woff2");font-style:normal;font-weight:300 700;font-display:swap}
:root{--wp--preset--font-family--fira-code:"Fira Code",monospace}
body{margin:0;font-family:Manrope,sans-serif}
</style>
</head>
<body>
<div class="cb-training" data-cubing-training>
<p>Cargando el cronómetro…</p>
<noscript><p>Habilita JavaScript para generar mezclas y usar el cronómetro.</p></noscript>
</div>
<script data-cfasync="false" type="module">
${escapeScript(script)}
</script>
<script data-cfasync="false">
const trainingHost = document.querySelector('[data-cubing-training]');
new ResizeObserver(() => {
  const height = Math.ceil(trainingHost.getBoundingClientRect().height) + 4;
  parent.postMessage({type:'cubing-entrenamiento-altura',height}, location.origin);
}).observe(trainingHost);
</script>
</body>
</html>`;

const version = createHash('sha256').update(widget).digest('hex').slice(0, 12);
const file = `cubing-entrenamiento-${version}.html`;
await mkdir(output, { recursive: true });
await writeFile(new URL(file, output), widget);
console.log(file);
