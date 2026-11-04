# Cube

Un rincón de speedcubing para entrenar, ver el progreso y compartir los logros que tú elijas. Interfaz en español, pensada para móvil y ordenador. Una instalación corresponde a una persona, con una contraseña para su zona privada y una página pública sin registro.

## Qué incluye

- **3×3×3, 2×2×2 y Pyraminx.** Mezclas de estado aleatorio generadas por [cubing.js](https://js.cubing.net/cubing/scramble/), con una leyenda junto a la mezcla para aprender la notación. Son mezclas para entrenamiento con criterios de los eventos WCA; esta aplicación no es un programa oficial homologado para organizar competiciones WCA.
- **Cronómetro táctil y con barra espaciadora.** Mantén 350 ms y suelta para arrancar; pulsa para detener. Escape cancela el intento. Inspección opcional: a partir de 15 s aplica +2; a partir de 17 s, DNF. La inspección termina al soltar para iniciar la resolución.
- **Entrada manual.** Acepta `12.34`, `12,34` y `1:02.45`. Cada intento conserva su mezcla, fecha y forma de registro.
- **ao5 automático**, mejores singles, mejor ao5, gráfico de las últimas 30 resoluciones e historial por puzzle. Las medias se calculan dentro de cada puzzle; los cinco últimos intentos del historial de ese puzzle forman el ao5 actual.
- **Edición y borrado individual.** Botones visibles en cada tiempo del historial y acceso directo junto al último tiempo guardado. Puedes corregir el tiempo, marcar +2 o DNF, añadir una nota privada o borrar el intento con confirmación.
- **Publicación expresamente elegida.** Elige un single o los cinco intentos consecutivos que terminan en el seleccionado. La confirmación muestra el resultado antes de publicar. Puedes retirar la publicación cuando quieras.
- **Perfil público personalizable y WCA opcional.** Un apodo, una presentación, el enlace WCA y, si lo autorizas, el nombre, las mejores marcas oficiales (single y media) y las competiciones importadas. Las marcas WCA incluyen también las pruebas que no tienen cronómetro de entrenamiento en Cube. Al guardar un ID WCA, sus datos se actualizan automáticamente cada hora; «Consultar WCA» permite adelantar la actualización.
- **Timeline de competiciones WCA.** Fecha, competición y puesto en la última ronda disputada de cada prueba, con filtro por puzzle, tiempos y rondas anteriores desplegables. Muestra tres competiciones recientes y permite cargar las anteriores. Solo es pública al habilitar las competiciones en Ajustes.
- **Contraseña sencilla y modificable**, exportación JSON y copias completas de SQLite.

### Cómo se calcula el ao5

Se añaden las penalizaciones +2, se ordenan los cinco tiempos y se eliminan uno mejor y uno peor. Se hace la media de los tres restantes, redondeada a centésimas. Con un DNF se descarta ese intento; con dos o más DNF, la media es DNF. Con menos de cinco intentos se muestra `—`.

### Editar, borrar y reponer intentos

Los intentos tienen un número estable dentro de cada puzzle. Si borras el #3, los otros conservan sus números y el siguiente tiempo que guardes en ese puzzle ocupará el #3. Si borras varios, se rellena primero el hueco de menor número. El próximo número aparece junto a la mezcla y en el historial.

Los ao5 siguen el orden de los números de intento y necesitan cinco números consecutivos. Si se borra un intento de ese bloque, su ao5 queda pendiente (`—`) hasta reponerlo. Al corregir o reponer un tiempo se recalculan los ao5 y las estadísticas privadas. Los ao5 de bloques completos que no contienen ese hueco siguen disponibles.

Si arrancas y paras el cronómetro por error, pulsa «Borrar último tiempo» y confirma. Se recuperan el número disponible y la mezcla del intento accidental para repetirlo. También puedes pulsar «Editar último tiempo» o abrir cualquier tiempo del historial.

Las publicaciones son copias de los resultados que elegiste compartir: editar, borrar o reponer un intento privado no las cambia automáticamente. Para cambiar una publicación, retírala y publica el resultado corregido. Las bases de datos anteriores se actualizan al arrancar, conservando los tiempos, sus identificadores, mezclas y notas.

## Desplegar en Dockhand

Después de incorporar estos archivos en la rama `main` de `kadyto/cube`:

1. Crea un stack y pega [compose.dockhand.yaml](compose.dockhand.yaml).
2. Define la variable `INITIAL_PASSWORD` con la contraseña que elijas. No hay requisitos de longitud ni complejidad; solo debe ser no vacía.
3. Despliega con la construcción de la imagen habilitada. El código se descarga de GitHub y se construye en tu servidor; no depende de una imagen prepublicada.
4. Abre el puerto **8093** de tu servidor. La portada es pública; «Entrar a mi espacio» abre el entrenamiento privado.

El volumen `cube_data` guarda todos los datos. Docker lo crea con los permisos adecuados: no hace falta preparar una carpeta del NAS. Conserva el nombre del stack y el volumen al actualizar. No uses `down -v` si quieres conservar tus tiempos.

Consulta [la guía de despliegue, proxy y copias](docs/despliegue.md).

## Docker Compose con el código local

```sh
git clone https://github.com/kadyto/cube.git
cd cube
cp .env.example .env
# Edita .env y elige INITIAL_PASSWORD antes de continuar.
docker compose up --build -d
```

La contraseña inicial solo se utiliza con una base de datos nueva. Cambiar esa variable no sustituye una contraseña ya guardada: cámbiala desde Ajustes o usa la herramienta de recuperación de la guía.

## Desarrollo

Requiere **Node.js 24**. No necesita una base de datos externa.

```sh
npm ci
cp .env.example .env
# Edita INITIAL_PASSWORD en .env.
npm run dev
```

Vite sirve la interfaz en el puerto 5173 y reenvía `/api` al backend del puerto 3000. En producción, el propio backend sirve la interfaz compilada:

```sh
npm run build
npm start
```

Se guarda SQLite en `data/cube.sqlite`, salvo que configures `DATABASE_PATH`. No incluyas `.env` ni datos reales en Git.

### Validación

```sh
npm test
npm run build
npx playwright install chromium  # si no hay Chromium disponible
npm run test:e2e
```

Las pruebas unitarias y de API cubren ao5, DNF/+2, mezclas reales legales e invertibles, privacidad, publicación, retirada, sesiones, contraseñas simples, exportación y persistencia. Las pruebas de navegador utilizan una base temporal y recorren entrada manual, cronómetro, publicación y ajustes. Se utiliza `/usr/bin/chromium` si existe; puede indicarse otro navegador con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

La integración WCA se contrasta con el contrato de los endpoints públicos `GET /api/v0/persons/:id`, `GET /api/v0/persons/:id/competitions` y `GET /api/v0/persons/:id/results`, y se prueba con respuestas simuladas. Su disponibilidad real depende de la conexión del servidor a `www.worldcubeassociation.org`.

### Cómo leer la timeline de competiciones

La timeline agrupa los resultados por competición y prueba, ordenados desde la competición más reciente. La tarjeta resume la última ronda alcanzada: por ejemplo, «8.º · Final» o «15.º · Primera ronda». Al desplegarla se ven los puestos y resultados de las rondas anteriores. El filtro permite seguir una misma prueba entre competiciones.

Cada puesto procede del campo oficial `pos` de su ronda. No es una clasificación global de todos los participantes de la competición; no se inventan denominadores de participantes ni variaciones de ranking. Un puesto entre los tres primeros de una primera ronda o una final B no se presenta como podio. Los trofeos se reservan para resultados válidos entre los tres primeros de una final. DNF y DNS se conservan como tales.

Las competiciones ya importadas que carecen de rondas y puestos se completan automáticamente al revisar el perfil. Si no hay información de una ronda, se indica que falta en lugar de mostrar una posición inventada. Estas actualizaciones no alteran las publicaciones de entrenamiento.

### Actualizaciones automáticas de WCA

Con un ID WCA guardado, el servidor revisa el perfil, las marcas y los resultados cada hora, aunque el navegador esté cerrado. Al arrancar comprueba si faltan datos o si los anteriores han caducado. No necesita un cron externo ni nuevas variables del Compose. Sin un ID vinculado no consulta WCA.

Si WCA no responde o devuelve un error, conserva la última información válida y reintenta tras 15 minutos. La fecha de la última consulta y los reintentos se guardan en SQLite y se conservan al reiniciar. Las actualizaciones respetan el apodo, la presentación y las opciones de visibilidad elegidas, y nunca publican tiempos privados automáticamente. Quitar el ID WCA detiene las consultas de ese perfil.

La portada comprueba los datos del servidor cada minuto mientras está visible y al recuperar el foco, por lo que incorpora los cambios sin recargarla a mano. En Ajustes se muestran la última actualización, la próxima comprobación y los posibles errores; «Consultar WCA» permite actualizar en ese momento.

Las nuevas competiciones aparecen cuando WCA publica sus resultados oficiales. La sincronización no incluye inscripciones futuras ni puede anticipar los resultados que WCA todavía no ha publicado.

El logo está incorporado en `public/logo.png`, como PNG transparente preparado a partir de la imagen proporcionada por el propietario. Se utiliza en la cabecera y los iconos del navegador y del móvil. El cubo del banner muestra siempre un PLL Jb con amarillo arriba, verde delante y naranja a la derecha; sus pegatinas se verifican con cubing.js.

## Privacidad y alcance

Los tiempos y notas permanecen privados. Una publicación contiene una copia del resultado, sus mezclas y fechas; **nunca incluye notas privadas**. Editar o borrar un tiempo del historial no cambia una publicación existente: retírala y vuelve a publicarla si quieres actualizarla. El apartado «Marcas compartidas» se calcula exclusivamente a partir de los singles que has publicado. «Marcas oficiales WCA» muestra los mejores resultados importados de competiciones oficiales.

WCA es opcional y no requiere OAuth ni credenciales WCA. Vincular un ID **no acredita la titularidad** del perfil. La sincronización recoge participaciones con resultados, no inscripciones futuras. El nombre WCA, sus marcas oficiales y las competiciones se muestran únicamente al habilitar las opciones correspondientes y guardar; el nombre del rincón puede seguir siendo un apodo. Los perfiles de versiones anteriores también se actualizan automáticamente al arrancar el servidor si les faltan datos.

Cube no carga fuentes, analítica ni recursos de terceros en el navegador. No hay registro abierto, cuentas múltiples, sincronización con csTimer ni funcionamiento sin conexión. Si falla el guardado de un tiempo, conserva un intento pendiente en ese navegador para reintentarlo; no cierres sesión en un dispositivo compartido con un intento pendiente sin haberlo guardado. La exportación JSON permite consultar y conservar datos; la restauración completa se hace con la copia SQLite, no importando JSON.

Posibles siguientes pasos: objetivos personales «sub-X», sesiones de entrenamiento independientes, modo competición de cinco resoluciones y dibujo del estado mezclado. La base actual prioriza entrenar y compartir de forma sencilla.
