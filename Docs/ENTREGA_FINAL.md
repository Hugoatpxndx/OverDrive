# OverDrive · Reporte de Entrega Final

> Documento consolidado que integra la documentación del proyecto
> (`Docs/informe-cierre.md`, `Docs/informe-metricas.md`,
> `Docs/guia-despliegue.md`, `Docs/credenciales-prueba.md` y
> `PRESENTACION_INDIVIDUAL.md`) siguiendo los 5 criterios de la rúbrica.
> PDF generable desde este markdown (p. ej. `pandoc ENTREGA_FINAL.md -o ENTREGA_FINAL.pdf`).

---

# Criterio 1 · Implementación del módulo y su seguridad (20 pts)

## 1.1 Qué es OverDrive

**OverDrive** es una plataforma web que conecta a **artistas** con **curadores**
de playlists mediante un sistema de **tokens**:

- El artista gasta **1 token** para enviar su canción a una playlist de un curador.
- Si el curador la **rechaza**, el token vuelve al artista (reembolso).
- Si la **acepta**, el token pasa al curador como pago por publicarla, y la
  canción se agrega de forma **real** a la playlist de Spotify del curador.

La base del reto (módulo de registro de donantes con autenticación) se
materializa como un **módulo de registro y autenticación de usuarios/artistas**
con **JWT y control de roles** (usuario vs. administrador).

## 1.2 Arquitectura

```
React (Vite) ──HTTP──▶ Express (Node 22) ──prepared statements──▶ MariaDB
      :5173/dev               :4000                          (railway plugin / :3307)
                              └──OAuth 2.0──▶ Spotify Web API
```

- **Frontend**: React + Vite, SPA con modo claro/oscuro, reproductor embebido de
  Spotify, paneles por modo (artista, curador, administrador).
- **Backend**: Express, `mysql2` con *prepared statements*, `bcryptjs`,
  `jsonwebtoken`, `helmet`, `express-rate-limit`, `express-validator`.
- **BD**: MariaDB (schema + 5 migraciones, inicializadas automáticamente por
  `db-init.js`, idempotente).

## 1.3 Módulo de autenticación y roles (JWT)

| Aspecto | Implementación |
|---|---|
| Registro | `POST /api/auth/register` — bcrypt, validación fuerte de contraseña |
| Login | `POST /api/auth/login` — compara hash, genera JWT |
| Expiración | `JWT_EXPIRES_IN=1h` |
| Roles | `usuario` / `administrador`, validados por middleware `requireAuth` + `isAdmin` |
| Verificación de email | Código de 6 dígitos (simulado, sin SMTP); gate para poder enviar |
| Token | En `Authorization: Bearer <jwt>`; guardado en `localStorage` |

**Middlewares de seguridad** (`backend/server.js`):
- `helmet()` (X-Content-Type-Options, X-Frame-Options, HSTS, CSP).
- CORS restringido a orígenes permitidos.
- `express-rate-limit`: 100 req/15 min global, 10 req/15 min en login/registro.
- Body parser limitado a `10kb` (mitiga DoS).
- `Cache-Control: no-store` en todas las respuestas de la API.
- Errores genéricos en producción (sin *stack traces*).

**Medidas OWASP aplicadas**: inyección SQL (prepared statements A03), XSS
(helmet + sanitización A07), fuerza bruta (rate-limit A07), contraseñas expuestas
(bcrypt A02), información filtrada en errores y payloads gigantes (A05).

## 1.4 Evidencia de pruebas unitarias (cobertura ≥ 80 %)

Ejecutado con: `cd backend && npm test` (Jest + Supertest).

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Suites | 5 | — | ✅ |
| Tests | **94 / 94** | — | ✅ |
| Statements | **85 %** | 80 % | ✅ |
| Lines | **85.44 %** | 80 % | ✅ |
| Functions | **95.45 %** | 80 % | ✅ |
| Branches | **71.58 %** | 65 % | ✅ |

> Los umbrales están en `backend/jest.config.js` y **hacen fallar la build**
> si no se cumplen. Cobertura medida sobre `controllers/` y `middlewares/`
> (lógica de negocio).

**Cobertura funcional del módulo** (test suite):
- Registro de nuevo usuario, login de administrador.
- Control de roles (middleware `isAdmin`, 401 sin permiso).
- Rate limiting en endpoints de auth (429).
- Validación de JWT (inválido, ausente, sin prefijo Bearer).
- Envío/aceptación/rechazo de propuestas, tokens atómicos y reglas
  anti-fraude (duplicado 409 con reembolso).
