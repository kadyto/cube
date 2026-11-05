# Cube

Un rincón de speedcubing para entrenar, ver el progreso y compartir los logros que tú elijas. Interfaz en español, pensada para móvil y ordenador. Una instalación corresponde a una persona, con una contraseña para su zona privada y una página pública sin registro.

## Qué incluye

- **Demo pública sin contraseña.** Entrada «Demo» en el menú y acceso directo por `/#/demo`. Genera mezclas y usa el cronómetro táctil o con espacio para los tres puzzles, con inspección opcional, leyenda y dibujo. Sólo muestra el intento actual; no guarda tiempos, mezclas ni preferencias, ni ofrece historial, estadísticas, exportación o publicaciones.
- **3×3×3, 2×2×2 y Pyraminx.** Mezclas de estado aleatorio generadas por [cubing.js](https://js.cubing.net/cubing/scramble/), con una leyenda junto a la mezcla para aprender la notación. Son mezclas para entrenamiento con criterios de los eventos WCA; esta aplicación no es un programa oficial homologado para organizar competiciones WCA.
- **Cronómetro táctil y con barra espaciadora.** Mantén 350 ms y suelta para arrancar; pulsa para detener. Escape cancela el intento. Inspección opcional: a partir de 15 s aplica +2; a partir de 17 s, DNF. La inspección termina al soltar para iniciar la resolución.
- **Pantalla encendida al entrenar.** Evita el apagado automático durante toda la vista de Entrenamiento: mirando una mezcla, durante la inspección, cronometrando o introduciendo tiempos a mano. Se libera al salir o poner la página en segundo plano y se solicita de nuevo al volver.
- **Dibujo de la mezcla.** Desplegado en color del estado exacto que produce la secuencia actual en 3×3×3, 2×2×2 y Pyraminx, con opción de ampliarlo en el móvil. Se actualiza con cada nueva mezcla y al cambiar de puzzle, también en el modo de entrada manual.
- **Entrada manual.** Acepta `12.34`, `12,34` y `1:02.45`. Cada intento conserva su mezcla, fecha y forma de registro.
- **ao5 automático**, mejores singles, mejor ao5, gráfico de las últimas 30 resoluciones e historial por puzzle. Las medias se calculan dentro de cada puzzle; los cinco últimos intentos del historial de ese puzzle forman el ao5 actual.
- **Edición y borrado individual.** Botones visibles en cada tiempo del historial y acceso directo junto al último tiempo guardado. Puedes corregir el tiempo, marcar +2 o DNF, añadir una nota privada o borrar el intento con confirmación.
- **Publicación expresamente elegida.** Elige un single o los cinco intentos consecutivos que terminan en el seleccionado. La confirmación muestra el resultado antes de publicar. Puedes retirar la publicación cuando quieras.
- **Perfil público personalizable y WCA opcional.** Un apodo, una presentación, el enlace WCA y, si lo autorizas, el nombre, las mejores marcas oficiales (single y media) y las competiciones importadas. Las marcas WCA incluyen también las pruebas que no tienen cronómetro de entrenamiento en Cube. Al guardar un ID WCA, sus datos se actualizan automáticamente cada hora; «Consultar WCA» permite adelantar la actualización.
- **Timeline de competiciones WCA.** Fecha, competición y puesto en la última ronda disputada de cada prueba, con filtro por puzzle, tiempos y rondas anteriores desplegables. Muestra tres competiciones recientes y permite cargar las anteriores. Solo es pública al habilitar las competiciones en Ajustes.
- **Próximas inscripciones WCA y comparación diaria opcional.** Consulta las competiciones futuras con inscripción aceptada y elige si mostrarlas en público. Puedes activar un corte de puestos por marcas oficiales de los inscritos, como máximo una vez cada 24 horas. Ambas opciones empiezan desactivadas.
- **Contraseña sencilla y modificable**, exportación JSON y copias completas de SQLite.

### Cómo se calcula el ao5

Se añaden las penalizaciones +2, se ordenan los cinco tiempos y se eliminan uno mejor y uno peor. Se hace la media de los tres restantes, redondeada a centésimas. Con un DNF se descarta ese intento; con dos o más DNF, la media es DNF. Con menos de cinco intentos se muestra `—`.

### Editar, borrar y reponer intentos

Los intentos tienen un número estable dentro de cada puzzle. Si borras el #3, los otros conservan sus números y el siguiente tiempo que guardes en ese puzzle ocupará el #3. Si borras varios, se rellena primero el hueco de menor número. El próximo número aparece junto a la mezcla y en el historial.

Los ao5 siguen el orden de los números de intento y necesitan cinco números consecutivos. Si se borra un intento de ese bloque, su ao5 queda pendiente (`—`) hasta reponerlo. Al corregir o reponer un tiempo se recalculan los ao5 y las estadísticas privadas. Los ao5 de bloques completos que no contienen ese hueco siguen disponibles.

Si arrancas y paras el cronómetro por error, pulsa «Borrar último tiempo» y confirma. Se recuperan el número disponible y la mezcla del intento accidental para repetirlo. También puedes pulsar «Editar último tiempo» o abrir cualquier tiempo del historial.

Las publicaciones son copias de los resultados que elegiste compartir: editar, borrar o reponer un intento privado no las cambia automáticamente. Para cambiar una publicación, retírala y publica el resultado corregido. Las bases de datos anteriores se actualizan al arrancar, conservando los tiempos, sus identificadores, mezclas y notas.

### Mantener la pantalla encendida

Entrenamiento utiliza Screen Wake Lock automáticamente, sin depender de que el cronómetro esté corriendo. El indicador «Pantalla encendida durante el entrenamiento» confirma que el navegador ha aceptado la solicitud. El bloqueo se libera al cambiar de sección, cerrar sesión, ocultar la página o abandonarla; al regresar se intenta recuperar, también después de volver de otra aplicación o del bloqueo manual del móvil.

Esta función necesita HTTPS y un navegador compatible (en desarrollo también funciona en `localhost`). El sistema puede rechazarla o retirarla por ahorro de batería u otras restricciones; en ese caso se muestra el estado y puedes reintentar, y también se intenta de nuevo al tocar la pantalla o usar el teclado. No impide bloquear manualmente el móvil. Si no está disponible, el cronómetro y la entrada manual siguen funcionando normalmente.

### Comprobar una mezcla con el dibujo

Debajo del cronómetro aparece «Así queda tu mezcla»: las seis caras desplegadas del cubo o las cuatro del Pyraminx después de aplicar la secuencia indicada al puzzle resuelto. En los cubos, empieza con blanco arriba y verde delante; en Pyraminx, con verde delante y amarillo en la base. Los giros de las puntas del Pyraminx también se representan. «Ampliar dibujo» abre una vista mayor con la misma mezcla escrita; ciérrala para volver a cronometrar.

El estado y el dibujo se calculan localmente con cubing.js, sin servicios externos ni animaciones. El dibujo se conserva durante el intento y se sustituye al generar la siguiente mezcla. Si borras el último intento accidental y recuperas su mezcla, también se recupera su dibujo. Los fallos del dibujo no impiden usar la secuencia, el cronómetro o la entrada manual.

### Usar la demo sin contraseña

Entra en «Demo» desde el menú, desde la pantalla de acceso o directamente por `/#/demo`. Elige un puzzle, mezcla y mantén pulsado el cronómetro (o espacio) para iniciar; pulsa para parar. «Siguiente mezcla» prepara otro intento. La pantalla se mantiene encendida mientras esté disponible Screen Wake Lock, igual que en el entrenamiento privado.

La demo conserva sólo el intento actual en memoria y lo descarta al salir o recargar. No lee ni escribe preferencias o intentos pendientes del entrenamiento privado en el navegador. El cronómetro no envía tiempos al servidor. La ruta pública `POST /api/demo/scramble` sólo devuelve evento y secuencia, sin crear identificadores, filas de SQLite ni sesiones; la generación se sirve con `Cache-Control: no-store`. Entrenamiento, historial, ajustes, exportaciones y publicaciones conservan su contraseña. Usar la demo con una sesión del propietario abierta tampoco guarda tiempos ni modifica su historial.

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

La integración WCA utiliza los endpoints públicos `GET /api/v0/persons/:id`, `GET /api/v0/persons/:id/competitions`, `GET /api/v0/persons/:id/results`, `GET /api/v0/users/:id?upcoming_competitions=true` y `GET /api/v0/competitions/:id/wcif/public`. Las pruebas simuladas cubren privacidad, empates, marcas ausentes y el límite diario persistente. Los endpoints de inscripciones y WCIF se comprobaron también con WCA real. Su disponibilidad depende de la conexión del servidor a `www.worldcubeassociation.org`.

### Cómo leer la timeline de competiciones

La timeline agrupa los resultados por competición y prueba, ordenados desde la competición más reciente. La tarjeta resume la última ronda alcanzada: por ejemplo, «8.º · Final» o «15.º · Primera ronda». Al desplegarla se ven los puestos y resultados de las rondas anteriores. El filtro permite seguir una misma prueba entre competiciones.

Cada puesto procede del campo oficial `pos` de su ronda. No es una clasificación global de todos los participantes de la competición; no se inventan denominadores de participantes ni variaciones de ranking. Un puesto entre los tres primeros de una primera ronda o una final B no se presenta como podio. Los trofeos se reservan para resultados válidos entre los tres primeros de una final. DNF y DNS se conservan como tales.

Las competiciones ya importadas que carecen de rondas y puestos se completan automáticamente al revisar el perfil. Si no hay información de una ronda, se indica que falta en lugar de mostrar una posición inventada. Estas actualizaciones no alteran las publicaciones de entrenamiento.

### Actualizaciones automáticas de WCA

Con un ID WCA guardado, el servidor revisa el perfil, las marcas y los resultados cada hora, aunque el navegador esté cerrado. Al arrancar comprueba si faltan datos o si los anteriores han caducado. No necesita un cron externo ni nuevas variables del Compose. Sin un ID vinculado no consulta WCA.

Si WCA no responde o devuelve un error, conserva la última información válida y reintenta tras 15 minutos. La fecha de la última consulta y los reintentos se guardan en SQLite y se conservan al reiniciar. Las actualizaciones respetan el apodo, la presentación y las opciones de visibilidad elegidas, y nunca publican tiempos privados automáticamente. Quitar el ID WCA detiene las consultas de ese perfil.

La portada comprueba los datos del servidor cada minuto mientras está visible y al recuperar el foco, por lo que incorpora los cambios sin recargarla a mano. En Ajustes se muestran la última actualización, la próxima comprobación y los posibles errores; «Consultar WCA» permite actualizar en ese momento.

Las competiciones disputadas aparecen en la timeline cuando WCA publica sus resultados oficiales. Las inscripciones futuras se consultan por separado, según se explica a continuación.

### Próximas competiciones y corte diario de marcas

En Ajustes, con un ID WCA guardado, se muestra una vista privada de las próximas competiciones. El servidor consulta cada hora las **inscripciones aceptadas** disponibles en el usuario público vinculado al ID. No incluye inscripciones pendientes o en lista de espera. Si no hay un usuario público vinculado o WCA no responde, se explica el problema y se conservan los últimos datos válidos. Las competiciones dejan de aparecer al llegar su fecha de inicio (UTC).

Para publicarlas, activa «Mostrar en público las próximas competiciones con inscripción aceptada», junto con la opción de mostrar el perfil WCA, y guarda. Esta opción es independiente de mostrar las competiciones pasadas. Está desactivada por defecto, también al actualizar una instalación existente.

«Calcular una referencia de puesto por marcas oficiales cada 24 horas» habilita una comparación opcional usando el WCIF público de cada próxima competición. Solo cuenta inscritos aceptados que compiten en esa prueba y compara la mejor media oficial cuando la primera ronda usa media, o el mejor single cuando usa mejor intento. Incluye todas tus pruebas inscritas reconocidas por Cube, no solo las tres disponibles para entrenar. Los empates comparten puesto. Si cuatro inscritos no tienen marca, un puesto conocido de 12.º se presenta como **12.º–16.º**, con el número total de inscritos y cuántos tienen referencia. Si tú no tienes una marca comparable, se indica y no se calcula un puesto.

Es una referencia por récords personales, **no una predicción del resultado real ni del pase de ronda**. Cada tarjeta muestra la fecha exacta de su corte, ya que las inscripciones y los récords pueden cambiar. La vista privada permite revisarla sin publicar; si también habilitas las próximas competiciones públicas, se mostrará allí. Desactivar el cálculo oculta las comparaciones guardadas.

El límite es de **un lote de comparaciones por instalación cada 24 horas**, no un reinicio a medianoche. Se guarda en SQLite antes de consultar WCIF y también se mantiene si la consulta falla, al reiniciar, al cambiar de ID o al desactivar y volver a activar la opción. «Actualizar inscripciones» adelanta la consulta de la lista, pero nunca salta ese límite. Las nuevas competiciones o cambios de inscripción se incorporan a la comparación en el siguiente corte permitido. Sin próximas competiciones o con la comparación desactivada no se descarga WCIF. Se conservan solo tus referencias y los recuentos agregados; no se guardan nombres, IDs ni marcas individuales de otros inscritos.

El logo está incorporado en `public/logo.png`, como PNG transparente preparado a partir de la imagen proporcionada por el propietario. Se utiliza en la cabecera y los iconos del navegador y del móvil. El cubo del banner muestra siempre un PLL Jb con amarillo arriba, verde delante y naranja a la derecha; sus pegatinas se verifican con cubing.js.

## Privacidad y alcance

Los tiempos y notas permanecen privados. Una publicación contiene una copia del resultado, sus mezclas y fechas; **nunca incluye notas privadas**. Editar o borrar un tiempo del historial no cambia una publicación existente: retírala y vuelve a publicarla si quieres actualizarla. El apartado «Marcas compartidas» se calcula exclusivamente a partir de los singles que has publicado. «Marcas oficiales WCA» muestra los mejores resultados importados de competiciones oficiales.

WCA es opcional y no requiere OAuth ni credenciales WCA. Vincular un ID **no acredita la titularidad** del perfil. El nombre WCA, sus marcas oficiales, las competiciones pasadas y las próximas inscripciones se muestran únicamente al habilitar sus opciones correspondientes y guardar; el nombre del rincón puede seguir siendo un apodo. La comparación diaria también requiere activarla expresamente. Los perfiles de versiones anteriores se actualizan automáticamente al arrancar el servidor si les faltan datos, manteniendo las nuevas opciones desactivadas.

Cube no carga fuentes, analítica ni recursos de terceros en el navegador. No hay registro abierto, cuentas múltiples, sincronización con csTimer ni funcionamiento sin conexión. Si falla el guardado de un tiempo, conserva un intento pendiente en ese navegador para reintentarlo; no cierres sesión en un dispositivo compartido con un intento pendiente sin haberlo guardado. La exportación JSON permite consultar y conservar datos; la restauración completa se hace con la copia SQLite, no importando JSON.

Posibles siguientes pasos: objetivos personales «sub-X», sesiones de entrenamiento independientes y modo competición de cinco resoluciones. La base actual prioriza entrenar y compartir de forma sencilla.
