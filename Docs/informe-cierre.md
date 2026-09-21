# OverDrive · Informe de Cierre del Proyecto

> Cubre los criterios 4 (cierre y análisis) y 5 (plan de mejora continua) de la
> rúbrica de la Entrega Final.

---

## 1. Resumen ejecutivo

**OverDrive** es una plataforma web que conecta a **artistas** con **curadores**
de playlists mediante un sistema de **tokens**: el artista gasta 1 token al
enviar su canción a una playlist, al **rechazarla** el token se le devuelve, y al
**aceptarla** el token pasa al curador como pago por publicarla. El
sistema incluye autenticación **JWT con roles**, **verificación de email**,
integración **OAuth 2.0 con Spotify**, **validación real de cada track contra la
API de Spotify**, pruebas automatizadas (**87 tests, cobertura ≥ 80 %**), un
pipeline **CI/CD** y análisis de **seguridad (OWASP ZAP)** y **calidad (SonarQube)**.

*(La actividad usa el ejemplo de donaciones; el módulo de registro de donantes se
materializa aquí como el registro de usuarios/artistas con autenticación y roles.)*

### Objetivo SMART
> Desarrollar y desplegar OverDrive con autenticación JWT y control de roles,
> integración OAuth 2.0 con Spotify e intercambio de propuestas mediante tokens,
> alcanzando una cobertura de pruebas **≥ 80 %** y un pipeline **CI/CD**
> automatizado (pruebas, construcción y despliegue a entorno de prueba) en
> GitHub Actions, dentro del plazo del reto.

---

## 2. Comparación: planificado vs. ejecutado

| # | Entregable planificado | Resultado ejecutado | Estado | Desviación |
|---|---|---|---|---|
| 1 | Registro de usuarios + login | Registro/login con bcrypt y validación fuerte | ✅ | Sin desviación |
| 2 | Autenticación JWT + roles (admin/usuario) | JWT firmado + middleware `authenticate`/`authorize` | ✅ | Sin desviación |
| 3 | CRUD de playlists | Crear manual + **importar de Spotify** | ✅ | +1 día |
| 4 | Propuestas con tokens | Envío, **aceptación** (+1 curador), **rechazo** (reembolso al artista), descuento atómico y reglas anti-fraude (duplicado 409 con reembolso) | ✅ | Sin desviación |
| 5 | Pruebas unitarias ≥ 80 % | **87 tests**, 84.6 % statements / 85.1 % líneas / 70.4 % ramas | ✅ | Sin desviación |
| 6 | Pipeline CI/CD | 6 jobs: tests, build, seguridad, Sonar, **ZAP** y **despliegue a entorno de prueba** | ✅ | +2 días |
| 7 | Integración Spotify (OAuth) | Conexión, import de playlists, seguidores reales, **sync real al aceptar** (agrega la canción a la playlist con permisos de escritura) y **reproductor embebido de la canción completa** | ✅ | **+1.5 días** |
| 8 | Verificación de email / login social | **Email verificado con código de 6 dígitos** (sin SMTP real; se muestra en pantalla) y gate en el envío | ✅ | Login social descartado (REST) |
| 9 | Validación de track contra API Spotify | **100 % de envíos validados** con *Client Credentials Flow* (sin token de usuario): tracks inexistentes se rechazan antes de gastar el token (soft-fail por red) | ✅ | Sin desviación |

### Línea de tiempo (días de trabajo efectivos)

| Fase | Planificado | Real | Δ |
|---|---|---|---|
| Autenticación + roles | 2 | 2 | 0 |
| CRUD playlists + propuestas | 3 | 3 | 0 |
| Integración Spotify | 2 | **3.5** | +1.5 |
| Pruebas + cobertura | 1.5 | 1.5 | 0 |
| CI/CD | 1 | **3** | +2 |
| Docker + calidad/seguridad | 1.5 | 2.5 | +1 |
| **Total** | **11** | **16.5** | **+5.5** |

### Principales causas de desviación
1. **Spotify ya no acepta `localhost`** (exige HTTPS o IP de loopback):
   detectar y corregir esto costó ~1 día.
2. **Pool de conexiones colgado**: MaríaDB cerraba conexiones inactivas y el
   backend se quedaba sin responder → depuración y endurecimiento del pool
   (~0.5 día).
3. **Node 26 rompía `mysql2`/`iconv-lite`**: se fijó **Node 22 LTS** (~0.5 día).
4. **Pipeline**: se añadieron etapas no previstas (seguridad, Sonar, deploy) y la
   integración de SonarQube/OWASP ZAP requirió aprender su operativa (~2 días).
5. **Docker**: la orquestación y el ajuste de credenciales/volúmenes añadieron
   ~1 día.

---