- Verificación de email y validación de tracks contra Spotify (mockeada).

---

# Criterio 2 · Implementación de pipeline de CI/CD (25 pts)

## 2.1 Configuración

- **Archivo**: `.github/workflows/ci.yml`
- **Disparadores**: push a `main`/`develop`, PR a `main`.
- **6 jobs**:

| # | Job | Función | Condición |
|---|---|---|---|
| 1 | `backend-tests` | Jest con cobertura ≥ 80 %, verifica sintaxis, publica `coverage-report` | Siempre |
| 2 | `frontend-build` | Compila el frontend con Vite | Siempre |
| 3 | `security-scan` | `npm audit --audit-level=high` en backend y frontend | Siempre |
| 4 | `sonarqube` | Análisis de calidad (Quality Gate) | Siempre |
| 5 | `deploy` | Levanta stack + smoke test (health + login admin) | Push a `main` |
| 6 | `zap-scan` | OWASP ZAP baseline + artifact `zap-report` | Siempre |

- **Buenas prácticas**: `cache` de npm, `secrets` para credenciales (no hay
  secretos en el repo, solo `.env.example`), reintentos en `npm ci`,
  artefactos retenidos 7 días (`coverage-report`, `zap-report`).

## 2.2 Flujo automático

```
git push origin main
  ├─ 1. backend-tests   → 94/94 tests, cobertura 85% ✅
  ├─ 2. frontend-build  → dist/ generado ✅
  ├─ 3. security-scan   → npm audit sin high/critical ✅
  ├─ 4. sonarqube       → Quality Gate OK ✅
  ├─ 5. deploy          → smoke test (health + login JWT) ✅
  └─ 6. zap-scan        → 0 FAIL ✅
```

## 2.3 Despliegue continuo (entorno de producción)

- **Plataforma**: Railway (plan free), un **solo Web Service**.
- **Build**: `Dockerfile` multi-stage en la raíz que compila backend + frontend
  y sirve el frontend desde el backend (mismo dominio → sin CORS cruzado).
- **BD**: plugin MariaDB de Railway (variables `MARIADB_*` compartidas).
- **Inicialización**: el `start` corre `node scripts/db-init.js && node server.js`
  (schema + migraciones + admin, idempotente).
- **Deploy**: cada push a `main` dispara rebuild + redeploy automático.
- **Salud**: `GET /api/health` → `{"status":"ok"}`.

| Recurso | URL |
|---|---|
| Aplicación (frontend + API) | `https://overdrive-production-1392.up.railway.app` |
| Health check | `https://overdrive-production-1392.up.railway.app/api/health` |

**Variables de entorno en producción**: `MARIADB_USER/PASSWORD/DATABASE`
(shared), `DB_HOST=overdrive-db.railway.internal`, `DB_PORT=3306`, `PORT=4000`,
`JWT_SECRET`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
`SPOTIFY_REDIRECT_URI=https://overdrive-production-1392.up.railway.app/api/spotify/callback`,
`CORS_ORIGIN=https://overdrive-production-1392.up.railway.app`.

> Nota Spotify: la app está en *development mode* → solo las cuentas agregadas
> en **Users and access** de Spotify for Developers pueden conectar OAuth
> (hasta 25 gratuitas).

---

# Criterio 3 · Pruebas de seguridad y análisis de calidad de código (25 pts)

## 3.1 OWASP ZAP (seguridad web)

- **Comando**: `zap-baseline.py` sobre `http://localhost:4000/api/health`,
  contenedor `ghcr.io/zaproxy/zaproxy:stable`, ejecutado en el job `zap-scan`.
- **Reportes**: `zap-report.html` y `zap-report.json` (artifact).

| Resultado | Cantidad |
|---|---|
| FAIL (riesgo alto) | **0** |
| WARN | 1 |
| PASS | 66 |

**Vulnerabilidad detectada y corregida**:
- *Storable and Cacheable Content* (10049) → se añadió
  `Cache-Control: no-store` a todas las respuestas de la API.

**Controles verificado por ZAP**: `helmet` (X-Content-Type-Options,
X-Frame-Options, HSTS, CSP), CORS por origen, rate-limit, body ≤ 10 kb,
errores sin stack traces.

## 3.2 SonarQube (calidad de código)

Dashboard: `http://localhost:9000/dashboard?id=overdrive` ·
Reproducible: `./scripts/analisis-calidad.sh`

