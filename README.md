# CHASKI AI 2.0

Sistema de gestión operativa para la Asociación de Transportistas ATIPCAR, ruta **Juli – Puno**, Puno, Perú.

Digitaliza la cola de salida diaria, el registro de manifiestos de pasajeros, el seguimiento GPS de la flota en tiempo real y el análisis operativo mediante un asistente de inteligencia artificial.

---

## Tabla de contenidos

- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo correr el proyecto](#cómo-correr-el-proyecto)
- [Puertos y servicios](#puertos-y-servicios)
- [API — Endpoints principales](#api--endpoints-principales)
- [Roles de usuario](#roles-de-usuario)
- [Documentación técnica](#documentación-técnica)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript Vanilla (sin framework) |
| Backend | Node.js 18+, Express 4 |
| Base de datos | PostgreSQL 14+ |
| Autenticación | JWT + Refresh Tokens + CSRF |
| GPS | Traccar (API REST) + Servidor TCP Teltonika Codec 8 |
| IA | Anthropic Claude API (claude-sonnet-4-6) |
| Seguridad | Helmet, CORS, bcryptjs, express-rate-limit, xss |

---

## Requisitos previos

- **Node.js** v18 o superior
- **npm** v9 o superior
- **PostgreSQL** 14 o superior
- Acceso a una instancia de **Traccar** (opcional para GPS)
- **API key de Anthropic** (opcional para el asistente IA)

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/chaski-ai.git
cd chaski-ai
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus valores reales
```

Ver la sección [Variables de entorno](#variables-de-entorno) para descripción de cada variable.

### 4. Crear la base de datos PostgreSQL

```sql
CREATE DATABASE chaski_ai2;
```

Las tablas se crean automáticamente al arrancar el servidor por primera vez (auto-migración en arranque).

### 5. Crear el usuario administrador

Ejecuta en PostgreSQL:

```sql
-- Insertar asociación
INSERT INTO associations (name) VALUES ('ATIPCAR') RETURNING id;

-- Insertar usuario admin (contraseña: Admin2024!)
INSERT INTO users (username, password_hash, role, association_id, active)
VALUES (
  'admin',
  '$2a$12$...', -- usa bcrypt para generar el hash
  'admin',
  '<association_id>',
  true
);
```

O usa el endpoint de login con las credenciales iniciales configuradas en el `.env`.

### 6. Iniciar el servidor

```bash
# Desarrollo (con hot-reload)
npm run dev

# Producción
npm start
```

El servidor arranca en `http://localhost:3005`.

---

## Variables de entorno

Copia `backend/.env.example` a `backend/.env` y completa los valores:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `PORT` | No | Puerto del servidor (default: `3005`) |
| `NODE_ENV` | No | Entorno: `development` o `production` |
| `DB_HOST` | Sí | Host de PostgreSQL (default: `localhost`) |
| `DB_PORT` | No | Puerto de PostgreSQL (default: `5432`) |
| `DB_NAME` | Sí | Nombre de la base de datos |
| `DB_USER` | Sí | Usuario de PostgreSQL |
| `DB_PASSWORD` | Sí | Contraseña de PostgreSQL |
| `JWT_SECRET` | **Crítica** | Clave secreta JWT (mínimo 32 caracteres) |
| `JWT_EXPIRES_IN` | No | Duración del token de acceso (default: `24h`) |
| `ALLOWED_ORIGINS` | Sí en prod. | URLs del frontend separadas por coma |
| `TRACCAR_URL` | No | URL base de Traccar (ej: `http://servidor:8082`) |
| `TRACCAR_USER` | No | Usuario de Traccar |
| `TRACCAR_PASS` | No | Contraseña de Traccar |
| `ANTHROPIC_API_KEY` | No | API key de Anthropic para el asistente IA |
| `MAX_SPEED_LIMIT` | No | Velocidad máxima permitida en km/h (default: `90`) |
| `SPEED_ALERT_DURATION_MINUTES` | No | Cooldown entre alertas de velocidad (default: `4`) |

---

## Estructura del proyecto

```
chaski-ai/
│
├── backend/                    Servidor Node.js + Express
│   ├── config/
│   │   └── db.js               Pool de conexión PostgreSQL
│   ├── middleware/
│   │   ├── auth.js             JWT auth + verificación active en BD
│   │   ├── adminOnly.js        Guard de rol admin
│   │   ├── csrf.js             Protección CSRF
│   │   ├── rateLimiter.js      Rate limiting por endpoint
│   │   ├── sanitize.js         Sanitización XSS de body y query
│   │   ├── validate.js         Validación de entrada con Joi
│   │   ├── audit.js            Registro de auditoría
│   │   └── errorHandler.js     Manejo global de errores
│   ├── routes/
│   │   ├── auth.js             Login, logout, refresh, change-password
│   │   ├── drivers.js          CRUD de conductores
│   │   ├── vehicles.js         CRUD de vehículos y empresas
│   │   ├── queue.js            Cola de salida diaria
│   │   ├── manifests.js        Manifiestos de pasajeros
│   │   ├── trips.js            Registro y cierre de viajes
│   │   ├── gps.js              Posiciones GPS (Traccar + fallback BD)
│   │   ├── gps-devices.js      Dispositivos GPS
│   │   ├── reports.js          Reportes operativos
│   │   ├── assistant.js        Asistente IA (Claude API)
│   │   ├── communications.js   Comunicados y notificaciones
│   │   └── index.js            Router agregador
│   ├── migrations/
│   │   └── security_tables.sql Tablas de seguridad (JWT, sesiones, auditoría)
│   ├── gps-server.js           Servidor TCP Teltonika FMC130 Codec 8
│   ├── server.js               Entry point
│   ├── .env.example            Plantilla de variables de entorno
│   └── package.json
│
├── driver/                     Portal del conductor (HTML/CSS/JS)
│   ├── index.html / index.js   Dashboard del conductor
│   ├── queue.html / queue.js   Cola de salida (inscripción + estado)
│   ├── manifest.html / manifest.js  Registro de manifiesto
│   ├── trips.html / trips.js   Historial y cierre de viajes
│   └── core.js                 authFetch + guard de sesión
│
├── admin/                      Panel de administración (HTML/CSS/JS)
│   ├── index.html / index.js   Dashboard con KPIs
│   ├── queue/                  Cola de salida (Lista Diaria + Lista Madre)
│   ├── drivers/                Gestión de conductores
│   ├── vehicles/               Gestión de vehículos
│   ├── manifests/              Revisión de manifiestos
│   ├── trips/                  Análisis de viajes
│   ├── gps/                    Mapa en tiempo real
│   ├── reports/                Reportes exportables
│   ├── assistant/              Asistente IA operativo
│   ├── communications/         Comunicados a conductores
│   └── js/
│       ├── core.js             authFetch + guard de sesión admin
│       ├── sidebar.js          Navegación lateral
│       └── ui.js               Utilidades de UI
│
├── css/                        Estilos globales compartidos
├── img/                        Recursos gráficos
├── Docs/                       Documentación técnica
│   ├── diagrama-bd.html        Diagrama entidad-relación
│   ├── ARQUITECTURA_CAPAS.html Diagrama de arquitectura
│   ├── estructura-carpetas.md  Descripción de módulos
│   └── SISTEMA_TOTAL.txt       Overview del sistema
│
├── login.html                  Página de inicio de sesión
├── .gitignore
└── README.md                   Este archivo
```

---

## Cómo correr el proyecto

### Desarrollo

```bash
cd backend
npm run dev        # nodemon — reinicia al guardar cambios
```

Abre el frontend en cualquier servidor estático. Con VS Code usa **Live Server** apuntando a la raíz del proyecto, o:

```bash
# Desde la raíz del proyecto (Python)
python -m http.server 5500

# O con npx (Node.js)
npx serve . -p 5500
```

### Producción

```bash
cd backend
NODE_ENV=production npm start
```

El propio backend sirve los archivos estáticos del frontend desde la raíz del proyecto.

---

## Puertos y servicios

| Puerto | Servicio | Descripción |
|--------|---------|-------------|
| `3005` | Backend Express | API REST + archivos estáticos |
| `2223` | TCP Server (interno) | Receptor Teltonika FMC130 Codec 8 |
| `8082` | Traccar (externo) | API de posiciones GPS en tiempo real |

---

## API — Endpoints principales

Todos los endpoints requieren `Authorization: Bearer <token>` excepto los marcados como públicos.

### Autenticación

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | Público | Iniciar sesión |
| `POST` | `/api/auth/refresh` | Público | Renovar access token |
| `POST` | `/api/auth/logout` | JWT | Cerrar sesión |
| `POST` | `/api/auth/change-password` | JWT | Cambiar contraseña propia |
| `GET` | `/api/auth/me` | JWT | Datos del usuario actual |

### Cola de salida

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/queue?route=juli-puno&date=YYYY-MM-DD` | JWT | Lista de la cola del día |
| `GET` | `/api/queue/fleet` | Admin | Estado de toda la flota |
| `POST` | `/api/queue/register` | JWT | Inscribir conductor en cola |
| `PUT` | `/api/queue/:id` | Admin | Cambiar posición |
| `PUT` | `/api/queue/:id/depart` | Admin | Marcar salida + auto-avance |
| `DELETE` | `/api/queue/:id` | Admin | Cancelar inscripción |

### Manifiestos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/manifests/complete` | JWT | Guardar manifiesto + pasajeros + viaje (transacción) |
| `GET` | `/api/manifests` | JWT | Listar manifiestos con filtros |
| `GET` | `/api/manifests/:id` | JWT | Detalle de un manifiesto |

### Viajes

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/trips` | JWT | Historial de viajes |
| `GET` | `/api/trips/:id` | JWT | Detalle de un viaje |
| `PUT` | `/api/trips/:id/end` | JWT | Marcar llegada a destino |

### GPS

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/gps/live` | JWT | Posiciones actuales (Traccar) |
| `GET` | `/api/gps/history/:vehicleId` | JWT | Historial de posiciones del día |
| `POST` | `/api/gps/simulate` | JWT | Inyectar posición de prueba |

### Asistente IA

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/assistant/chat` | JWT | Consulta al asistente operativo |

### Otros

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/health` | Público | Estado del servidor y BD |
| `GET` | `/api/drivers` | Admin | Lista de conductores |
| `POST` | `/api/drivers` | Admin | Registrar conductor + cuenta |
| `GET` | `/api/vehicles` | Admin | Lista de vehículos |
| `GET` | `/api/reports/summary` | Admin | Resumen operativo del día |

---

## Roles de usuario

| Rol | Acceso | Portal |
|-----|--------|--------|
| `admin` | Panel completo — gestión de flota, reportes, comunicados | `/admin/` |
| `driver` | Portal del conductor — cola, manifiestos, viajes | `/driver/` |

---

## Documentación técnica

| Documento | Descripción |
|-----------|-------------|
| [Diagrama ER](Docs/diagrama-bd.html) | Esquema de base de datos con todas las relaciones |
| [Arquitectura](Docs/ARQUITECTURA_CAPAS.html) | Diagrama de capas del sistema |
| [Estructura](Docs/estructura-carpetas.md) | Descripción detallada de cada módulo |
| [Overview](Docs/SISTEMA_TOTAL.txt) | Resumen ejecutivo del sistema completo |

---

## Seguridad implementada

- **JWT** con access tokens (24h) y refresh tokens (7 días) con rotación
- **Bcrypt** con 12 rounds para hashing de contraseñas
- **CSRF** token embebido en el JWT y validado en cabecera
- **Rate limiting** diferenciado: login (10/15min), API (300/min), IA (30/min)
- **XSS** — sanitización de body y query params con librería `xss`
- **SQL Injection** — prepared statements en todas las queries
- **Helmet** — cabeceras HTTP de seguridad
- **CORS** — whitelist estricta de orígenes permitidos
- Verificación de `active = true` en BD en cada request autenticado

---

## Licencia

Proyecto académico — Tesis de Ingeniería de Sistemas, Universidad Peruana de Ciencias Aplicadas (UPC).
