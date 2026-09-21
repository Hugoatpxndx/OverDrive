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

## Opción recomendada: Railway (soporta MySQL)

Railway es la opción más directa porque ofrece **MySQL gestionado**, que es el
motor que usa OverDrive.

### Paso 1 · Cuenta y proyecto
1. Entra a https://railway.app y crea una cuenta (login con GitHub).
2. **New Project → Deploy from GitHub repo →** selecciona `OverDrive`.
3. **New → Database → MySQL**. Railway crea la base y sus credenciales.

### Paso 2 · Servicio del backend
1. En el proyecto: **New → GitHub Repo →** el mismo `OverDrive`.
2. En ese servicio: **Settings → Root Directory = `backend`**.
   Railway detecta el `Dockerfile` automáticamente.
3. **Variables** (Settings → Variables), referenciando el MySQL:

| Variable | Valor |
|---|---|
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `JWT_SECRET` | una cadena larga y aleatoria |
| `CORS_ORIGIN` | `https://<tu-frontend>.up.railway.app` |
| `SPOTIFY_CLIENT_ID` | tu Client ID |
| `SPOTIFY_CLIENT_SECRET` | tu Client Secret |
| `SPOTIFY_REDIRECT_URI` | `https://<tu-backend>.up.railway.app/api/spotify/callback` |

4. **Settings → Deploy → Pre-deploy Command**: `npm run db:init`
   (crea las tablas e inserta el admin; es idempotente).
5. **Settings → Networking → Generate Domain** para obtener la URL pública.

### Paso 3 · Servicio del frontend
1. **New → GitHub Repo →** `OverDrive` otra vez.
2. **Settings → Root Directory = `frontend`**.
3. **Build Command**: `npm ci && npm run build`
4. **Start Command**: `npx vite preview --host 0.0.0.0 --port $PORT`
5. **Variables**:

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://<tu-backend>.up.railway.app` |

> `VITE_API_URL` se inyecta en **tiempo de build**; cámbiala antes de construir.

### Paso 4 · Ajustes finales
- En el **Dashboard de Spotify**, añade la Redirect URI de producción
  (`https://<tu-backend>.up.railway.app/api/spotify/callback`).
- Cambia la contraseña del admin tras el primer login.

### Resultado
- Frontend: `https://<tu-frontend>.up.railway.app`
- Backend: `https://<tu-backend>.up.railway.app/api/health`

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
