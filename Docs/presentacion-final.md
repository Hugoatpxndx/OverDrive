# OverDrive · Guía para la Presentación Final (15 min)

> Presentación **individual**. Objetivo: demostrar calidad técnica, seguridad,
> despliegue y análisis del proyecto. **Ensaya el tiempo** (cronometrado).

---

## Objetivo SMART del proyecto (dilo en el minuto 0)

> «Desarrollar y desplegar **OverDrive**, una plataforma web que conecta
> artistas con curadores musicales mediante un sistema de *tokens*, con
> **autenticación JWT y control de roles**, integración **OAuth 2.0 con
> Spotify** e intercambio de propuestas, alcanzando una **cobertura de pruebas
> ≥ 80 %** y un **pipeline CI/CD** automatizado en GitHub Actions, en un plazo
> de **N semanas**.»

Desglose SMART (por si preguntan):
- **S**pecífico: plataforma de curaduría con tokens y Spotify.
- **M**edible: cobertura ≥ 80 %, 87 tests, pipeline en verde.
- **A**lcanzable: stack conocido (React + Express + MaríaDB).
- **R**elevante: resuelve la dificultad de visibilidad de artistas nuevos.
- **T**emporal: entregado dentro del cronograma del reto.

---

## Guion minuto a minuto

### 0:00 – 3:00 · Objetivo + Módulo (JWT, roles, pruebas)

**Qué decir**
- Problema y propuesta de valor en 1 frase: artistas nuevos no consiguen
  visibilidad; OverDrive los conecta con curadores de playlists mediante tokens.
- Arquitectura en 20 s: React (5173) → API Express (4000) → MaríaDB, + Spotify API.
- **Autenticación JWT**: registro/login con `bcrypt` + `jsonwebtoken`; el token
  se firma con `JWT_SECRET` y viaja en `Authorization: Bearer`.
- **Roles**: `usuario` vs `administrador`, validados por middleware
  (`authenticate` + `authorize('administrador')`).

**Demo en vivo (que funcione, no captures)**
1. Registrar un usuario nuevo (muestra validación de contraseña).
2. Iniciar sesión → abrir DevTools → *Application → Local Storage* → mostrar el JWT.
3. Mostrar que `/dashboard` es ruta protegida (entrar sin token redirige a `/login`).
4. Mostrar el código del middleware de roles.

**Evidencia de pruebas**
- Ejecutar `cd backend && npm test` en vivo → resaltar **87 tests / 5 suites**.
- Señalar la tabla de cobertura: statements **84.6 %**, líneas **85.1 %**,
  funciones **95.3 %** (superan el mínimo de 80 %).

---

### 3:00 – 6:00 · Pipeline CI/CD (GitHub Actions)

**Qué decir**
- Un *push* a `main` dispara el workflow `.github/workflows/ci.yml` con **6 jobs**.
- Jobs: `backend-tests` (Jest + cobertura + artifact), `frontend-build`,
  `security-scan` (`npm audit`), `sonarqube` (análisis de calidad), `deploy`
  (Docker Compose + smoke test) y `zap-scan` (OWASP ZAP baseline).
- Uso de `cache: npm` para acelerar y `secrets` para credenciales (no hay
  secretos en el repo: solo `.env.example`).

**Demo/evidencia**
- Abrir la pestaña **Actions** del repo y mostrar las ejecuciones en verde.
- Entrar a un run y mostrar cada job + el artifact `coverage-report`.
- Mostrar el YAML resaltando `node-version`, `working-directory` y `env`.

---

### 6:00 – 9:00 · Seguridad (OWASP ZAP) y Calidad (SonarQube)

**Qué decir — defensas implementadas (OWASP Top 10)**
- A01 control de acceso: rutas protegidas y roles.
- A02 criptografía: bcrypt + JWT firmado; tokens de Spotify en BD.
- A03 inyección: *prepared statements* (mysql2) + `express-validator`.
- A05 mala config: `helmet`, `cors`, `rate-limit`, `.env` fuera del repo.
- A07 fallos de identificación: validación fuerte de contraseña.

**Evidencia OWASP ZAP** (reporte: `docs/zap-report.html`)
- Escaneo *baseline* sobre la API (`http://localhost:4000/api/health`).
- Resultado: **0 fallos (FAIL), 66 comprobaciones PASS**, 1 advertencia menor.
- La advertencia «Storable and Cacheable Content» se mitigó añadiendo
  `Cache-Control: no-store` a todas las respuestas de la API.

