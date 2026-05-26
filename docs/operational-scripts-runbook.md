# Operational Scripts Runbook

Este runbook documenta los scripts bajo `scripts/` y los alias relevantes de `package.json`.
Complementa [production-ops.md](/C:/dev/seariders-admin/docs/production-ops.md) y no sustituye los controles previos de entorno, backup y ventana operativa.

## Reglas generales

- Verificar `DATABASE_URL` antes de cualquier script con escritura.
- Ejecutar primero el modo de inspección o `dry-run` cuando exista.
- Guardar el output JSON o consola del script aplicado para auditoría.
- Si el script no tiene `dry-run`, asumir que escribe inmediatamente.
- Los scripts que usan “today” calculan el día en `Europe/Madrid`.
- Priorizar alias de `npm run` cuando existan; para los demás usar `npx tsx scripts/<file>.ts`.

## Mapa de aliases de package.json

| Alias | Script real | Uso |
| --- | --- | --- |
| `npm run reservation:restore-canceled -- --reservationId <id> [--apply]` | `scripts/restore-canceled-reservation.ts` | Reparación acotada de una reserva cancelada por error |
| `npm run pricing:repair-from-options` | `scripts/repair-service-prices-from-options.ts` | Reparación de precios `STANDARD` faltantes |
| `npm run cash:repair-legacy-closures -- [--execute] [--verbose]` | `scripts/repair-legacy-cash-closures.ts` | Normalización de cierres legacy |
| `npm run db:reset-production` | `scripts/reset-production.ts` | Reset destructivo de schema |
| `npm run seed:admin` | `scripts/seed-admin.ts` | Seed de roles y admin |
| `npm test` | `scripts/test-runner.mjs` + `scripts/ts-test-loader.mjs` | Infraestructura de tests |

## Priorizados

### `scripts/resync-ready-platform-today.ts`

- Nombre/comando:
  `npx tsx scripts/resync-ready-platform-today.ts`
- Finalidad:
  Resincroniza las `ReservationUnit` de reservas `READY_FOR_PLATFORM` del día actual que aún tienen unidades `WAITING`.
- Cuándo usarlo:
  Cuando la cola/plataforma muestra reservas de hoy sin las unidades operativas esperadas o con snapshots desalineados tras cambios en items, cantidad o servicio.
- Cuándo NO usarlo:
  Cuando el problema afecta días distintos de hoy.
  Cuando la reserva ya tiene unidades asignadas y el problema real está en `MonitorRunAssignment`.
  Cuando se necesita reparar una sola reserva con validación manual más fina.
- Dry-run:
  No.
- Ejemplo seguro:
  `npx tsx scripts/diagnose-ready-platform.ts`
  `npx tsx scripts/check-platform-queue-today.ts`
  `npx tsx scripts/resync-ready-platform-today.ts`
- Tablas/modelos que toca:
  `ReservationUnit` seguro.
  Lee `Reservation`, `ReservationItem`, `Service`, `ServiceOption`.
  Puede marcar unidades sobrantes como `CANCELED`, crear unidades faltantes y actualizar snapshots/estado de unidades existentes.
- Riesgos:
  No tiene alcance por `reservationId`; actúa sobre todas las reservas de hoy que cumplan el filtro.
  Puede cancelar unidades sobrantes si el estado actual de la reserva implica menos unidades requeridas que las existentes.
  Puede cambiar snapshots operativos que luego consumen cola y asignaciones.
- Verificación posterior:
  Reejecutar `npx tsx scripts/diagnose-ready-platform.ts` y confirmar que las unidades reflejan la realidad esperada.
  Reejecutar `npx tsx scripts/check-platform-queue-today.ts` y comprobar que bajan los casos “ready” sin cola.
  Revisar en UI/API de plataforma que la reserva entra en cola correctamente.
