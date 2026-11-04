# Cube

Un rincón de speedcubing para entrenar, ver el progreso y compartir los logros que tú elijas. Interfaz en español, pensada para móvil y ordenador. Una instalación corresponde a una persona, con una contraseña para su zona privada y una página pública sin registro.

## Qué incluye

- **3×3×3, 2×2×2 y Pyraminx.** Mezclas de estado aleatorio generadas por [cubing.js](https://js.cubing.net/cubing/scramble/), con una leyenda junto a la mezcla para aprender la notación. Son mezclas para entrenamiento con criterios de los eventos WCA; esta aplicación no es un programa oficial homologado para organizar competiciones WCA.
- **Cronómetro táctil y con barra espaciadora.** Mantén 350 ms y suelta para arrancar; pulsa para detener. Escape cancela el intento. Inspección opcional: a partir de 15 s aplica +2; a partir de 17 s, DNF. La inspección termina al soltar para iniciar la resolución.
- **Entrada manual.** Acepta `12.34`, `12,34` y `1:02.45`. Cada intento conserva su mezcla, fecha y forma de registro.
- **ao5 automático**, mejores singles, mejor ao5, gráfico de las últimas 30 resoluciones e historial por puzzle. Las medias se calculan dentro de cada puzzle; los cinco últimos intentos del historial de ese puzzle forman el ao5 actual.
- **Penalizaciones y notas privadas.** Desde el historial puedes marcar +2 o DNF, añadir una nota o eliminar un intento.
- **Publicación expresamente elegida.** Elige un single o los cinco intentos consecutivos que terminan en el seleccionado. La confirmación muestra el resultado antes de publicar. Puedes retirar la publicación cuando quieras.
- **Perfil público personalizable y WCA opcional.** Un apodo, una presentación, el enlace WCA y, si lo autorizas, el nombre, las mejores marcas oficiales (single y media) y las competiciones importadas. Las marcas WCA incluyen también las pruebas que no tienen cronómetro de entrenamiento en Cube. No se contacta con WCA hasta que pulses «Consultar WCA».
- **Timeline de competiciones WCA.** Fecha, competición y puesto en la última ronda disputada de cada prueba, con filtro por puzzle, tiempos y rondas anteriores desplegables. Muestra tres competiciones recientes y permite cargar las anteriores. Solo es pública al habilitar las competiciones en Ajustes.
- **Contraseña sencilla y modificable**, exportación JSON y copias completas de SQLite.

### Cómo se calcula el ao5

Se añaden las penalizaciones +2, se ordenan los cinco tiempos y se eliminan uno mejor y uno peor. Se hace la media de los tres restantes, redondeada a centésimas. Con un DNF se descarta ese intento; con dos o más DNF, la media es DNF. Con menos de cinco intentos se muestra `—`.

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

Las instalaciones con competiciones ya importadas deben pulsar una vez «Consultar WCA» en Ajustes para cargar sus rondas y puestos. Si no hay información de una ronda, se indica que falta en lugar de mostrar una posición inventada. La importación es manual y no altera las publicaciones de entrenamiento.

El logo está incorporado en `public/logo.png`, como PNG transparente preparado a partir de la imagen proporcionada por el propietario. Se utiliza en la cabecera, el banner público y los iconos del navegador y del móvil.

## Privacidad y alcance

Los tiempos y notas permanecen privados. Una publicación contiene una copia del resultado, sus mezclas y fechas; **nunca incluye notas privadas**. Editar o borrar un tiempo del historial no cambia una publicación existente: retírala y vuelve a publicarla si quieres actualizarla. El apartado «Marcas compartidas» se calcula exclusivamente a partir de los singles que has publicado. «Marcas oficiales WCA» muestra los mejores resultados importados de competiciones oficiales.

WCA es opcional y no requiere OAuth ni credenciales WCA. Vincular un ID **no acredita la titularidad** del perfil. La importación recoge participaciones con resultados, no inscripciones futuras. El nombre WCA, sus marcas oficiales y las competiciones se muestran únicamente al habilitar las opciones correspondientes y guardar; el nombre del rincón puede seguir siendo un apodo. Para cargar las marcas en un perfil importado con una versión anterior, pulsa una vez «Consultar WCA» en Ajustes. Esa misma acción actualiza las marcas cuando consigas nuevos resultados oficiales.

Cube no carga fuentes, analítica ni recursos de terceros en el navegador. No hay registro abierto, cuentas múltiples, sincronización con csTimer ni funcionamiento sin conexión. Si falla el guardado de un tiempo, conserva un intento pendiente en ese navegador para reintentarlo; no cierres sesión en un dispositivo compartido con un intento pendiente sin haberlo guardado. La exportación JSON permite consultar y conservar datos; la restauración completa se hace con la copia SQLite, no importando JSON.

Posibles siguientes pasos: objetivos personales «sub-X», sesiones de entrenamiento independientes, modo competición de cinco resoluciones y dibujo del estado mezclado. La base actual prioriza entrenar y compartir de forma sencilla.