| Métrica | Resultado |
|---|---|
| **Quality Gate** | **OK (aprobado)** |
| Bugs | 0 |
| Vulnerabilidades | **0** |
| Security Hotspots | 0 |
| Code Smells | 43 |
| Duplicación | 1.9 % |
| Cobertura (global) | 58.6 %* |
| **Reliability / Security / Maintainability Rating** | **A / A / A** |

> \* SonarQube mide cobertura global del repositorio; la cobertura de la
> **lógica de negocio** (controllers/middlewares) es **≥ 80 %**, validada por
> Jest. El frontend no tiene pruebas unitarias y se excluye del cálculo.

**Vulnerabilidades detectadas y corregidas en el Dockerfile**:

| Regla | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| `docker:S6471` | Minor | contenedor corre como `root` | `USER node` |
| `docker:S6470` | **Critical** | `COPY . .` podía copiar datos sensibles | copia selectiva del código |

**Impacto**: *Security Rating* subió de **E (4.0) a A (1.0)**, vulnerabilidades
de **2 → 0**.

## 3.3 Pruebas automatizadas (evidencia de calidad)

- **94/94 tests** pasando, cobertura statements **85 %** (umbral 80 %).
- Lógica de negocio (controladores y middlewares) cubierta ≥ 80 %.
- `npm audit --audit-level=high` sin hallazgos críticos en dependencias.

---

# Criterio 4 · Cierre del proyecto y análisis (15 pts)

## 4.1 Objetivo SMART

> Desarrollar y desplegar **OverDrive** —plataforma que conecta artistas con
> curadores mediante tokens, con **autenticación JWT y control de roles**,
> **OAuth 2.0 con Spotify** e intercambio de propuestas— alcanzando una
> **cobertura de pruebas ≥ 80 %** y un **pipeline CI/CD** automatizado
> (pruebas, construcción y despliegue) en GitHub Actions + Railway, dentro del
> plazo del reto.

- **S**pecífico: plataforma de curaduría musical con tokens.
- **M**edible: cobertura ≥ 80 %, 94 tests, pipeline en verde.
- **A**lcanzable: stack conocido (React + Express + MariaDB).
- **R**elevante: resuelve la falta de visibilidad de artistas nuevos.
- **T**emporal: entregado en el cronograma del reto.

## 4.2 Comparación planificado vs. ejecutado

| # | Entregable planificado | Resultado ejecutado | Estado |
|---|---|---|---|
| 1 | Registro de usuarios + login | Registro/login con bcrypt y validación fuerte | ✅ |
| 2 | JWT + roles (admin/usuario) | JWT firmado + middleware `requireAuth`/`isAdmin` | ✅ |
| 3 | CRUD de playlists | Crear manual + **importar de Spotify** | ✅ |
| 4 | Propuestas con tokens | Envío (‒1), aceptación (+1 curador), rechazo (reembolso), descuento atómico, anti-fraude (409) | ✅ |
| 5 | Pruebas ≥ 80 % | **94 tests**, 85 % statements | ✅ |
| 6 | Pipeline CI/CD | 6 jobs (tests, build, audit, Sonar, deploy, ZAP) | ✅ |
| 7 | Integración Spotify (OAuth) | Conexión, import, **sync real al aceptar**, reproductor embebido | ✅ |
| 8 | Verificación de email / login social | **Código 6 dígitos** implementado; login social descartado (alcance) | ✅/⚠️ |
| 9 | Validación de track contra Spotify | 100 % de envíos validados con *Client Credentials Flow* | ✅ |

**Línea de tiempo (días efectivos)**: 11 planificados vs **16.5 reales** (+5.5).
Causas de desviación:
1. Spotify **prohíbe `localhost`** (exige HTTPS/`127.0.0.1`) → ~1 día.
2. Pool de conexiones MaríaDB colgado → endurecido con *keep-alive* → ~0.5 día.
3. Node 26 rompía `mysql2`/`iconv-lite` → **Node 22 LTS** → ~0.5 día.
4. Pipeline: etapas de seguridad/Sonar/deploy no previstas → ~2 días.
5. Docker y orquestación de credenciales → ~1 día.

## 4.3 Lecciones aprendidas

- Documentar la **configuración externa** (Redirect URI de Spotify) evita retrabajo.
- Fijar **versiones LTS** de Node es clave.
- Configurar **pools de BD** con keep-alive/idleTimeout previene bloqueos.
- **Docker desde el inicio** elimina el «funciona en mi máquina».
- **SonarQube rinde fruto**: encontró 2 vulnerabilidades en el Dockerfile
  (rating de seguridad **E → A**).
