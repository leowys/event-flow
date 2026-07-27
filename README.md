# Event Flow — MVP (Etapa 1-3)

Scaffold funcional de las primeras etapas del plan de desarrollo:

- ✅ Etapa 1 — Auth (registro/login/logout con password hasheado + sesión JWT en cookie httpOnly) y CRUD de eventos.
- ✅ Etapa 2 — Gestión de invitados (alta manual, listado, búsqueda, tokens seguros vía `nanoid`). Importación CSV con `papaparse`: encabezados flexibles (Nombre/Apellido/Email/Teléfono, con o sin acentos, en cualquier orden), manejo de filas inválidas y de duplicados tanto dentro del mismo archivo como contra invitados ya cargados en el evento.
- ✅ Etapa 3 — Landing pública del evento (`/event/[slug]`) con cuenta regresiva, y flujo de RSVP público (`/rsvp/[token]`).
- ✅ Etapa 4 — Sistema de emails: subida y procesamiento de ZIP de Postcards (extracción + sanitización de HTML + imágenes embebidas), interpolación segura de variables, envío de invitaciones y disparo automático de confirmación tras el RSVP. **Proveedor configurable desde la app** (`Ajustes de email`, dentro del dashboard): soporta **Resend** y **Brevo**, con las credenciales de cada organizador guardadas encriptadas (AES-256-GCM) en la base — ya no depende de variables de entorno fijas por deploy. **Plantilla básica automática**: cada evento tiene disponible, sin subir nada, una plantilla de Invitación/Confirmación/Recordatorio generada con el logo y los colores del evento (editables desde la propia página del evento, sección "Identidad visual") — subir un ZIP de Postcards sigue siendo opcional, para cuando el evento necesita algo más elaborado.
- ✅ Etapa 5 — Estadísticas con gráficos: gráfico de torta por evento (confirmados/pendientes/rechazados) con `recharts`, gráfico de barras comparando todos los eventos en el dashboard general, y contador de emails enviados/fallidos por evento (usando los datos de `EmailLog`).
- ✅ Etapa 6 — Endurecimiento:
  - **Rate limiting** (en memoria, por IP) en login, registro, verificación/reenvío de email, RSVP público (GET y POST), y test de configuración de email. *Limitación conocida: es en memoria, por proceso — si en algún momento se escala a más de un contenedor de la app, cada uno cuenta aparte. Para eso hace falta un store compartido (Redis), fuera de alcance de este MVP.*
  - **Timezone robusto con Luxon** (`lib/eventDatetime.ts`): la cuenta regresiva, las fechas mostradas en la landing/RSVP/dashboard y las fechas interpoladas en los emails ahora combinan fecha + hora + `timezone` del evento correctamente, sin depender de la zona horaria del servidor (antes podían quedar corridas varias horas, o incluso mostrar el día equivocado, según dónde corriera el proceso).
  - **Verificación de email real**: al registrarse se genera un link de verificación válido 24hs. El envío usa la misma configuración de Resend/Brevo que el organizador carga en `Ajustes de email` (o el fallback `RESEND_API_KEY` / `EMAIL_FROM` del `.env` si todavía no cargó nada). Si no hay proveedor configurado, el registro sigue funcionando igual — la cuenta queda sin verificar con un aviso y botón de reenvío en el dashboard, en vez de bloquear el acceso.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma** + PostgreSQL
- **Tailwind CSS**
- Auth propia con **JWT** (librería `jose`) en cookie `httpOnly`, sin dependencias de terceros
- `bcryptjs` para hash de contraseñas
- `nanoid` para tokens de RSVP (CSPRNG, no secuenciales)
- `zod` para validación de inputs en cada endpoint

## Setup con Docker (recomendado para probar rápido)

Requiere Docker Desktop (o Docker + Compose) instalado.

```bash
cp .env.docker.example .env
# editá AUTH_SECRET en .env con un valor random largo
# (podés generarlo con: openssl rand -base64 32)

docker compose up --build
```

Esto levanta 3 servicios:
- **db** — Postgres 16, con un volumen persistente (`eventflow-db-data`) para que los datos no se pierdan entre reinicios.
- **migrate** — corre `prisma db push` una sola vez contra la base y termina; crea las tablas del `schema.prisma`.
- **app** — la aplicación Next.js, espera a que `db` esté saludable y `migrate` haya terminado antes de arrancar.

