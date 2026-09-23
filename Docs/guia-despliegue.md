# OverDrive · Guía de Despliegue Público (entorno de prueba)

> Documento de entrega (uso local). No se publica en GitHub.

## Respuesta corta a tu duda

**Sí.** Si despliegas en una plataforma conectada a GitHub (Railway/Render), el
**auto-deploy** funciona así:

1. Editas el código en tu PC.
2. `git add . && git commit -m "..." && git push`
3. La plataforma detecta el push a `main` y **vuelve a desplegar sola**.
4. La **misma URL** se actualiza en 1-2 minutos.

No hace falta reconfigurar nada. También hay un botón **Redeploy** manual.

---

## Opción recomendada: Railway (un solo servicio)

> **Configuración real en producción (2026-09).** OverDrive se despliega como **UN
> solo Web Service**: el backend sirve la API (`/api/*`) y el frontend compilado
> (`frontend/dist`) en el mismo dominio. No hacen falta dos servicios ni CORS.

### Paso 1 · Cuenta y proyecto
1. Entra a https://railway.app y crea una cuenta (login con GitHub).
2. **New Project → Deploy from GitHub repo →** selecciona `OverDrive`.
3. **New → Database → MariaDB (MySQL)**. Railway crea la base y expone las
   variables `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DATABASE`.

### Paso 2 · Servicio (backend + frontend)
1. En el proyecto: **New → GitHub Repo →** el mismo `OverDrive`.
2. **Delete** los `Dockerfile` de `backend/` y `frontend/` (o renuévelos como
   `Dockerfile.disabled`): **usa el `Dockerfile` raíz**, que compila ambos.
3. **Settings**:
   - **Root Directory**: *(vacío)*
   - **Builder**: `Dockerfile` → **Dockerfile Path**: `/Dockerfile` (raíz)
   - **Build Command**: *(vacío — el Dockerfile compila backend + frontend)*
   - **Start Command**: *(vacío — el Dockerfile ejecuta `npm start`, que corre
     `db-init.js` y levanta `server.js`)*
   - **Healthcheck Path**: `/api/health`
   - **Networking → Generate Service Domain** → **Target Port**: `4000`
4. **Variables** (Settings → Variables):

| Variable | Valor |
|---|---|
| `MARIADB_USER` | *(añadida como shared, de la BD)* |
| `MARIADB_PASSWORD` | *(añadida como shared, de la BD)* |
| `MARIADB_DATABASE` | *(añadida como shared, de la BD)* |
| `DB_HOST` | hostname privado de la BD, p. ej. `overdrive-db.railway.internal` |
| `DB_PORT` | `3306` |
| `PORT` | `4000` |
| `JWT_SECRET` | una cadena larga y aleatoria |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://<tu-dominio>.up.railway.app` |
| `SPOTIFY_CLIENT_ID` | tu Client ID |
| `SPOTIFY_CLIENT_SECRET` | tu Client Secret |
| `SPOTIFY_REDIRECT_URI` | `https://<tu-dominio>.up.railway.app/api/spotify/callback` |

> ⚠️ El backend lee `MARIADB_USER/PASSWORD/DATABASE` **antes** que `DB_USER/...`;
> el `$MARIADB_*` literal en una variable `DB_USER` NO se resuelve → no crees
> aliases. `DB_HOST` sí se usa (hostname privado `.railway.internal`).

5. El `db-init.js` corre en el **arranque** (crea tablas, migraciones y admin;
   idempotente) — no hace falta job por separado.

### Resultado
- **App completa**: `https://<tu-dominio>.up.railway.app` (frontend + API)
- Health check: `https://<tu-dominio>.up.railway.app/api/health`
- Admin de demo: `admin@overdrive.app` / `8H8LrSK8qUhvuY7i6Ghs`

### Paso 3 · Spotify
- Añade la Redirect URI `https://<tu-dominio>.up.railway.app/api/spotify/callback`
  en el **Dashboard de Spotify → Edit Settings → Redirect URIs**.
- En **modo development**, agrega en **Users and access** los correos de las
  cuentas que conectarán Spotify (hasta 25 gratis).

---

## Alternativa: Render

Render es similar (auto-deploy desde GitHub), pero **no ofrece MySQL gestionado**
(solo PostgreSQL/Redis). Para usarlo necesitarías un MySQL externo (Aiven,
Clever Cloud) o desplegar MySQL como servicio Docker con disco persistente.
Por eso se recomienda Railway.

---

## Alternativa rápida: túnel temporal (sin cuentas)

Para una demo inmediata puedes exponer tu stack local:

```bash
# Con el stack levantado (docker compose up -d)
ssh -R 80:localhost:5173 nokey@localhost.run
```

Devuelve una URL pública temporal. **Limitación:** depende de tu PC encendida y
del túnel; para cambios hay que reiniciarlo. No sirve como entregable estable.

---

## Comandos útiles

```bash
# Entorno local completo
docker compose up -d --build

# Inicializar la BD de un entorno nuevo (local o nube)
cd backend && npm run db:init

# Ver logs del backend desplegado (Railway CLI)
railway logs
```

## Seguridad antes de publicar
- Usa un `JWT_SECRET` fuerte y único por entorno.
- No subas `.env` al repo (ya está en `.gitignore`).
- Restringe `CORS_ORIGIN` al dominio real del frontend.
- Cambia la contraseña del administrador por defecto.
