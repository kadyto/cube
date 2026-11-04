# Despliegue y mantenimiento

## Dockhand

Usa [compose.dockhand.yaml](../compose.dockhand.yaml). Descarga `main` de `kadyto/cube` como contexto Git y utiliza su Dockerfile. El código debe estar ya incorporado en GitHub antes del primer despliegue. Se necesita acceso a GitHub, al registro de Docker y a npm durante la construcción. Para importar WCA se necesita salida HTTPS a `www.worldcubeassociation.org` en ejecución.

| Variable | Valor predeterminado | Uso |
| --- | --- | --- |
| `INITIAL_PASSWORD` | Obligatoria en Compose | Contraseña de la primera instalación; solo se aplica al crear la base de datos. |
| `APP_PORT` | `8093` | Puerto publicado por Docker. |
| `BIND_ADDRESS` | `0.0.0.0` | Interfaz donde se publica el puerto. |
| `COOKIE_SECURE` | `auto` | `auto`, `true` o `false`; con `auto`, HTTPS utiliza cookie Secure. |
| `TRUST_PROXY` | `0` | `1` para un único proxy inverso de confianza que sanea los encabezados reenviados. |

El contenedor se ejecuta sin root, con la raíz de solo lectura, un volumen `/data`, sin capacidades Linux y con un healthcheck en `/healthz`. La base de datos usa SQLite con WAL. No publiques `/data` mediante un servidor web.

## HTTPS con Nginx Proxy Manager u otro proxy

1. Apunta el proxy al puerto publicado `8093` del servidor, o al puerto `3000` del servicio `cube` si comparten red Docker.
2. Publica en la raíz de un dominio o subdominio. El despliegue en un subdirectorio no está soportado.
3. Conserva el encabezado `Host` original. Establece `X-Forwarded-Proto` y `X-Forwarded-For` a partir de la conexión real.
4. Establece `TRUST_PROXY=1` y `COOKIE_SECURE=auto` (o `true` si solo se accede mediante HTTPS).
5. Restringe el acceso directo al puerto del backend a tu proxy o red de confianza. No actives `TRUST_PROXY=1` con acceso directo público sin filtrar.

Para entrar por HTTP en una red local, conserva `TRUST_PROXY=0` y `COOKIE_SECURE=auto`. No uses `COOKIE_SECURE=true` con HTTP porque el navegador no enviaría la cookie de sesión.

Las contraseñas se almacenan con scrypt y sal aleatoria. Las sesiones utilizan cookies HttpOnly y SameSite=Lax, con caducidad de siete días. La API exige una cabecera propia en las escrituras y comprueba el origen. El inicio de sesión tiene límite de intentos por IP; cambiar la contraseña cierra las otras sesiones. La contraseña puede ser tan sencilla como quieras, por lo que conviene utilizar HTTPS cuando lo publiques en Internet.

## Actualizar

En Dockhand, reconstruye y vuelve a desplegar el stack manteniendo su nombre y el volumen `cube_data`. Con el código local:

```sh
git pull --ff-only
docker compose up --build -d
```

Haz una copia antes de actualizar. No cambies `INITIAL_PASSWORD` para restablecer una clave existente.

## Copia completa y restauración

La herramienta usa la API de backup de SQLite: incluye de forma consistente los datos del WAL aunque la aplicación siga abierta. El nombre de destino debe ser nuevo.

```sh
docker compose exec cube node server/cli.js backup /data/cube-copia-2026-11-04.sqlite
docker compose cp cube:/data/cube-copia-2026-11-04.sqlite ./cube-copia-2026-11-04.sqlite
```

Elige un nombre nuevo en cada copia. Guarda el archivo fuera del servidor y en un lugar privado: contiene historial, publicaciones, perfil y configuración de acceso. La exportación JSON de la web excluye credenciales, pero no sustituye esta copia completa.

Para restaurar, conserva primero una copia del estado actual. Detén el stack y copia el archivo de backup dentro del volumen como `/data/cube.sqlite`, con propietario `1000:1000`. Elimina los archivos antiguos `cube.sqlite-wal` y `cube.sqlite-shm` **solo con el servicio detenido y tras conservar la copia del estado anterior**. Reinicia el mismo stack. No mezcles un archivo de backup con un WAL de otra base de datos. La contraseña será la que existía en el momento del backup.

## Recuperar una contraseña olvidada

Desde la terminal del servidor, con acceso al contenedor:

```sh
docker compose exec -e CUBE_NEW_PASSWORD='tu nueva clave' cube node server/cli.js reset-password
```

Esto cambia la contraseña y cierra todas las sesiones. No modifica tiempos ni publicaciones. La nueva clave no se imprime, pero el comando puede quedar en el historial de tu shell; usa tu mecanismo habitual de inyección segura de variables si lo prefieres.

## Diagnóstico

- **No arranca una instalación nueva:** define `INITIAL_PASSWORD` con una contraseña no vacía y vuelve a desplegar.
- **El inicio de sesión funciona pero se pierde:** comprueba HTTPS, `COOKIE_SECURE`, `TRUST_PROXY` y que el proxy conserve `Host`.
- **No se puede importar WCA:** comprueba el ID y el acceso HTTPS desde el servidor. Si WCA no está disponible, conserva el ID y reintenta «Consultar WCA» más tarde; el resto de la aplicación no depende de WCA.
- **El perfil WCA ya estaba importado pero no aparecen las marcas:** después de actualizar el stack, entra en Ajustes y pulsa «Consultar WCA» una vez. Activa la opción de mostrar el perfil y las marcas WCA en público y guarda. Los datos importados anteriormente se conservan, pero no incluían las marcas oficiales.
- **La timeline muestra competiciones sin puestos:** pulsa «Consultar WCA» en Ajustes para importar las rondas y posiciones. Activa «Mostrar también mis competiciones y puestos por ronda» y guarda si quieres mostrarlos públicamente. Al actualizar se conservan las competiciones y las publicaciones anteriores.
- **Un tiempo no se guarda:** no cambies de puzzle. Usa «Reintentar guardado». El identificador de la mezcla evita duplicar el tiempo si el servidor ya lo había recibido.
- **Desaparecen los datos al actualizar:** comprueba que se está montando el mismo volumen y que no se eliminó el volumen anterior. No se guardan los tiempos en el sistema de archivos temporal del contenedor.