La app queda en `http://localhost:3001` (el puerto se define en `.env` con `APP_PORT`; por defecto usamos 3001 para evitar choques con el 3000, que muchas apps de desarrollo ocupan).

Para parar todo: `docker compose down` (agregá `-v` si además querés borrar los datos de la base).

Si cambiás el `schema.prisma`, corré de nuevo `docker compose up --build` para que el servicio `migrate` aplique los cambios.

## Construir la imagen y correrla suelta (sin docker compose)

Si querés la imagen para llevarla a otro server, un registry, o correrla contra una base ya existente (en vez de usar `docker compose`), usá:

```bash
./build.sh                    # construye "event-flow:latest"
./build.sh mi-tag:v1          # o con un tag propio
```

Esto te deja la imagen en tu Docker local (`docker images` la va a listar). El script te imprime el `docker run` exacto para levantarla, incluyendo el paso previo de aplicar el schema con el target `migrator` (necesario una sola vez, o cada vez que cambie `prisma/schema.prisma`).

Para llevar la imagen a otra máquina sin volver a buildear ahí (por ejemplo, un servidor sin acceso a este repo):

```bash
docker save -o event-flow-image.tar event-flow:latest
# copiás el .tar a la otra máquina, y ahí:
docker load -i event-flow-image.tar
```



```bash
cp .env.example .env
# completar DATABASE_URL y AUTH_SECRET en .env

npm install
npm run db:push   # crea las tablas en Postgres según prisma/schema.prisma
npm run dev
```

La app queda en `http://localhost:3000`.

## Decisiones tomadas (a validar con vos)

- **Auth propia (JWT + cookie)** en vez de NextAuth, para mantener el control total sobre el modelo de datos y no atarse a un provider — se puede migrar después si hace falta login social.
- **PostgreSQL** vía Prisma como base de datos, por ser la opción más sólida para relaciones (User → Event → Guest) y crecer sin fricción.
- Mensajes de error de login **genéricos a propósito** (no se distingue "usuario no existe" de "contraseña incorrecta") para evitar enumeración de cuentas — está en `lib/auth.ts` / `app/api/auth/login`.
- Las API keys de Resend/Brevo se encriptan con una clave derivada de `AUTH_SECRET` (ver `lib/crypto.ts`), para no pedir una variable de entorno extra solo para esto. **Importante:** si en algún momento rotás `AUTH_SECRET`, las credenciales de email ya guardadas van a quedar ilegibles y habrá que volver a cargarlas desde Ajustes.

## Merge-tags disponibles en las plantillas

Tanto en plantillas subidas por ZIP como en la básica automática:

| Tag | Contenido |
|---|---|
| `{{guest_name}}` | Nombre y apellido del invitado |
| `{{event_name}}` | Nombre del evento |
| `{{event_date}}` | Fecha formateada en español |
| `{{event_time}}` | Hora de inicio |
| `{{event_location}}` | Nombre del lugar (vacío si no se cargó) |
| `{{rsvp_link}}` | Link a la página de RSVP (el invitado elige ahí) |
| `{{rsvp_confirm_link}}` | Link directo a la página de RSVP con "Confirmar" preseleccionado |
| `{{rsvp_decline_link}}` | Link directo a la página de RSVP con "No asistiré" preseleccionado |

**Sobre `rsvp_confirm_link`/`rsvp_decline_link`:** ninguno de los dos escribe la respuesta automáticamente al abrir el link — solo navegan a la pantalla correspondiente y piden un clic final. Esto es intencional: algunos clientes de email o filtros antispam "previsualizan" los links haciendo un GET automático antes de que la persona los vea, y si esos links escribieran directo en la base, se registrarían RSVPs falsos. El flujo actual evita ese problema.



**Ya no hace falta tocar variables de entorno para esto.** Una vez que la app está corriendo:

