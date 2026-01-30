# Configuración de Variables de Entorno

## Verificación de la URL de Supabase

La URL correcta de Supabase es: `https://ehjrykgwfwgckfpcjmka.supabase.co`

## Para Desarrollo Local

1. **Verificar `.env.local`:**
   ```bash
   # El archivo .env.local debe contener:
   VITE_SUPABASE_URL=https://ehjrykgwfwgckfpcjmka.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_key_aqui
   ```

2. **Reiniciar el servidor de desarrollo:**
   ```bash
   # Detener el servidor (Ctrl+C)
   # Luego reiniciar:
   npm run dev
   ```

3. **Verificar en el navegador:**
   - Abre la aplicación en `http://localhost:8080`
   - Ve a Data Diagnostics
   - Verifica que "Supabase URL" muestre: `https://ehjrykgwfwgckfpcjmka.supabase.co`

## Para Producción

Las variables de entorno deben configurarse en el servicio de hosting:

### Vercel
1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega:
   - `VITE_SUPABASE_URL` = `https://ehjrykgwfwgckfpcjmka.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (tu anon key)
4. Re-deploy la aplicación

### Netlify
1. Ve a tu proyecto en Netlify Dashboard
2. Site settings → Environment variables
3. Agrega:
   - `VITE_SUPABASE_URL` = `https://ehjrykgwfwgckfpcjmka.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (tu anon key)
4. Trigger a new deploy

### Otros servicios
Configura las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el panel de control de tu servicio de hosting.

## Verificación

Después de configurar las variables de entorno:
1. Refresca la página con Ctrl+F5 (o Cmd+Shift+R) para limpiar la caché
2. Abre la consola del navegador (F12)
3. Ve a Data Diagnostics
4. Verifica que:
   - "Supabase URL" muestre la URL correcta
   - No haya errores de "column does not exist"
   - Los datos se muestren correctamente

## Nota Importante

- `.env.local` solo funciona en desarrollo local
- Para producción, las variables de entorno deben configurarse en el servicio de hosting
- Vite solo incluye variables que empiezan con `VITE_` en el build
- Después de cambiar variables de entorno, siempre reinicia el servidor de desarrollo o re-deploy en producción
