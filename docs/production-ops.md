# Produccion segura - SeaRiders

## Nunca hacer en produccion
- `npx prisma db seed`
- `npx prisma migrate reset`
- ejecutar scripts sin revisar antes `DATABASE_URL` y variables de confirmacion
- lanzar `db:reset-production` sin ventana de mantenimiento y backup reciente

## Si hacer en produccion
- `npx prisma migrate deploy`
- `npm run seed:admin`
- `npm run seed:faults`
- verificar que existe al menos un usuario admin activo
- comprobar `BUSINESS_TZ`, `SESSION_PASSWORD` y variables de S3 antes del arranque

## Reset total del schema
Solo para emergencias reales.

Comando:

```bash
CONFIRM_RESET_PRODUCTION=YES_I_UNDERSTAND npm run db:reset-production
```

Antes de ejecutarlo:
- confirmar que `DATABASE_URL` apunta exactamente al entorno esperado
- hacer backup o snapshot utilizable
- parar trafico de la aplicacion
- dejar constancia de quien lo ejecuta y por que

Despues de ejecutarlo:
- `npx prisma migrate deploy`
- `npm run seed:admin`
- `npm run seed:faults`
- validar login admin, caja y rutas criticas

## Desarrollo local
Para local si puedes usar:

```bash
npm run prisma:seed
```

Eso no implica que sea seguro en produccion.

## Regla clave
Produccion = datos reales.
Local = pruebas.

Nunca mezclar ambos flujos.