1. Entrá a `Ajustes de email` (arriba a la derecha del dashboard).
2. Elegí el proveedor: **Resend** o **Brevo**.
3. Pegá tu API key:
   - Resend: [resend.com/api-keys](https://resend.com/api-keys)
   - Brevo: [app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)
4. Completá el nombre y email del remitente (tiene que ser de un dominio verificado en tu cuenta del proveedor para poder mandar a destinatarios reales — mientras probás, ambos proveedores dejan mandar solo a tu propio email verificado).
5. Usá "Enviar prueba" antes de guardar para confirmar que las credenciales funcionan.
6. Guardar. La API key queda **encriptada** en la base (AES-256-GCM, con clave derivada de `AUTH_SECRET`) — nunca se guarda ni se muestra en texto plano.

Esta configuración es por organizador (usuario), así que cada uno puede usar su propia cuenta de Resend/Brevo. La misma configuración se usa para invitaciones, confirmaciones, recordatorios y reenvío de verificación de cuenta.

Para pruebas sin dominio verificado, `Ajustes de email` incluye un **modo prueba**: todos los emails reales se redirigen a un único destinatario permitido por el proveedor (por ejemplo, el email verificado de la cuenta de Resend), agregando en el asunto/cuerpo cuál era el destinatario original. Esto permite probar invitados ficticios sin mandar correos fuera del entorno de prueba.

Las variables `RESEND_API_KEY` / `EMAIL_FROM` del `.env` siguen funcionando como **fallback**: si un usuario no configuró nada desde Ajustes, el sistema las usa (útil para no romper instalaciones existentes de la Etapa 4 original).

**Limitaciones conocidas de esta primera versión, a mejorar en Etapa 6:**
- Las imágenes de las plantillas se embeben directamente en el HTML del email (data URIs) para no depender de un storage externo todavía. Esto hace que el email pese más, y algunos clientes de correo (notablemente Outlook de escritorio) pueden no mostrarlas bien. La solución definitiva es subir las imágenes a un storage (S3/R2/Cloudinary) y referenciarlas por URL — es la misma decisión pendiente que ya estaba marcada para las imágenes de portada/logo del evento.
- El envío es secuencial (uno por uno), pensado para volúmenes de invitados de un evento típico. Si en algún momento se necesita mandar a miles de invitados a la vez, conviene mover esto a una cola en background en vez de un endpoint síncrono.


## Pendientes marcados en el código

Buscá `TODO` en el código para ver los puntos que quedaron señalados para las próximas etapas (verificación de email real, parser de CSV, timezone robusto en el countdown).

## Pendientes funcionales

- **QR + check-in en puerta**: agregar una capa de acreditación para eventos presenciales. Alcance sugerido:
  - generar un QR por invitado usando su `tokenUnico`;
  - crear una vista de scanner/check-in para el organizador;
  - agregar `checkedInAt` (y opcionalmente quién validó el ingreso) al modelo `Guest`;
  - marcar visualmente invitados "pendientes de ingreso" / "ingresados";
  - evitar que el QR escriba estado con un simple GET público; la validación debería requerir sesión del organizador.

## Implementado recientemente

- **Mejoras en gestión de invitados**:
  - columnas de fecha de carga, fecha de confirmación y fecha de rechazo;
  - edición de datos de contacto;
  - eliminación de invitados;
  - exportación CSV con información de aceptación/rechazo y fechas relevantes.

- **Publicación automática del evento**: cuando se envía al menos una invitación correctamente, el evento pasa a `ACTIVO` / "Publicado".

- **Recordatorios manuales de RSVP**: desde la pantalla de emails se pueden enviar recordatorios a invitados en estado `PENDIENTE`, usando plantilla de recordatorio subida o la básica automática. Para convertirlo en automático todavía falta definir:
  - cuántos días antes se envía;
  - si se envía una sola vez o múltiples recordatorios;
  - si requiere una cola/cron/background job para producción.

## Pendientes operativos

- **Crear repositorio en GitHub**: inicializar el proyecto como repo Git, definir `.gitignore` definitivo, hacer el primer commit estable y subirlo a un repositorio de GitHub para versionar cambios, abrir issues/roadmap y preparar futuras ramas de trabajo.

## Próximo paso sugerido

Definir el storage de imágenes (S3/R2/Cloudinary) para dejar de embeber las imágenes de las plantillas como data URI. Es la principal decisión externa que queda pendiente — el resto del plan original (Etapas 1 a 6) ya está implementado.
