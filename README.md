# SeaRiders Admin

Consola operativa y administrativa para SeaRiders. Cubre tienda, carpa, plataforma, bar, RR. HH., mecánica y backoffice con cierres de caja, catálogo, precios, descuentos, regalos, packs y reporting.

## Stack

- Next.js 16 + React 19
- Prisma + PostgreSQL
- `iron-session` para sesión HTTP
- Zod para validación

## Módulos principales

- `src/app/login`: acceso con usuario, contraseña y turno.
- `src/app/store`: tienda, cobros, devoluciones, fianzas y cierres.
- `src/app/booth`: operativa de carpa, taxiboat y cobros.
- `src/app/platform`: asignación y seguimiento operativo.
- `src/app/bar`: TPV, entregas, devoluciones e incidencias.
- `src/app/hr`: fichajes, tarifas, payroll y empleados.
- `src/app/mechanics`: mantenimiento, incidencias y recambios.
- `src/app/admin`: catálogo, precios, canales, usuarios, activos, cierres y configuración.
- `src/app/executive`: reporting ejecutivo.

## Autenticación

- La sesión usa la cookie `seariders_session`.
- Un usuario puede tener varios roles.
- Si tiene más de uno, tras validar credenciales aparece un selector de acceso y la sesión se abre con el rol operativo elegido para ese turno.

## Variables de entorno

Copia `.env.example` a `.env` y define como mínimo:

```bash
DATABASE_URL=...
SESSION_PASSWORD=...
NEXT_PUBLIC_APP_URL=https://tu-dominio
BUSINESS_TZ=Europe/Madrid
```

Si vas a usar PDFs, firmas o ficheros en S3:

```bash
S3_PUBLIC_BASE_URL=...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
```

## Desarrollo

```bash
npm install
npm run prisma:seed
npm run dev
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run prisma:seed`

## Producción

Checklist mínima para subirla bien:

1. Crear base de datos PostgreSQL de producción.
2. Configurar `DATABASE_URL`, `SESSION_PASSWORD`, `NEXT_PUBLIC_APP_URL` y `BUSINESS_TZ`.
3. Ejecutar migraciones:

```bash
npx prisma migrate deploy
```

4. Si necesitas datos base:

```bash
npm run prisma:seed
```

5. Generar y arrancar build:

```bash
npm run build
npm run start
```

6. Servir la app detrás de HTTPS.
7. Tener copias de seguridad de la base de datos.
8. Revisar que exista al menos un usuario admin activo.

## Nota operativa

El proyecto ya usa bastante lógica de negocio real en cobros, fianzas, caja y reporting. Antes de abrir a producción conviene validar con datos reales:

- login multirol,
- cierres de caja por origen,
- devolución total/parcial/retención de fianza,
- histórico y executive,
- permisos por rol en rutas críticas.
