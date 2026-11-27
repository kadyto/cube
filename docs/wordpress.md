# Entrenamiento en Cubing.es

## Actualizar desde wp-admin

Cubing.es sirve el entrenamiento en un único HTML de Medios. Compila con Node 24 desde la revisión que quieras desplegar:

```bash
npm ci
npm run build:wordpress
node wordpress/package-media.mjs
```

Sube el archivo `dist-wordpress/media/cubing-entrenamiento-<version>.html` desde **Medios → Añadir medios** con el perfil autorizado. Copia su URL. En la página **Entrenamiento**, cambia el atributo `src` del marco `cubing-entrenamiento-marco` por la ruta relativa del nuevo adjunto. El bloque ajusta la altura con los mensajes del documento del cronómetro, verificando su origen y ventana. La versión anterior sigue sirviendo para revertir con una revisión de la página.

Prueba la vista previa y luego la página publicada. Comprueba las tres modalidades, el dibujo, la inspección y el cronómetro. El HTML incluye JavaScript, estilos y licencias. El worker y el módulo se ejecutan en el navegador y el cronómetro usa las fuentes del sitio. La política de seguridad del HTML permite esos recursos e impide que se ejecute otro contador de Cloudflare dentro del marco. Deja activados los filtros de tipos de archivo de WordPress.

## Variante de archivos estáticos

La página **Entrenamiento** se crea como hija de **Herramientas**, con la plantilla de página habitual de Cubing.es. El bloque HTML monta una aplicación del mismo dominio. El resto de la página lo renderiza WordPress con Twenty Twenty-Five, incluidos el título, el menú y el pie.

La demo usa el cronómetro, la inspección, la notación y el dibujo de Cube. `cubing.js` genera las mezclas de 3×3, 2×2 y Pyraminx mediante un worker local al navegador. El intento actual vive en memoria. Cambiar de mezcla o recargar lo descarta. La compilación web incluye solo la interfaz de entrenamiento y sus dependencias. Los cambios de estilo quedan bajo `.cb-training` y el atajo de espacio responde cuando el foco está dentro de la herramienta.

## Compilar

Desde la raíz del repositorio, con Node 24 y la rama o revisión aprobada:

```bash
npm ci
npm run build:wordpress
```

| Resultado | Uso |
| --- | --- |
| `dist-wordpress/deploy.json` | Ruta pública de la versión y nombres de archivos de entrada. |
| `dist-wordpress/site/assets/` | Archivos JS, CSS y dependencias del worker. Sube la carpeta completa. |
| `dist-wordpress/site/third-party-notices.txt` | Créditos, licencias y enlace al código fuente de las dependencias. |
| `dist-wordpress/page.blocks.html` | Contenido Gutenberg de la nueva página. El título «Entrenamiento» se introduce en el campo de título. |
| `dist-wordpress/tools-link.blocks.html` | Botón para añadir bajo «Practicar y medir tus tiempos» en Herramientas. |

## Publicar en WordPress

1. Verifica la plantilla y que `/herramientas/entrenamiento/` siga disponible. Si ya es la página de la herramienta, conserva su ID y revisa su contenido antes de reemplazarlo. Si pertenece a otro contenido, escoge con Javier una ruta distinta y actualiza el enlace correspondiente.
2. Comprueba el volumen persistente de uploads en el Docker de WordPress. `wp_upload_dir()` da su directorio y URL si tienes WP-CLI. Sube `site/assets/` y `site/third-party-notices.txt` a la subcarpeta `cubing-entrenamiento/<version>/` de uploads, con el nombre indicado en `deploy.json`. Conserva permisos y propietario coherentes con los demás archivos estáticos. Comprueba que el módulo `.js`, CSS y los chunks del worker responden por HTTPS y con el tipo MIME correcto. [Referencia de wp_upload_dir()](https://developer.wordpress.org/reference/functions/wp_upload_dir/).
3. En **Páginas → Añadir nueva**, escribe **Entrenamiento**, asigna **Herramientas** como padre y `entrenamiento` como slug. Carga `page.blocks.html` desde el editor de código y guarda un borrador con un usuario que pueda guardar el bloque HTML y el `<script type="module">`. Si usas WP-CLI, confirma el usuario, la página padre y la plantilla antes de crear o actualizar el borrador. [Bloque HTML personalizado](https://developer.wordpress.org/block-editor/reference-guides/core-blocks/core-blocks-widgets/core-block-html/).
4. Abre la vista previa real y verifica que el bloque carga y encaja con el tema a 320, 390 y 1280 px. Genera una mezcla en cada modalidad, abre y cierra el dibujo, prueba espacio con el cronómetro enfocado y utiliza la pulsación larga en móvil. Comprueba la inspección y que un tiempo se descarta con «Siguiente mezcla». Comprueba también el menú, el aviso de cookies y que el JS/CSS de la herramienta solo se pide en esa página.
5. Publica la página y añade `tools-link.blocks.html` dentro del apartado «Practicar y medir tus tiempos» de Herramientas. Comprueba ambas URLs sin sesión y confirma que se puede iniciar desde el enlace. Refresca solo las rutas afectadas si una capa de caché sigue sirviendo una edición anterior.

Los archivos estáticos se despliegan primero. Conserva la versión anterior de assets mientras las páginas anteriores puedan seguir en caché. Para actualizar, publica la versión nueva de los archivos y después el contenido de la página con sus referencias. Para revertir una actualización, restaura la revisión de WordPress anterior y verifica la ruta pública. Para retirar la primera instalación, devuelve la página a borrador y retira el botón de Herramientas.

Si estás realizando el despliegue para Javier, registra al terminar en el mismo cuaderno de Cubing.es la revisión de Git, el ID de la página, las rutas verificadas y lo que quede pendiente. El token de Cloudflare de la auditoría anterior es de lectura y no interviene en este despliegue.
