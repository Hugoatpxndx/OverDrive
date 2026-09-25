# OverDrive · Informe de Métricas de Calidad y Seguridad

> Documento de entrega (uso local). No se publica en GitHub.
> Generado a partir de las herramientas reales del proyecto.

---

## 1. Resumen

| Área | Herramienta | Resultado |
|---|---|---|
| Pruebas unitarias | Jest + Supertest | **87 tests**, cobertura **≥ 80 %** |
| Calidad de código | SonarQube | **Quality Gate OK**, ratings **A/A/A** |
| Seguridad web | OWASP ZAP | **0 fallos**, 66 comprobaciones PASS |
| Integración/Entrega | GitHub Actions | **6 jobs**, pipeline en verde |

---

## 2. Cobertura de pruebas (Jest)

Comando: `cd backend && npm test`

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Suites | 5 | — | ✅ |
| Tests | 87 | — | ✅ |
| Statements | **84.6 %** | 80 % | ✅ |
| Líneas | **85.1 %** | 80 % | ✅ |
| Funciones | **95.3 %** | 80 % | ✅ |
| Ramas (branches) | **70.4 %** | 65 % | ✅ |

> Los umbrales están configurados en `backend/jest.config.js` y **hacen fallar**
> la build si no se cumplen.

---

## 3. Calidad de código (SonarQube/SonarCloud)

Dashboard (SonarCloud): `https://sonarcloud.io/dashboard?id=Hugoatpxndx_OverDrive&branch=main`

| Métrica | Resultado |
|---|---|
| Quality Gate | **OK (aprobado)** |
| Bugs | 0 |
| Vulnerabilidades | **0** |
| Security Hotspots | 0 |
| Code Smells | 43 |
| Duplicación | **1.9 %** |
| Cobertura (global) | 58.6 % * |
| **Reliability Rating** | **A (1.0)** |
| **Security Rating** | **A (1.0)** |
| **Maintainability Rating** | **A (1.0)** |
| Líneas de código (ncloc) | 3 208 |
| Archivos | 28 |

> \* SonarQube mide la cobertura **global** del repositorio. La cobertura de la
> **lógica de negocio** (controladores y middlewares) es **≥ 80 %**, validada
> por Jest. El frontend no tiene pruebas unitarias y se excluye del cálculo.

### 3.1 Vulnerabilidades detectadas y corregidas

| Regla | Severidad | Archivo | Descripción | Corrección |
|---|---|---|---|---|
| `docker:S6471` | Minor | `backend/Dockerfile` | El contenedor corre como `root` | Se añadió `USER node` |
| `docker:S6470` | **Critical** | `backend/Dockerfile` | `COPY . .` podía incluir datos sensibles | Copia selectiva de solo el código necesario |

**Impacto:** el *Security Rating* pasó de **E (4.0)** a **A (1.0)** y las
vulnerabilidades de **2 → 0**.

### 3.2 Deuda técnica / code smells
- 43 *code smells* (principalmente estilo y complejidad menor).
- Prioridad de refactor: smells de severidad `MAJOR` en controladores.

---

## 4. Seguridad web (OWASP ZAP)

Escaneo *baseline* sobre `http://localhost:4000/api/health` (job `zap-scan`).

| Resultado | Cantidad |
|---|---|
| FAIL (riesgo alto) | **0** |
| WARN (advertencias) | 1 |
| PASS | 66 |

### 4.1 Mitigación aplicada
- **Storable and Cacheable Content (10049):** se añadió el encabezado
  `Cache-Control: no-store` a todas las respuestas de la API para evitar el
  almacenamiento en caché de datos sensibles.

### 4.2 Controles OWASP verificados (encabezados y buenas prácticas)
- `helmet` → `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `CSP`.
- `CORS` restringido por origen.
- `express-rate-limit` en `/api/auth` (mitiga fuerza bruta).
- Body parser limitado a `10kb` (mitiga DoS por payload).
- Manejo de errores sin exponer *stack traces* en producción.

---

## 5. Pipeline CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

| # | Job | Función | Condición |
|---|---|---|---|
| 1 | `backend-tests` | Instala y corre Jest con cobertura ≥ 80 % | Siempre |
| 2 | `frontend-build` | Compila el frontend con Vite | Siempre |
| 3 | `security-scan` | `npm audit` en backend y frontend | Siempre |
| 4 | `sonarqube` | Análisis de calidad (opcional, si hay secrets) | Siempre |
| 5 | `deploy` | Levanta el stack con Docker Compose + smoke test | Push a `main` |
| 6 | `zap-scan` | OWASP ZAP baseline + artifact del reporte | Siempre |

**Artefactos publicados:** `coverage-report` (cobertura) y `zap-report`
(seguridad).

---

## 6. Cómo reproducir las métricas

```bash
# 1) Pruebas + cobertura
cd backend && npm test

# 2) Calidad + seguridad local (SonarQube + ZAP)
./scripts/analisis-calidad.sh

# 3) ZAP manual (con el backend corriendo en :4000)
docker run --rm --network host -v "$PWD/zap-reports:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:4000/api/health -r zap-report.html -I
```