- Rollback/manual recovery:
  No tiene rollback automático.
  Si crea/cancela unidades de forma incorrecta, rehacer manualmente la reserva desde store o ajustar `ReservationUnit` con intervención técnica y validación por reserva.
  Guardar el JSON emitido por el script para comparar `before` y `after`.

### `scripts/restore-canceled-reservation.ts`

- Nombre/comando:
  `npm run reservation:restore-canceled -- --reservationId <id>`
  `npm run reservation:restore-canceled -- --reservationId <id> --apply`
- Finalidad:
  Restaura a `WAITING` una reserva `CANCELED` de `STORE`/`BOOTH` que todavía no entró en flujo operativo y no tiene pagos ni unidades.
- Cuándo usarlo:
  Cuando una reserva fue cancelada por error antes de generar unidades, cobros o eventos operativos y conserva contratos firmados compatibles con el caso reparable.
- Cuándo NO usarlo:
  Si la reserva no es `STORE` o `BOOTH`.
  Si tiene pagos, unidades, `formalizedAt`, `readyForPlatformAt`, trayecto taxiboat o timestamps operativos.
  Si no está en `CANCELED`.
- Dry-run:
  Sí, por defecto.
  Solo escribe con `--apply`.
- Ejemplo seguro:
  `npm run reservation:restore-canceled -- --reservationId <id>`
  Revisar `preview`.
  `npm run reservation:restore-canceled -- --reservationId <id> --apply`
- Tablas/modelos que toca:
  Lee `Reservation`, `Payment`, `ReservationUnit`, `ReservationContract`.
  Escribe solo `Reservation`.
- Riesgos:
  Reactiva una reserva cancelada; operación funcionalmente sensible aunque el cambio técnico sea pequeño.
  No reconstruye pagos, unidades ni contratos; si el caso real requería eso, este script no sirve.
- Verificación posterior:
  Confirmar que `status = WAITING`.
  Confirmar que sigue sin pagos y sin unidades.
  Validar en la UI que la reserva reaparece en el flujo correcto y puede formalizarse de nuevo.
- Rollback/manual recovery:
  Revertir manualmente dejando la reserva otra vez en `CANCELED`.
  Si se llegó a continuar flujo operativo después del restore, la recuperación deja de ser trivial y requiere análisis manual.

### `scripts/repair-service-prices-from-options.ts`

- Nombre/comando:
  `npm run pricing:repair-from-options`
- Finalidad:
  Crea `ServicePrice` `STANDARD` activos faltantes para `ServiceOption` activas con `basePriceCents > 0`, excluyendo servicios `JETSKI`.
- Cuándo usarlo:
  Cuando faltan precios vigentes por opción y eso bloquea cálculo o administración de pricing estándar.
- Cuándo NO usarlo:
  Si el problema es un precio incorrecto existente, no un precio faltante.
  Si hay que reparar precios de `JETSKI`.
  Si se necesita un `validFrom` histórico distinto de “ahora”.
- Dry-run:
  No.
- Ejemplo seguro:
  Revisar previamente en base de datos o admin qué opciones activas carecen de `ServicePrice` vigente.
  `npm run pricing:repair-from-options`
- Tablas/modelos que toca:
  Lee `ServiceOption`, `Service`.
  Lee y escribe `ServicePrice`.
- Riesgos:
  No permite limitar por servicio u opción concreta.
  Usa `validFrom = now()`, lo que puede no coincidir con la fecha histórica deseada.
  Puede crear precios que luego requieran limpieza manual si el dataset de opciones activas está mal.
- Verificación posterior:
  Confirmar el número de filas creadas y las opciones saltadas.
  Validar en admin/pricing que cada opción afectada tenga un `ServicePrice` activo `STANDARD`.
- Rollback/manual recovery:
  No tiene rollback.
  Borrar o desactivar manualmente los `ServicePrice` creados incorrectamente identificándolos por `validFrom` y ventana de ejecución.

### `scripts/repair-legacy-cash-closures.ts`

