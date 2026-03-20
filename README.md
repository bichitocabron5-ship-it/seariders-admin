# SeaRiders Admin

Consola operativa y de administracion para SeaRiders. Cubre el flujo diario de tienda y carpa (reservas, cobros, cierres de caja), junto con el backoffice de catalogo, precios, descuentos, packs, regalos y comisiones.

**Stack principal**
- Next.js 16 (App Router) + React 19
- Prisma + PostgreSQL
- iron-session (cookie de sesion)
- Zod para validacion
- Tailwind configurado, UI actual con estilos inline

**Modulos y rutas**
- `src/app/login`: acceso con usuario, password y turno.
- `src/app/store`: dashboard de tienda (reservas del dia, cobros, caja, comisiones, descuentos, packs, regalos).
- `src/app/booth`: operativa de carpa/booth (reservas, cobros, viajes de taxiboat, cierres de caja).
- `src/app/admin`: backoffice (catalogo, precios, canales y comisiones, descuentos, packs, cierres de caja, regalos).
- `src/app/platform` y `src/app/bar`: placeholders por ahora.

**API interna (Route Handlers)**
Las rutas de backend viven bajo `src/app/api` y se agrupan por dominio:
- `login` para autenticacion.
- `pos/catalog` para catalogo operativo.
- `store/*` y `booth/*` para reservas, pagos, cierres de caja, comisiones, descuentos y regalos.
- `admin/*` para CRUD de catalogo, precios, canales, descuentos, packs y cierres.

**Modelo de datos (Prisma)**
El esquema se mantiene en `prisma/schema.prisma`. Modelos clave:
- Usuarios/roles/sesiones de turno: `User`, `Role`, `UserRole`, `ShiftSession`.
- Catalogo y pricing: `Channel`, `Service`, `ServiceOption`, `ServicePrice`, `Pack`, `PackItem`.
- Reservas y pagos: `Reservation`, `ReservationItem`, `Payment`, `ReservationJetski`, `Jetski`.
- Caja: `CashShift`, `CashClosure`, `CashClosureUser`, `EditLock`.
- Descuentos y regalos: `DiscountRule`, `GiftProduct`, `GiftVoucher`.
- Operativa extra: `TaxiboatTrip`, `Monitor`, `MonitorRun`.

**Autenticacion y sesiones**
- `src/middleware.ts` protege todas las rutas salvo `login` y `api/login`.
- Sesion con cookie `seariders_session` via `iron-session` en `src/lib/session.ts`.
- Redireccion por rol en `src/app/api/login/route.ts`.

## Requisitos y configuracion

1. Instalar dependencias:
```bash
npm install
```

2. Definir variables de entorno en `.env`:
```bash
DATABASE_URL=...
DIRECT_URL=...
SESSION_PASSWORD=...
```

3. Prisma:
- Configuracion en `prisma.config.ts`.
- Migraciones en `prisma/migrations`.
- Seed disponible:
```bash
npm run prisma:seed
```

## Scripts
- `npm run dev` inicia el servidor local.
- `npm run build` genera el build de produccion.
- `npm run start` arranca el build.
- `npm run lint` ejecuta ESLint.
- `npm run prisma:seed` carga datos iniciales.
