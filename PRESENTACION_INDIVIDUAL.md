# Presentación Individual - OverDrive
## Reto de Ingeniería de Software — 15 minutos exactos

> **Guion diapositiva por diapositiva.** Cada slide indica: tiempo recomendado,
> contenido mínimo para leer en voz alta, captura a mostrar y/o acción de demo.
> Las secciones marcadas 🖥️ se muestran **en vivo** (navegador/terminal), el
> resto usa capturas de `Docs/capturas/`.

---

## 0. Requisitos del reto (entregables obligatorios)

| Requisito | Cómo cumplirlo |
|---|---|
| Subir/entregar presentación **al menos 1 día antes** | Subir el PDF o PPTX a la plataforma del curso con 24h+ de antelación |
| Video **o** presentación | Ya decidido: **presentación en vivo** (tu elección) |
| Sin internet → traer en USB | Copiar en un USB: PDF de diapositivas + carpeta `Docs/capturas/` + video de respaldo si lo grabas |

**Prepara el USB con:** `PRESENTACION_INDIVIDUAL.pdf`, las 11 capturas y un
enlace corto a la app desplegada.

---

## 1. Distribución del tiempo (15 min según rúbrica)

| Bloque | Sección | Min | Prioridad |
|---|---|---|---|
| 0 | Presentación del sistema | 2 | objetivo y pantalla representativa |
| 1 | Módulo desarrollado y seguridad | 3 | demo en vivo + JWT/roles + tests |
| 2 | Pipeline CI/CD | 3 | GitHub Actions verde + deploy |
| 3 | Pruebas de seguridad y calidad | 3 | ZAP + SonarCloud |
| 4 | Cierre y lecciones aprendidas | 2 | planificado vs ejecutado |
| 5 | Mejora continua e innovación | 2 | plan medible + IA |
| | **Total** | **15** | |

> Criterio 3 de la rúbrica: **no atropellar las secciones finales**. Guarda 2 min
> de colchón: si vas tarde en el bloque 1-2, recorta la demo (no el cierre).

---

## 2. Guion por diapositiva

### BLOQUE 0 — Presentación del sistema (2 min)

#### Slide 0.1 · Portada (20 seg)
- Título: **OverDrive — La doble vida de las canciones**.
- Subtítulo: *Proyecto final · Ingeniería de Software*.
- Tu nombre, materia, fecha.
- Decir: *"Voy a mostrar una plataforma de intercambio entre artistas y curadores de playlists."*

#### Slide 0.2 · ¿Qué es OverDrive y cuál es su objetivo? (1 min)
Contenido en pantalla (máx 3 bullets):
- Artistas envían canciones; curadores las aceptan y las agregan a Spotify.
- Tokens como moneda del intercambio (justo y auditable).
- Registro + autenticación JWT con roles **admin/artista/curador**.

**Objetivo SMART** (dilo en voz alta):
> "Lanzar una plataforma web que permita a artistas independientes enviar sus
> canciones a curadores de playlists de Spotify y a curadores aceptar o rechazar
> propuestas, con un sistema de tokens, control de roles JWT y un pipeline de
> calidad y seguridad automatizado — desplegada y funcional en producción."

**Justificación técnica**: Node.js + Express (API REST), React + Vite (SPA),
MariaDB, Docker, GitHub Actions, Railway, OWASP ZAP, SonarCloud.

#### Slide 0.3 · Pantalla más representativa (40 seg)
- Mostrar **Captura 1** (login) ✅.
- Decir: *"Esta es la puerta de entrada: cada rol entra por aquí con su token JWT."*
- Opcional en vivo: abrir `https://overdrive-production-1392.up.railway.app`.

> 📷 **Captura 1** — `Docs/capturas/01-login.png`

---

### BLOQUE 1 — Módulo desarrollado y seguridad (3 min)

#### Slide 1.1 · Demo funcional del módulo (90 seg) 🖥️
- **En vivo** (navegador): login como `admin@overdrive.app` / `8H8LrSK8qUhvuY7i6Ghs`.
- Crear un segundo usuario por el registro con validación de contraseña.
- Mostrar cómo cambia el rol y qué ve cada uno.
- Respaldos en pantalla:
  - **Captura 2** (registro con validación) ✅
  - **Captura 3** (login admin llenado) ✅
  - **Captura 5** (panel admin → tabla de usuarios, roles y tokens) ✅

> 📷 Capturas 2, 3 y 5 — `02-registro.png`, `03-login-llenado.png`, `05-dashboard-admin.png`

#### Slide 1.2 · Autenticación JWT y manejo de roles (60 seg)
- Bullets: token JWT (1h), secret en `.env`, **Bearer** validado por middleware `auth.js`.
- Roles: **Admin** (`/api/admin/*`), **Usuario** (playlists/submissions).
- Seguridad extra: Helmet (CSP, X-Frame, HSTS), CORS solo orígenes permitidos,
  rate limiting (100/15min, 10/15min login), `Cache-Control: no-store`.
- Decir la frase técnica: *"El backend no conocía quién eras; el token lo certifica."*