- Nombre/comando:
  `npm run cash:repair-legacy-closures`
  `npm run cash:repair-legacy-closures -- --execute`
  `npm run cash:repair-legacy-closures -- --execute --verbose`
- Finalidad:
  Normaliza cierres legacy diarios de `STORE` y `BAR`: anula duplicados activos y fuerza que el cierre canónico quede en turno `MORNING`, creando o enlazando `CashShift` si hace falta.
- Cuándo usarlo:
  Cuando existen cierres diarios duplicados o cierres legacy en turno no esperado que rompen listados, cierres o reporting.
- Cuándo NO usarlo:
  Si el origen no es `STORE` o `BAR`.
  Si el problema es un descuadre de importes y no de duplicidad/shift.
  Si ya hay un cierre `MORNING` legítimo distinto del canónico; en ese caso el script dejará `SKIP SHIFT`.
- Dry-run:
  Sí, por defecto.
  Solo escribe con `--execute`.
- Ejemplo seguro:
  `npm run cash:repair-legacy-closures -- --verbose`
  Revisar acciones `VOID`, `NORMALIZE` o `SKIP SHIFT`.
  `npm run cash:repair-legacy-closures -- --execute --verbose`
- Tablas/modelos que toca:
  Lee `CashClosure`.
  Escribe `CashClosure`.
  Puede crear o reutilizar `CashShift`.
- Riesgos:
  Marca cierres como anulados (`isVoided = true`), lo que impacta reporting y vistas administrativas.
  Cambia `shift` y `cashShiftId` del cierre canónico.
  No corrige importes calculados ni composición del cierre.
- Verificación posterior:
  Revisar el listado administrativo de cierres y confirmar un único cierre activo por `origin + businessDate`.
  Confirmar que los cierres diarios activos de `STORE`/`BAR` quedan en `MORNING` cuando procede.
  Si se usa `--verbose`, conservar el before/after de la consola.
- Rollback/manual recovery:
  Reapertura manual revirtiendo `isVoided`, `voidedAt`, `voidReason`, `shift` y `cashShiftId` solo con conocimiento exacto del estado previo.
  Si creó un `CashShift` innecesario, la limpieza también es manual.

### `scripts/check-platform-queue-today.ts`

- Nombre/comando:
  `npx tsx scripts/check-platform-queue-today.ts`
- Finalidad:
  Detecta `ReservationUnit` de hoy con estado `READY_FOR_PLATFORM` que no tienen asignaciones `QUEUED`/`ACTIVE` sobre runs `READY` o `IN_SEA`.
- Cuándo usarlo:
  Como diagnóstico rápido cuando la cola de plataforma parece vacía o incompleta frente a reservas formalizadas.
- Cuándo NO usarlo:
  Si el análisis debe cubrir fechas pasadas o futuras.
  Si el problema está en la reserva madre y no en las unidades.
- Dry-run:
  Sí; es solo lectura.
- Ejemplo seguro:
  `npx tsx scripts/check-platform-queue-today.ts`
- Tablas/modelos que toca:
  Lee `ReservationUnit`, `MonitorRunAssignment`, `MonitorRun`, `Reservation`.
- Riesgos:
  Ninguno de escritura.
  Puede dar falsos “pendientes” si el caso real depende de otro estado operativo fuera del filtro.
- Verificación posterior:
  Usar el JSON para identificar reservas fuente y luego contrastar en `diagnose-ready-platform.ts` o en UI.
- Rollback/manual recovery:
  No aplica; no modifica datos.

### `scripts/diagnose-ready-platform.ts`

- Nombre/comando:
  `npx tsx scripts/diagnose-ready-platform.ts`
- Finalidad:
  Emite un diagnóstico completo de reservas `READY_FOR_PLATFORM` de hoy con sus items, unidades y asignaciones activas de plataforma.
- Cuándo usarlo:
  Antes de ejecutar un resync, o cuando se necesita comparar la estructura esperada de unidades con la estructura real.
