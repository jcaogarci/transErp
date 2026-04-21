# 🚛 TransERP — Guía de instalación y despliegue GRATUITO
## Stack 100% gratuito: Supabase (DB) + Render (servidor) + GitHub (código)

---

## ⏱️ Tiempo estimado: 30 minutos

---

## PASO 1 — Subir el código a GitHub (gratis)

1. Ve a https://github.com y crea una cuenta si no tienes
2. Crea un nuevo repositorio llamado `transErp`
3. Descarga e instala Git: https://git-scm.com/downloads
4. Abre una terminal en la carpeta `transErp` y ejecuta:

```bash
git init
git add .
git commit -m "TransERP inicial"
git remote add origin https://github.com/TU_USUARIO/transErp.git
git push -u origin main
```

---

## PASO 2 — Crear la base de datos en Supabase (gratis)

1. Ve a https://supabase.com y crea una cuenta (gratis)
2. Crea un nuevo proyecto:
   - Nombre: `transErp`
   - Contraseña de base de datos: **guárdala, la necesitarás**
   - Región: Europe West (para España)
3. Espera 2 minutos a que se cree
4. Ve a **SQL Editor** (menú izquierdo)
5. Copia TODO el contenido del archivo `backend/schema.sql`
6. Pégalo en el editor y pulsa **Run**
7. Verás "Success" — la base de datos está lista con datos de ejemplo

### Obtener la URL de conexión:
- Ve a **Project Settings** > **Database**
- Copia la **Connection String** → modo **URI**
- Tendrá esta forma: `postgresql://postgres:TU_CONTRASEÑA@db.xxxx.supabase.co:5432/postgres`

---

## PASO 3 — Desplegar en Render (gratis)

1. Ve a https://render.com y crea una cuenta (gratis, con GitHub)
2. Pulsa **New +** → **Web Service**
3. Conecta tu repositorio GitHub `transErp`
4. Configura:
   - **Name:** transErp
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
5. Añade las variables de entorno (pestaña **Environment**):

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | La URL de Supabase del paso anterior |
| `JWT_SECRET` | Una cadena aleatoria larga (ej: abre terminal y pon `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `NODE_ENV` | `production` |

6. Pulsa **Create Web Service**
7. Render desplegará en ~3 minutos
8. Tu app estará en: `https://transErp.onrender.com` (o similar)

---

## PASO 4 — Primer acceso

1. Abre la URL de tu app en Render
2. Inicia sesión con:
   - **Email:** `admin@transErp.es`
   - **Contraseña:** `Admin1234!`
3. **¡IMPORTANTE!** Ve a Configuración → Cambiar contraseña y cámbiala

---

## PASO 5 — Crear usuarios adicionales (opcional)

Desde Supabase SQL Editor ejecuta:
```sql
-- Contraseña: MiPassword123
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES (
  'Juan Operador',
  'juan@tuempresa.es',
  '$2b$10$rPWkEsJxP9R3nLkFz4mPIeJ8.8qhzqvGBj7RjXeNvKm2JLsL6tKYi',
  'operador'
);
```

Para generar un hash de contraseña diferente, en terminal:
```bash
node -e "const b=require('bcryptjs');b.hash('TuNuevaContraseña',10).then(h=>console.log(h))"
```

**Roles disponibles:**
- `admin` — Acceso total
- `operador` — Operaciones del día a día
- `facturacion` — Solo facturación y clientes
- `solo_lectura` — Solo visualización

---

## 🔄 Cómo actualizar la app

Cada vez que hagas cambios al código:
```bash
git add .
git commit -m "descripción del cambio"
git push
```
Render detecta el push y redespliega automáticamente.

---

## 💾 Límites del plan gratuito

| Servicio | Límite gratuito |
|----------|-----------------|
| **Supabase** | 500 MB base de datos, 2 GB transferencia/mes |
| **Render** | 750 horas/mes de servidor (suficiente para 1 app 24/7) |
| **GitHub** | Repositorios privados ilimitados |

> ⚠️ En Render plan gratuito, el servidor "duerme" tras 15 min de inactividad. El primer acceso tarda ~30 segundos. Para evitarlo, usa el plan Starter (7$/mes).

---

## 🔧 Desarrollo local

Para trabajar en local sin Render:
```bash
# Instalar dependencias
cd backend
npm install

# Crear archivo .env
cp .env.example .env
# Edita .env con tu DATABASE_URL de Supabase

# Iniciar servidor
npm run dev
# → http://localhost:3000
```

---

## 📞 Estructura del proyecto

```
transErp/
├── backend/
│   ├── server.js          ← API REST (Express + PostgreSQL)
│   ├── schema.sql         ← Esquema de la base de datos
│   ├── package.json
│   └── .env.example
├── frontend/
│   └── public/
│       ├── index.html     ← Interfaz de usuario (SPA)
│       └── app.js         ← Lógica del frontend
└── render.yaml            ← Configuración de despliegue
```

---

## 🔐 Seguridad incluida

- Autenticación JWT (tokens de 8 horas)
- Contraseñas hasheadas con bcrypt (salt 10)
- Rate limiting en todas las rutas API
- CORS configurado por entorno
- Roles de usuario (admin, operador, facturación, solo lectura)

---

## ❓ Solución de problemas

**Error "Cannot connect to database"**
→ Verifica que DATABASE_URL en Render sea correcto y que en Supabase hayas ejecutado el schema.sql

**App no carga / 404**
→ Verifica que el Root Directory en Render sea `backend`

**Error de CORS**
→ Añade la variable `FRONTEND_URL` con la URL exacta de tu app en Render

**Contraseña de admin olvidada**
→ En Supabase SQL Editor: `UPDATE usuarios SET password_hash='$2b$10$rPWkEsJxP9R3nLkFz4mPIeJ8.8qhzqvGBj7RjXeNvKm2JLsL6tKYi' WHERE email='admin@transErp.es';` (contraseña: Admin1234!)