**Evidencia de calidad de código** — SonarCloud, proyecto
[`Hugoatpxndx_OverDrive`](https://sonarcloud.io/dashboard?id=Hugoatpxndx_OverDrive&branch=main)
(analizado por el job `sonarqube` del CI en cada push a `main`):

| Métrica | Resultado |
|---|---|
| **Quality Gate** | **OK (aprobado)** |
| Bugs | 0 |
| Vulnerabilidades | **0** (se corrigen a lo largo del proyecto) |
| Code smells | 43 |
| Duplicación | 1.9 % |
| Cobertura (global) | 58.6 %* |
| Reliability / Security / Maintainability | **A / A / A** |

> *SonarCloud mide cobertura global del repositorio. La cobertura de la **lógica
> de negocio** (controladores y middlewares) es **≥ 80 %**, validada por Jest.
>
> **Hallazgos corregidos:** el escáner detectó vulnerabilidades y problemas de
> seguridad a lo largo del proyecto que se corrigieron: `docker:S6471`
> (contenedor corriendo como *root*) y `docker:S6470` (copiar datos sensibles)
> en el `Dockerfile`; hash bcrypt del admin hardcodeado en `schema.sql`
> (`secrets:S8215`), open redirect en `Dashboard.jsx` (`javascript:S6105`),
> log injection en `spotifyController.js` (`javascript:S5145`), `chmod 777` en
> CI (`githubactions:S2612`), entre otras → *security rating* pasó de
> **E (4.0) a A (1.0)** y las vulnerabilidades de **2 → 0**.

**Cómo se reproduce (para la demo)**
```bash
# Análisis de calidad (levanta SonarQube, corre tests y escanea)
./scripts/analisis-calidad.sh

# Escaneo de seguridad OWASP ZAP (con el backend en :4000)
docker run --rm --network host -v "$PWD/docs:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:4000/api/health -r zap-report.html
```

---

### 9:00 – 12:00 · Cierre: planificado vs. ejecutado + lecciones

**Qué decir** (usa una tabla simple)

| Planificado | Ejecutado | Estado |
|---|---|---|
| Auth JWT + roles | Login/registro + middleware de roles | ✅ |
| CRUD de playlists | Crear + importar de Spotify | ✅ |
| Propuestas con tokens | Envío (‒1), aceptación (+1 curador) y rechazo (reembolso al artista) | ✅ |
| Sync real con Spotify | Al aceptar, la canción se agrega a la playlist del curador (permisos de escritura) | ✅ |
| Escuchar y ver el track | El curador escucha la canción **completa** (reproductor embebido) y ve canción/artista/fecha antes de decidir | ✅ |
| Verificación de email | Código de 6 dígitos al registrarse; sin verificar no se puede enviar | ✅ |
| Validación de track en Spotify | Al enviar se valida la canción contra la API real (Client Credentials); tracks inexistentes se rechazan | ✅ |
| Trazabilidad | La bandeja y "Mis envíos" muestran quién procesó cada propuesta y cuándo | ✅ |
| Cobertura ≥ 80 % | 84.6 % statements / 87 tests | ✅ |
| CI/CD | 6 jobs en GitHub Actions (incluye ZAP y deploy) | ✅ |
| Login social | Descartado por alcance | ⚠️ |

**Lecciones aprendidas**
- Spotify ya **no acepta `localhost`**: hay que usar IP de loopback
  (`127.0.0.1`) en la Redirect URI.
- El pool de MySQL se quedaba colgado con conexiones inactivas → se endureció
  con *keep-alive* e `idleTimeout`.
- Node debe ser LTS 22: Node 26 rompía `mysql2`/`iconv-lite`.
- Trabajar con dos cuentas evita el auto-envío de propuestas (regla anti-fraude).
- El análisis estático (SonarQube) encontró 2 vulnerabilidades en el `Dockerfile`
  (contenedor como `root` y copia indiscriminada de archivos): se corrigió con un
  usuario sin privilegios y copiando solo el código necesario.
- Dockerizar el proyecto permitió levantar todo el stack (BD + API + web) con un
  solo comando, eliminando diferencias entre máquinas.

---

### 12:00 – 15:00 · Plan de mejora continua + innovación

**Mejora continua (corto/mediano plazo)**
- ✔ ~~Sprint 3: validar contra la API de Spotify que el track existe~~ → **Implementado** (Client Credentials Flow en cada envío).
- ✔ ~~Verificación de email~~ → **Implementado** (código de 6 dígitos simulado).
- Recuperación de contraseña (envío de correo real) y login social.
- Cola de eventos (RabbitMQ) + servicio de notificaciones por email.
- Redis para caché de *followers* y *rate limiting* distribuido.

**Innovación tecnológica**
- **Recomendación con IA**: emparejar canciones y curadores por género/audio.
- **Puntuación de curador** por aceptaciones para priorizar playlists de calidad.
- **Microfrontends / Kubernetes**: escalar horizontalmente los servicios
  *stateless* y mover MaríaDB a un clúster gestionado.
- **Analítica** de conversión (envíos → aceptaciones) con dashboards.

---

## Checklist antes de presentar

- [ ] Ensayo cronometrado (máx. 15:00).
- [ ] App corriendo: backend `:4000` y frontend `:5173`.
- [ ] Pipeline en verde (pestaña Actions) para mostrar en vivo.
- [ ] Reporte **ZAP** generado y abierto.
- [ ] **SonarCloud** cargado (Quality Gate OK) en `https://sonarcloud.io/dashboard?id=Hugoatpxndx_OverDrive&branch=main`.
- [ ] Backend en `:4000` para que ZAP pueda escanear (o usar el reporte ya generado).
- [ ] Tener a mano el código de: middleware de roles, `jest.config.js` y `ci.yml`.
- [ ] Dos cuentas listas para el demo (artista y curador).

## Consejos de exposición

- Muestra **código real** y ejecuta las pruebas en vivo: la rúbrica valora la
  «demostración fluida del código, pruebas y pipeline».
- Si algo falla en vivo, ten preparada una captura de respaldo.
- No leas diapositivas: habla del problema y de tus decisiones técnicas.