- Cuándo NO usarlo:
  Si solo se necesita un conteo rápido de huecos en cola; para eso `check-platform-queue-today.ts` es más directo.
- Dry-run:
  Sí; es solo lectura.
- Ejemplo seguro:
  `npx tsx scripts/diagnose-ready-platform.ts`
- Tablas/modelos que toca:
  Lee `Reservation`, `ReservationItem`, `ReservationUnit`, `MonitorRunAssignment`, `MonitorRun`, `Service`, `ServiceOption`.
- Riesgos:
  Ninguno de escritura.
  El output puede incluir datos de cliente y operación; tratarlo como información sensible.
- Verificación posterior:
  Conservar el JSON antes y después de un resync para validar diferencias.
- Rollback/manual recovery:
  No aplica; no modifica datos.

## Otros scripts operativos o de mantenimiento

### `scripts/inspect-last-canceled.ts`

- Nombre/comando:
  `npx tsx scripts/inspect-last-canceled.ts`
- Finalidad:
  Lista reservas `CANCELED` de `STORE`/`BOOTH` ordenadas por `createdAt` descendente.
- Cuándo usarlo:
  Para identificar candidatos a restauración o borrado manual.
- Cuándo NO usarlo:
  Si se necesita validar integridad operativa detallada; no inspecciona pagos, unidades ni contratos.
- Dry-run:
  Sí; es solo lectura.
- Ejemplo seguro:
  `npx tsx scripts/inspect-last-canceled.ts`
- Tablas/modelos que toca:
  Lee `Reservation`.
- Riesgos:
  Ninguno de escritura.
- Verificación posterior:
  Contrastar la reserva objetivo con `restore-canceled-reservation.ts` en dry-run antes de actuar.
- Rollback/manual recovery:
  No aplica.

### `scripts/delete-last-canceled.ts`

- Nombre/comando:
  `npx tsx scripts/delete-last-canceled.ts`
- Finalidad:
  Elimina en bloque todas las reservas `CANCELED` de `STORE`/`BOOTH` encontradas, incluyendo limpieza de relaciones legacy detectadas en la transacción.
- Cuándo usarlo:
  Solo en saneamiento extraordinario y con backup reciente, después de confirmar exactamente el conjunto de IDs a borrar.
- Cuándo NO usarlo:
  En operación normal.
  Si solo se quiere restaurar una reserva cancelada.
  Si no existe snapshot o backup recuperable.
- Dry-run:
  No.
  Aunque imprime las reservas detectadas, borra en la misma ejecución.
- Ejemplo seguro:
  `npx tsx scripts/inspect-last-canceled.ts`
  Confirmar IDs y backup.
  `npx tsx scripts/delete-last-canceled.ts`
- Tablas/modelos que toca:
  Lee y borra `Reservation`.
  Puede limpiar `ReservationItem`, `Payment`, `ReservationContract`, `Contract`, `FulfillmentTask`, `ReservationUnit`.
  Puede desvincular `GiftVoucher`, `PassConsume` y `ReservationItem.splitReservationId`.
- Riesgos:
  Es destructivo y de alcance masivo.
  No filtra “la última”; borra todas las canceladas `STORE`/`BOOTH` encontradas.
  La recuperación depende de backup o reconstrucción manual.
- Verificación posterior:
  Confirmar que ya no existen los IDs borrados.
  Revisar que no queden referencias colgantes en vouchers, consumos o items split.
- Rollback/manual recovery:
  Restauración desde backup/snapshot.
  Sin backup, la recuperación es manual y de alto coste.

### `scripts/seed-admin.ts`

- Nombre/comando:
  `npm run seed:admin`
- Finalidad:
  Garantiza roles base y crea/actualiza un usuario admin usando variables `SEED_ADMIN_*`.
- Cuándo usarlo:
  Tras reset de entorno o bootstrap controlado cuando falta admin.
