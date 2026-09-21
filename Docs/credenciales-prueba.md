# OverDrive · Credenciales de prueba

Cuentas creadas para probar el programa de punta a punta.

## Cuentas de prueba (Spotify)

| Perfil  | Correo (login)                      | Contraseña correo | Contraseña Spotify |
|---------|-------------------------------------|-------------------|--------------------|
| Cuenta 1 | overdrivespotify@gmail.com         | Admin123#         | Admin1234#         |
| Cuenta 2 | overdrivespotify2@yahoo.com        | Admin12345#       | Admin1234#         |

>⚠️ **Importante**: ambos correos (los 2) deben estar agregados como **usuarios de
>prueba** en el Dashboard de Spotify → *Users and access* → el correo de cada cuenta,
>si no, la API responde 403 al leer/escribir playlists.

## Cómo usarlas en la app (flujo con 2 usuarios)

> La app **no permite** que un artista envíe canciones a su propia playlist, por eso
> se necesitan **2 cuentas** (una para enviar y otra para aceptar).

1. **Cuenta 1 = Curador** (usa la Spotify de la Cuenta 1):
   - Regístrate en OverDrive con cualquier email (p. ej. `curador@overdrive.test`).
   - Inicia sesión → Modo Curador → **"🔗 Conectar cuenta de Spotify"**.
   - En la ventana de Spotify inicia sesión con **Cuenta 1** (`Admin1234#`) y acepta
     permisos (lectura + escritura de playlists).
   - **"🔄 Actualizar playlists"** para importar las playlists de esa cuenta.
2. **Cuenta 2 = Artista**:
   - Regístrate en OverDrive como segundo usuario (p. ej. `artista@overdrive.test`).
   - No necesita conectar Spotify. Gasta su token enviando la URL de un track de Spotify
     y eligiendo una playlist de la Cuenta 1.
3. **Aceptar:** en Modo Curador (Cuenta 1), escucha la canción completa y presiona
   **"✔ Aceptar (+1 token)"**. La canción se agrega **de verdad** a la playlist de
   Spotify de la Cuenta 1 (verifícala en Spotify) y el **token pasa a la Cuenta 1
   (el curador)**. Si prefieres probar el **rechazo**, presiona **"✖ Rechazar"** y el
   **token se devuelve a la Cuenta 2 (el artista)**.

> Nota: si Spotify pide reautorizar tras cambiar permisos, desconecta y vuelve
> a conectar en el Dashboard.

## Acceso local de la pila

| Recurso         | URL / credencial                          |
|-----------------|-------------------------------------------|
| App (frontend)  | http://localhost:5173                     |
| API (backend)   | http://localhost:4000                     |
| Admin de la app | `admin@overdrive.app` / `8H8LrSK8qUhvuY7i6Ghs` |
| MaríaDB (host)  | `localhost:3306` (`overdrive_user` / `2010`) |
| MaríaDB (docker)| `localhost:3307` (`overdrive_user` / `2010`) |