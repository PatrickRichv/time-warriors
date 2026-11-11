# TIME WARRIORS: PORTAL RUSH

Juego web multijugador en vivo para practicar **Present Perfect vs Simple Past**. El anfitrión proyecta la pantalla, los estudiantes entran escaneando un QR y compiten por equipos en una carrera espacial con retos de gramática y desafíos orales.

## Qué incluye

- **5 escuadrones** con color e identidad propia: Nova, Eclipse, Comet, Vortex y Orion.
- **Carrera en vivo** con pista por carriles, naves que avanzan según el XP y marcador de corazones.
- **Banco de 20 preguntas** de gramática que no se repite durante la partida.
- **Configuración del anfitrión**: 5, 7 o 10 rondas y 15, 20 o 30 segundos por ronda.
- **Resultados pedagógicos**: al cerrar cada ronda se revelan la respuesta correcta y la explicación, además del acierto por equipo.
- **Reto oral** para el equipo con menos XP entre los que tienen jugadores conectados.
- **Reconexión automática**: si un estudiante refresca o pierde la señal, vuelve a su equipo con su puntaje. El anfitrión también recupera la sala al recargar.
- **Sonido, vibración y animaciones** en el móvil, con opción de silenciar.
- **Modo proyector**: tipografía grande, alto contraste, panel de control y QR siempre visible.
- **Diseño responsive** probado en móvil (390 px), tableta y escritorio, con soporte de `prefers-reduced-motion`.

## Cómo dirigir una partida

1. En el computador que proyectarás, abre la web y pulsa **Crear sala de clase**.
2. Elige el número de rondas y el tiempo por ronda, escribe tu nombre y genera la sala. Verás el código y el QR.
3. Los estudiantes escanean el QR, escriben su nombre y eligen uno de los cinco escuadrones.
4. Pulsa **Iniciar ronda**. Cada acierto suma **100 XP** y mueve la nave del equipo.
5. Al terminar el tiempo (o al cerrar la ronda) se muestra la respuesta correcta y el equipo con menos XP enfrenta un **reto oral**.
6. Escucha al equipo y pulsa **Lo lograron** o **Pierden un corazón**. También puedes ajustar corazones manualmente en el panel lateral.
7. Cada equipo inicia con 3 corazones. La partida termina al completar las rondas o cuando queda un solo equipo con vida, y aparece el podio con el ranking completo.

El anfitrión puede terminar la partida antes con **Terminar partida** y puede corregir corazones con los botones `−` y `+` del panel de escuadrones.

## Inicio local

1. Instala Node.js 20+ y ejecuta `npm install`.
2. Copia `.env.example` a `.env`. `DATABASE_URL` es opcional: sin ella las puntuaciones del leaderboard se guardan solo mientras el servidor esté encendido.
3. Ejecuta `npm run dev` y abre `http://localhost:5173`.
4. Para validar la entrega: `npm test` y `npm run build`.

La API escucha por defecto en el puerto `3002` y Vite en `5173`. Puedes cambiar el destino del proxy con `API_URL`:

```powershell
$env:API_URL='http://localhost:3003'; npx vite
```

### Probar con celulares en el aula (misma red Wi-Fi)

`npm run dev` ya expone la app en la red local. En la terminal verás algo como:

```
Local:    http://localhost:5173/
Network:  http://192.168.1.20:5173/
```

La sala del anfitrión usa esa IP real en el QR y muestra la dirección bajo el código (`📱 Celulares: 192.168.1.20:5173`). Si los celulares no cargan:

1. Confirma que el computador y los teléfonos están en la misma red Wi-Fi.
2. Acepta el aviso del Firewall de Windows para Node.js en **Redes privadas**.
3. Si hay varias IP, usa la que pertenece a Wi-Fi/Ethernet (la app prioriza la conexión principal).

Para una clase real también puedes compilar y servir todo desde un solo puerto: `npm run build` y luego `npm start`, abriendo `http://TU-IP:3002`.

### Si aparece “No se pudo crear la sala” o “Sin conexión con el servidor”

Casi siempre significa que el frontend está abierto pero la API no está corriendo (por ejemplo, otra copia del proyecto ocupa el puerto `3002`). Revisa:

```powershell
netstat -ano | findstr /C:":3002 "
```

Si hay un proceso ajeno, ciérralo o cambia el puerto antes de arrancar. La app ahora muestra un aviso persistente con botón **Reintentar** cuando pierde la conexión, y `npm run dev` se detiene si la API no puede iniciar (en lugar de dejar una web rota).

## Demo en vivo

**https://time-warriors.onrender.com**

Está desplegado en Render con el plan gratuito: el servicio **se suspende tras 15 minutos sin uso** y tarda unos 50 segundos en despertar, así que conviene abrir la URL unos minutos antes de la clase.

## Despliegue en Render

1. Sube esta carpeta a un repositorio de GitHub (no incluyas `.env`).
2. En Render selecciona **New + → Blueprint** y conecta el repositorio. Render leerá `render.yaml` y creará el servicio web.
3. Cuando termine, abre la URL `https://time-warriors.onrender.com`. El servicio usa `npm start`, que entrega el frontend compilado y la API.
4. Cada `git push` a `main` vuelve a desplegar automáticamente.

El blueprint no crea base de datos: las salas y el ranking de la partida viven en memoria y funcionan perfecto, pero el ranking histórico se reinicia cuando Render reinicia el servicio. Si quieres persistencia, añade una instancia PostgreSQL en Render y define `DATABASE_URL` con su *Internal Database URL*; el servidor crea la tabla `scores` automáticamente.

Si prefieres crear el servicio a mano: Web Service, runtime Node, build `npm ci --include=dev && npm run build`, start `npm start`, health check `/api/health`.

## Código QR

El QR se genera automáticamente dentro de la sala y apunta a `?join=CÓDIGO`, por lo que al escanearlo el estudiante llega directo al formulario con el código ya escrito. Para usarlo en clase, abre la URL pública de Render (no `localhost`) y proyecta el QR desde la pantalla del anfitrión.

## Seguridad y datos

La API limita solicitudes, valida y acota nombres, puntajes y niveles, y usa consultas PostgreSQL parametrizadas. Solo se guardan alias, equipo opcional, puntaje y nivel; no se solicitan contraseñas ni datos personales. Los códigos de sala y los tokens de anfitrión son aleatorios y viven en memoria. Para un uso escolar real, informa a los estudiantes antes de publicar sus alias en el ranking.

## Rutas API

- `GET /api/health`
- `GET /api/network` (IPs locales para el enlace del QR)
- `GET /api/leaderboard`
- `POST /api/leaderboard` con `{ name, team?, score, level }`

## Estructura

- `src/main.jsx`: aplicación React, pantallas y lógica en tiempo real.
- `src/styles.css`: sistema visual completo (tokens, componentes, responsive y accesibilidad).
- `server/rooms.js`: salas, rondas, puntajes, corazones y reconexión por Socket.IO.
- `server/index.js`: API HTTP, estáticos y servidor Socket.IO.
- `test/server.test.js`: validación del banco de preguntas y reglas del juego.