- Cuándo NO usarlo:
  Como operación rutinaria en producción sin necesidad concreta.
  Si no se quiere rotar password del usuario objetivo.
- Dry-run:
  No.
- Ejemplo seguro:
  `SEED_ADMIN_PASSWORD=<secret> npm run seed:admin`
- Tablas/modelos que toca:
  Escribe `Role`, `User`, `UserRole`.
- Riesgos:
  Puede cambiar `fullName`, `passwordHash` e `isActive` del usuario con el mismo `username`.
- Verificación posterior:
  Confirmar login del admin sembrado y pertenencia a rol `ADMIN`.
- Rollback/manual recovery:
  Revertir manualmente credenciales o roles del usuario afectado.

### `scripts/reset-production.ts`

- Nombre/comando:
  `CONFIRM_RESET_PRODUCTION=YES_I_UNDERSTAND npm run db:reset-production`
- Finalidad:
  Borra y recrea el schema `public`.
- Cuándo usarlo:
  Solo en emergencias reales y con ventana de mantenimiento.
- Cuándo NO usarlo:
  En cualquier otro caso.
- Dry-run:
  No.
- Ejemplo seguro:
  Seguir [production-ops.md](/C:/dev/seariders-admin/docs/production-ops.md) y ejecutar el comando solo tras backup verificable.
- Tablas/modelos que toca:
  Todas las tablas del schema `public`.
- Riesgos:
  Pérdida total de datos del schema.
- Verificación posterior:
  `npx prisma migrate deploy`
  `npm run seed:admin`
  `npm run seed:faults`
  Validar login admin y rutas críticas.
- Rollback/manual recovery:
  Restaurar backup o snapshot completo de base de datos.

## Scripts de soporte de testing

### `scripts/test-runner.mjs`

- Nombre/comando:
  `npm test`
- Finalidad:
  Descubre e importa todos los `*.test.ts` bajo `src/`.
- Cuándo usarlo:
  En validación técnica local/CI.
- Cuándo NO usarlo:
  Como herramienta operativa sobre datos.
- Dry-run:
  No aplica; no muta datos por diseño propio, aunque los tests podrían hacerlo si estuvieran escritos así.
- Ejemplo seguro:
  `npm test`
- Tablas/modelos que toca:
  No toca modelos directamente; depende del contenido de los tests.
- Riesgos:
  Los riesgos dependen de los tests cargados.
- Verificación posterior:
  Confirmar suite verde.
- Rollback/manual recovery:
  No aplica al runner.

### `scripts/ts-test-loader.mjs`

- Nombre/comando:
  Invocado indirectamente por `npm test`.
- Finalidad:
  Resuelve imports TypeScript y alias `@/` para la suite de tests.
- Cuándo usarlo:
  Solo como infraestructura del runner.
- Cuándo NO usarlo:
  Como script operativo manual.
- Dry-run:
  No aplica.
- Ejemplo seguro:
  `npm test`
- Tablas/modelos que toca:
  Ninguno directamente.
- Riesgos:
  Ninguno operativo.
- Verificación posterior:
  Confirmar que los tests resuelven imports correctamente.
- Rollback/manual recovery:
  No aplica.

## Orden recomendado para incidencias de plataforma

1. Ejecutar `npx tsx scripts/diagnose-ready-platform.ts`.
2. Ejecutar `npx tsx scripts/check-platform-queue-today.ts`.
3. Si el problema es desalineación de unidades de hoy, ejecutar `npx tsx scripts/resync-ready-platform-today.ts`.
4. Repetir los dos diagnósticos y validar la UI de plataforma.

## Notas de alcance

- Este documento cubre todos los ficheros bajo `scripts/`.
- `package.json` también referencia scripts bajo `prisma/` como `seed:dev`, `seed:faults`, `prisma:seed` y `prisma:repair-legacy-assets`; quedan fuera de este runbook porque no viven en `scripts/`.
