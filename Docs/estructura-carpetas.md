# Estructura de Carpetas — Chaski AI 2.0

---

## Raíz del proyecto

| Archivo / Carpeta | Descripción |
|-------------------|-------------|
| `index.html` | Landing page pública del sistema (Three.js + GSAP) |
| `login.html` / `login.js` / `login.css` | Página de autenticación con JWT |
| `index.css` | Estilos globales de la landing page |
| `main.js` | Animaciones 3D de la landing (Three.js) |
| `admin/` | Panel de control del administrador ATIPCAR |
| `driver/` | Portal del conductor (manifiestos y cola) |
| `backend/` | Servidor Node.js + Express (API REST) |
| `database/` | Scripts SQL del esquema de base de datos |
| `css/` | Hojas de estilo compartidas entre vistas |
| `img/` | Logotipos e imágenes del sistema |
| `img-conductores/` | Fotografías de perfil de los conductores |
| `js/` | Scripts JavaScript de utilidad compartidos |
| `Docs/` | Documentación técnica del proyecto |

---

## Panel Administrador — `admin/`

| Carpeta / Archivo | Descripción |
|-------------------|-------------|
| `index.html` | Dashboard principal: KPIs en tiempo real, mapa GPS, alertas operativas y gráficos de recaudación |
| `index.css` | Hoja de estilos base compartida por todo el panel administrador |
| `index.js` | Lógica del dashboard: reloj, gráficos Chart.js, mapa Leaflet y tabla de viajes |
| `manifests/` | Módulo de manifiestos de viaje: creación, edición, cierre y lista de pasajeros |
| `trips/` | Módulo de viajes: historial, filtros por período y estadísticas operativas |
| `vehicles/` | Módulo de vehículos: estado de la flota, ficha técnica y asignaciones |
| `drivers/` | Módulo de conductores: perfiles, estado, empresa asignada y rendimiento |
| `queue/` | Módulo de cola FIFO: lista diaria de salida, turnos y control de posiciones |
| `gps/` | Módulo de dispositivos GPS: registro de rastreadores Teltonika FMC130 y asignación a vehículos |
| `reports/` | Módulo de reportes: KPIs ejecutivos, ranking de conductores y alertas de velocidad |
| `assistant/` | Módulo del asistente IA conversacional powered by Claude (Anthropic) |
| `assistant-widget.css / .js` | Widget flotante del asistente IA presente en todas las vistas del admin |
| `communications.js` | Utilidad compartida para llamadas a la API REST del backend |

---

## Portal Conductor — `driver/`

| Carpeta / Archivo | Descripción |
|-------------------|-------------|
| `index.html / .js / .css` | Vista principal del conductor: resumen del día y accesos rápidos |
| `manifest/` | Creación y gestión del manifiesto de viaje desde el dispositivo del conductor |
| `queue/` | Consulta de posición en la cola FIFO de salida |
| `trips/` | Historial de viajes del conductor |

---

## Backend — `backend/`

| Archivo / Carpeta | Descripción |
|-------------------|-------------|
| `server.js` | Servidor Express principal: middlewares, rutas estáticas, URLs limpias y arranque del servidor GPS TCP |
| `routes/` | Endpoints REST de la API agrupados por módulo |
| `routes/auth.js` | Autenticación: login y generación de token JWT |
| `routes/drivers.js` | CRUD de conductores |
| `routes/vehicles.js` | CRUD de vehículos |
| `routes/queue.js` | Gestión de la cola FIFO diaria |
| `routes/manifests.js` | Creación, cierre y gestión de manifiestos y pasajeros |
| `routes/trips.js` | Inicio, fin y consulta de viajes |
| `routes/reports.js` | Endpoints de KPIs, ranking de conductores e historial de alertas |
| `routes/assistant.js` | Integración con la API de Anthropic Claude para el asistente IA |
| `routes/gps.js` | Posiciones GPS en tiempo real de los vehículos |
| `routes/gps-devices.js` | Registro y asignación de dispositivos Teltonika FMC130 |
| `routes/communications.js` | Comunicaciones y notificaciones del sistema |
| `middleware/auth.js` | Verificación de token JWT y control de acceso por rol (admin / conductor) |
| `config/db.js` | Pool de conexiones a PostgreSQL con `pg` |
| `gps-server.js` | Servidor TCP en puerto 2223: recibe tramas Codec 8 del GPS Teltonika FMC130 |
| `.env` | Variables de entorno: credenciales de BD, JWT secret, API key de Anthropic |

---

## Base de Datos — `database/`

| Archivo | Descripción |
|---------|-------------|
| `schema.sql` | Definición completa del esquema: 15 tablas, índices y extensión `uuid-ossp` |
| `seed.sql` | Datos iniciales: asociación ATIPCAR, 5 empresas, 5 vehículos, 5 conductores y rutas Juli-Puno |
| `gps_devices.sql` | Script de registro de dispositivos GPS Teltonika asignados a la flota |

---

## Documentación — `Docs/`

| Archivo | Descripción |
|---------|-------------|
| `diagrama-bd.html` | Diagrama visual interactivo de las 15 tablas de la base de datos con relaciones PK/FK |
| `estructura-proyecto.html` | Figuras académicas del proyecto: estructura frontend, backend y despliegue |
| `ARQUITECTURA_CAPAS.html` | Diagrama de arquitectura por capas del sistema |
| `ARQUITECTURA_LOGICA_FISICA.html` | Vista lógica y física del despliegue |
| `ESQUEMA_PROBLEMA_SOLUCION.html` | Esquema del problema identificado y la solución propuesta |
| `SISTEMA_TOTAL.txt` | Resumen textual del sistema completo |