#### Slide 1.3 · Pruebas unitarias con cobertura ≥ 80% (30 seg)
- **Captura 4** = terminal con `npm test` (94 passing) ✅.
- Cobertura real (dilo, está verificada en el repo):
  - Statements **85%** · Branches **71.6%** · Functions **95.5%** · Lines **85.5%**.
- Framework: **Jest + Supertest**; casos: registro, login admin, roles, JWT inválido.
- (Opcional) correr `cd backend && npm test` en vivo.

> 📷 **Captura 4** — `Docs/capturas/04-npm-test.png`

---

### BLOQUE 2 — Pipeline CI/CD (3 min)

#### Slide 2.1 · Pipeline en GitHub Actions (60 seg)
- **Captura 10** = Actions con el run de `main` **en verde** (manual, requiere tu login).
- Explicar el archivo `.github/workflows/ci.yml` (6 jobs):
  1. `backend-tests` (Jest + cobertura)
  2. `frontend-build` (Vite build)
  3. `security-scan` (npm audit)
  4. `sonarqube` (análisis de calidad)
  5. `deploy` (smoke test health + login JWT)
  6. `zap-scan` (OWASP ZAP)

> 📷 **Captura 10** — `Docs/capturas/10-github-actions.png` (⏳ **falta capturarla**,
> ver sección 4).

#### Slide 2.2 · Etapas de automatización (60 seg)
- Mostrar **Captura 10** ampliada o la pantalla de **checks 7/7 verde** del commit.
- Leer el flujo:
  1. `git push origin main`
  2. → tests 94/94 ✅ → build ✅ → audit ✅ → ZAP ✅
  3. → smoke test con MySQL real y login JWT ✅
- Mención técnica: «reintentos de `npm ci` con `--ignore-scripts`», «artifacts de
  cobertura y ZAP guardados 7 días».

#### Slide 2.3 · Despliegue automático en producción (60 seg)
- **Captura 7** = health check `{"status":"ok"}` ✅.
- Explicar: Railway recebe el push, compila el `Dockerfile` multi-stage raíz
  (frontend+backend en **1 solo servicio**, sin CORS), BD = MariaDB plugin.
- `npm start` corre `db-init.js` (schema + 5 migraciones + admin) antes del server.
- **En vivo**: abrir la URL y mostrar `/api/health`.

> 📷 **Captura 7** — `Docs/capturas/08-health-check.png`
> URL: `https://overdrive-production-1392.up.railway.app`

---

### BLOQUE 3 — Pruebas de seguridad y calidad de código (3 min)

#### Slide 3.1 · Escaneo OWASP ZAP (60 seg)
- **Captura 8** = reporte HTML de ZAP **0 FAIL** ✅.
- Explicar qué es ZAP: escáner de seguridad del OWASP; corre en contenedor
  `zaproxy:stable` sobre `http://localhost:4000/api/health` con baseline.
- Reportes publicados como artifact en GitHub Actions.

> 📷 **Captura 8** — `Docs/capturas/09-zap-report.png`

#### Slide 3.2 · Vulnerabilidades identificadas y corregidas (60 seg)
Tabla (léela resumida — es el criterio 2 de la rúbrica):

| Vulnerabilidad | Mitigación |
|---|---|
| **XSS** | Helmet + `Content-Security-Policy` |
| **SQL Injection** | `express-validator` + consultas parametrizadas |
| Headers | `helmet()` en `server.js` |
| Fuerza bruta en login | `express-rate-limit` 10/15 min |
| Cache de datos sensibles | `Cache-Control: no-store` |

- **Valor agregado real (menciona esto):** el analysis de SonarCloud detectó
  24 vulnerabilidades globales (hash bcrypt hardcodeado en `schema.sql`,
  open redirect en `Dashboard.jsx`, log injection en `spotifyController.js`,
  permisos de ZAP en CI) y **se corrigieron todas** en los commits recientes:
  hash movido a variables de entorno, validación del `authUrl` de Spotify antes
  del redirect, sanitizado de logs, `chmod 777`→`chown+755`, etc.

#### Slide 3.3 · Métricas en SonarCloud (60 seg)
- **Captura 9** = dashboard de **SonarCloud** con Quality Gate y ratings (manual).
- Datos reales a decir:
  - Quality Gate **passed/OK** en la rama `main`.
  - Ratings **A en Reliability / Security / Maintainability** (New Code).
  - **0 bugs · 0 vulnerabilidades nuevas** en el análisis más reciente.
  - Cobertura **85%** integrada vía `backend/coverage/lcov.info`.

> 📷 **Captura 9** — `Docs/capturas/11-sonarqube.png` (⏳ **falta capturarla**,
> ver sección 4. IMPORTANTE: el proyecto es **SonarCloud**, key
> `Hugoatpxndx_OverDrive`, **no** localhost:9000).

---

### BLOQUE 4 — Cierre del proyecto y lecciones aprendidas (2 min)

#### Slide 4.1 · Planificado vs ejecutado (60 seg)
Tabla resumen (no leas todas las filas, elige 3-4):