## 3. Lecciones aprendidas

- **Documentar la configuración externa desde el inicio** (por ejemplo, los
  requisitos de la Redirect URI de Spotify) evita retrabajo: hoy se sabe que
  Spotify **prohibe `localhost`** y exige `127.0.0.1`.
- **Fijar versiones LTS** de Node es clave: usar una versión no-LTS rompió
  dependencias nativas.
- **Configurar los pools de base de datos** con *keep-alive* e `idleTimeout`
  previene bloqueos difíciles de diagnosticar.
- **Docker desde el principio** elimina la fricción «funciona en mi máquina» y
  facilita la entrega.
- **El análisis estático rinde fruto**: SonarQube encontró 2 vulnerabilidades en
  el `Dockerfile` (ejecución como `root` y copia indiscriminada de archivos) que
  se corrigieron: rating de seguridad de **E → A**.
- **Trabajar con dos cuentas** (artista y curador) hace evidente la regla de
  negocio anti-fraude (no enviar a la propia playlist).
- **Validar el contenido contra la API real** (no solo el formato de la URL)
  cierra un hueco de calidad típico: con el *Client Credentials Flow* se valida
  cada track sin exigir que el artista conecte Spotify.
- **El alcance debe acotarse**: se priorizó calidad/seguridad/despliegue; el
  login social quedó como mejora futura, pero la **verificación de email** se
  incorporó (código de 6 dígitos simulado).

---

## 4. Plan de mejora continua (acciones medibles)

| Acción | Objetivo medible | Plazo | Responsable |
|---|---|---|---|
| ✔ Validar tracks y propiedad real vía **Spotify Web API** (Client Credentials) | ~~100 % de envíos validados; 0 URLs inválidas~~ → **Implementado en Entrega Final** | ✔ Sprint 3 | Dev backend |
| ✔ Verificación de email | ~~Código de 6 dígitos en registro~~ → **Implementado en Entrega Final** | ✔ Sprint 3 | Dev backend |
| Alcanzar **cobertura global ≥ 80 %** también en SonarQube | Cobertura Sonar ≥ 80 % | Sprint 3 | QA |
| Añadir **pruebas de integración** de los flujos OAuth | ≥ 5 tests E2E de Spotify | Sprint 3 | QA |
| **Deploy automático a entorno público** (Render/Railway) con *smoke tests* | URL pública verde en cada push a `main` | Sprint 4 | DevOps |
| **Cola de eventos** (RabbitMQ) para notificaciones | 0 notificaciones perdidas; latencia < 2 s | Sprint 4 | Dev backend |
| **Redis** para caché de seguidores y rate limiting | P95 de la API < 200 ms | Sprint 5 | DevOps |
| Automatizar **OWASP ZAP full scan** en el pipeline | 0 alertas de riesgo alto/medio | Sprint 5 | Seguridad |

### KPIs de seguimiento
- Cobertura de pruebas (objetivo ≥ 80 %).
- N.º de vulnerabilidades de SonarQube y ZAP (objetivo 0 altas/medias).
- Tiempo de pipeline (< 10 min) y *lead time* (push → entorno de prueba).
- Deuda técnica de SonarQube (reducir 43 code smells, priorizar `MAJOR`).

---

## 5. Propuestas de innovación tecnológica

1. **IA para emparejar canciones y curadores** por similitud de audio/género y
   predicción de aceptación (modelo de recomendación).
2. **Puntuación de curadores** basada en tasa de aceptación y tiempo de
   respuesta, para priorizar playlists de mayor calidad.
3. **Predicción de demanda de playlists** y mejores horarios de envío con datos
   históricos.
4. **Arquitectura de microservicios sobre Kubernetes** para escalar
   horizontalmente los servicios *stateless* (Auth, Submissions, UI).
5. **Analítica de conversión** (envíos → aceptaciones) con dashboards para
   detectar cuellos de botella.
6. **Transparencia y trazabilidad** con auditoría de acciones (quién propuso/aceptó
   qué y cuándo) para reforzar la confianza de la comunidad. **(*) Parcialmente
   implementado**: la bandeja y "Mis envíos" muestran quién procesó cada propuesta
   y cuándo; una tabla de auditoría formal es una evolución natural.

---

## 6. Conclusiones

El sistema cumple el objetivo SMART: es funcional, seguro (JWT + roles, OWASP),
de calidad medible (SonarQube *Quality Gate* **OK**, ratings **A**) y desplegable
en un comando (**Docker Compose**) con pipeline **CI/CD** que ejecuta pruebas,
construcción y despliegue a un entorno de prueba. Las desviaciones se explican
por aprendizaje de integraciones externas y por elevar el estándar de calidad; el
plan de mejora define pasos concretos y medibles para las siguientes iteraciones.