- **Validar contra la API real** (Client Credentials) cierra huecos de calidad.
- **Acotar el alcance** priorizando calidad/seguridad/despliegue.

---

# Criterio 5 · Plan de mejora continua (15 pts)

## 5.1 Acciones medibles

| Acción | Objetivo medible | Plazo | Estado |
|---|---|---|---|
| ✔ Validar tracks vía **Spotify Web API** (Client Credentials) | 100 % de envíos validados | Sprint 3 | **Implementado** |
| ✔ Verificación de email | Código de 6 dígitos en registro | Sprint 3 | **Implementado** |
| Cobertura **global ≥ 80 %** en SonarQube | Cobertura Sonar ≥ 80 % | Sprint 3 | Pendiente |
| Pruebas de integración de flujos OAuth | ≥ 5 tests E2E de Spotify | Sprint 3 | Pendiente |
| Deploy automático + *smoke tests* en **Railway** | URL verde en cada push a `main` | Sprint 4 | ✅ **Activado** |
| Cola de eventos (RabbitMQ) para notificaciones | 0 notificaciones perdidas; latencia < 2 s | Sprint 4 | Pendiente |
| Redis para caché de seguidores y rate limiting | P95 API < 200 ms | Sprint 5 | Pendiente |
| OWASP ZAP *full scan* en el pipeline | 0 alertas altas/medias | Sprint 5 | Pendiente |

**KPIs**: cobertura ≥ 80 % · vulnerabilidades Sonar/ZAP = 0 altas/medias ·
tiempo de pipeline < 10 min · reducir los 43 code smells (prioridad `MAJOR`).

## 5.2 Innovación tecnológica

1. **IA para emparejar canciones y curadores** por similitud de audio/género y
   predicción de aceptación.
2. **Puntuación de curadores** por aceptación y tiempo de respuesta.
3. **Predicción de demanda** de playlists y mejores horarios de envío.
4. **Microservicios sobre Kubernetes** (Auth, Submissions, UI) + BD gestionada.
5. **Analítica de conversión** (envíos → aceptaciones) con dashboards.
6. **Auditoría formal** de acciones (quién propuso/aceptó qué y cuándo).

## 5.3 Cierre de la presentación (resumen ejecutivo)

- ✅ Módulo completo: registro + autenticación JWT con roles admin/user.
- ✅ Calidad: **94/94 tests**, cobertura **85 %** (≥ 80 % requerido).
- ✅ Seguridad: **OWASP ZAP 0 fallos**; **SonarQube Quality Gate OK**, ratings **A/A/A**.
- ✅ CI/CD: pipeline automatizado GitHub Actions (**6 jobs**) + **deploy Railway**.
- ✅ Despliegue: producción viva en
  `https://overdrive-production-1392.up.railway.app`.
- ✅ Documentación: README, presente reporte, guías y credenciales de prueba.
- 🚀 Innovación: IA de emparejamiento, puntuación de curadores, microservicios.

---

## Anexo A · Credenciales de prueba (entorno de producción)

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin@overdrive.app` | `8H8LrSK8qUhvuY7i6Ghs` |

Cuentas Spotify de prueba (deben estar en **Users and access** del dashboard
de Spotify for Developers para conectar OAuth):

| Cuenta | Email | Contraseña Spotify |
|---|---|---|
| Cuenta 1 | `overdrivespotify@gmail.com` | `Admin1234#` |
| Cuenta 2 | `overdrivespotify2@yahoo.com` | `Admin1234#` |

> Nota: usar dos cuentas distintas evita el auto-envío (regla anti-fraude).

## Anexo B · Cómo reproducir las métricas

```bash
# 1) Pruebas + cobertura
cd backend && npm test

# 2) Análisis de calidad (levanta SonarQube, corre tests y escanea)
./scripts/analisis-calidad.sh

# 3) ZAP manual (con el backend corriendo en :4000)
docker run --rm --network host -v "$PWD/zap-reports:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:4000/api/health -r zap-report.html -I

# 4) Levantar todo el stack local
docker compose up -d --build
```

## Anexo C · Repositorio

- Repositorio Git con código, pipeline CI/CD y esta documentación.
- Workflow: `.github/workflows/ci.yml`.
- Dockerfile multi-stage en la raíz; `compose.yaml` para uso local.

---

*Proyecto OverDrive · Reto de Ingeniería de Software · Entrega Final*