| Aspecto | Planificado | Ejecutado |
|---|---|---|
| Tiempo | 1 semana | ~4 días (adelantado) |
| Cobertura | ≥ 80% | **85%** (94/94 tests) |
| JWT/roles | Sí | ✅ completo |
| Ci/CD | GitHub Actions | ✅ 6 jobs verdes |
| Despliegue | entorno público | ✅ Railway (1 servicio) |
| Seguridad | ZAP + Sonar | ✅ + 24 vulns corregidas |

Frase de cierre: *"Planear nos dio el mapa; los tests nos dieron la red."*

#### Slide 4.2 · Lecciones aprendidas (60 seg)
- Configuración (`JWT_SECRET`, `CORS`, Spotify) desde el **primer commit** evita
  fallos en redeploy — mantener `.env.example` versionado.
- Idempotencia: `db-init.js` funciona igual en tests que en producción.
- Los planes free tienen límites (Railway plugins, Spotify dev mode ≤25 usuarios,
  2,000 min/mes de Actions) — leerlos antes de elegir arquitectura.
- **Nueva lección del proceso**: SonarCloud analiza **todo el repo**, no solo
  `src`; hay que cuidar `.github/`, `*.sql` y `Docs/`, no nada más el código.

---

### BLOQUE 5 — Mejora continua e innovación (2 min)

#### Slide 5.1 · Plan de mejora medible (60 seg)
| Área | Propuesta | Métrica | Plazo |
|---|---|---|---|
| Calidad | SonarCloud como gate en cada PR | 0 code smells nuevos/PR | próximo sprint |
| Tests | + 10 tests E2E | 94 → 104, cobertura ≥ 85% | 2 semanas |
| Seguridad | CSP más estricto en producción | Score A de CSP | 1 mes |
| Performance | Middleware `compression` | −20% TTFB | trimestre |
| Despliegue | Auto-deploy por PR en Railway | deploy automático | 1 mes |

#### Slide 5.2 · Innovación: predicción con IA (45 seg)
- Objetivo: predecir si un artista completará su envío (engagement).
- Modelo: Random Forest sobre histórico de `submissions` (frecuencia, tokens,
  estacionalidad). Python/scikit-learn por **REST** desde el backend Node.
- Roadmap: 2 semanas exportar datos → 2 semanas entrenar → API `/api/prediction`
  → A/B test con 100 usuarios.
- Beneficio esperado: **+15–20% de conversión** de envíos.

#### Slide 5.3 · Cierre (15 seg)
- ✅ módulo, ✅ 94 tests/85%, ✅ 6 jobs verdes, ✅ ZAP, ✅ SonarCloud A,
  ✅ producción viva, ✅ plan de mejora e IA.
- *"Gracias — ¿preguntas?"*

---

## 3. Índice de capturas por diapositiva

| Slide | Captura | Archivo | Estado |
|---|---|---|---|
| 0.3 | 1 · Login | `01-login.png` | ✅ subida |
| 1.1 | 2 · Registro | `02-registro.png` | ✅ subida |
| 1.1 | 3 · Login llenado | `03-login-llenado.png` | ✅ subida |
| 1.3 | 4 · `npm test` | `04-npm-test.png` | ✅ subida |
| 1.1 | 5 · Panel admin | `05-dashboard-admin.png` | ✅ subida |
| 2.1/2.2 | 10 · GitHub Actions | `10-github-actions.png` | ⏳ capturar |
| 2.3 | 7 · Health check | `08-health-check.png` | ✅ subida |
| 3.1 | 8 · Reporte ZAP | `09-zap-report.png` | ✅ subida |
| 3.3 | 9 · SonarCloud | `11-sonarqube.png` | ⏳ capturar |

(Extra disponibles si quieres usarlas: `06-dashboard-artista.png`,
`07-conectar-spotify.png`.)

## 4. Cómo tomar las capturas faltantes (10 y 11)

1. **10-github-actions.png**: GitHub → repo → **Actions** → run más reciente de
   `main` → capturar el árbol de 7 checks **en verde**.
2. **11-sonarqube.png**: abrir
   `https://sonarcloud.io/dashboard?id=Hugoatpxndx_OverDrive&branch=main`
   → capturar la tarjeta **Quality Gate: Passed/OK** y los ratings
   **A Reliability / A Security / A Maintainability** + cobertura.
   *(No es localhost:9000; es SonarCloud.)*

## 5. Checklist de ensayo (2 vueltas antes del día)

- [ ] Cronometrar los 6 bloques (2+3+3+3+2+2 = 15 min).
- [ ] Prueba el login en vivo con internet **y** con respaldo en el USB.
- [ ] Confirmar que los badges/checks de GitHub están verdes ese mismo día.
- [ ] SonarCloud en A (si el rescan no alcanzó, mostrar el Quality Gate OK).
- [ ] Tener la URL de producción copy-pasteada para abrirla rápido.

---
*Proyecto OverDrive - Ingeniería de Software - Presentación Individual*
*Duración: 15 minutos exactos - Demo funcional incluida*