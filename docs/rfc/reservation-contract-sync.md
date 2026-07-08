# RFC: motor de edicion de reservas y sincronizacion de contratos

Estado: borrador  
Fecha: 2026-06-30  
Alcance: diseno tecnico previo a implementacion.

Este documento define el comportamiento esperado del motor de edicion de reservas y sincronizacion de contratos. No propone cambios de Prisma en esta fase, no cambia endpoints y no modifica logica de codigo. Su objetivo es fijar reglas antes de tocar el motor de contratos.

---

## 1. Problema actual

La reserva y sus contratos pueden quedar desalineados cuando una reserva se edita despues de haber creado, preparado o firmado contratos. El contrato contiene datos derivados de la reserva, del conductor, del tipo de servicio, de la licencia, del recurso preparado y del HTML/PDF renderizado. Si la reserva cambia y esos datos no se sincronizan de forma consistente, aparecen varios problemas operativos:

- Contratos sueltos: quedan contratos activos para unidades que ya no existen, o faltan contratos para nuevas unidades despues de aumentar la cantidad.
- Bloqueos innecesarios: un contrato `READY` puede tratarse como si congelara la reserva, aunque aun no este firmado y por tanto deberia poder reconstruirse.
- PDFs antiguos: `renderedHtml`, `renderedPdfKey` y `renderedPdfUrl` pueden seguir apuntando a un documento generado antes de cambiar duracion, precio, licencia, tipo de actividad o recurso preparado.
- Recursos incompatibles: un contrato puede conservar `preparedJetskiId` al pasar a una actividad de barco, o `preparedAssetId` al volver a moto de agua.
- Duplicidad por unidad logica: si la sincronizacion solo crea contratos faltantes sin retirar los incompatibles, puede haber mas de un contrato visible para la misma unidad contractual.
- Riesgo de firma invalida: un usuario podria firmar un contrato `VOID`, superseded, antiguo, no perteneciente a la reserva activa o ya firmado si las guardas de firma no son estrictas.

El problema de fondo es que la reserva es editable y los contratos no firmados son artefactos derivados, pero el sistema necesita distinguir con claridad entre contratos reconstruibles y contratos firmados que ya son evidencia legal.

---

## 2. Principios de diseno

- La reserva es la fuente de verdad para unidades requeridas, actividad, licencia, duracion, precio y contexto operativo.
- Los contratos no firmados son reconstruibles. Un contrato `DRAFT` o `READY` puede conservar datos utiles del conductor, pero su HTML/PDF no debe considerarse definitivo si cambia algo material.
- `READY` no bloquea la edicion de la reserva. Significa que el contrato estaba completo para firmar en un momento dado, no que la reserva haya quedado congelada.
- `SIGNED` es inmutable. No se cambian estado, firma, contenido legal, conductor, snapshot renderizado ni PDF firmado de un contrato firmado.
- `VOID` o superseded no puede firmarse. Un contrato retirado de la vista activa queda como historico o basura logica no firmable.
- La UI muestra avisos y previews, pero las reglas viven en backend/helpers. El frontend no debe ser la autoridad de consistencia contractual.
- La sincronizacion debe ser determinista e idempotente: ejecutar el mismo plan dos veces no debe crear duplicados ni retirar contratos adicionales.
- La unidad contractual estable es `logicalUnitIndex`. `unitIndex` puede seguir existiendo como identificador fisico/versionado.

---

## 3. Estados de contrato

| Estado | Significado | Permite | Bloquea |
| --- | --- | --- | --- |
| `DRAFT` | Contrato incompleto o pendiente de revisar. Es reconstruible. | Editar datos de conductor, licencia, recurso preparado y datos derivados; regenerar HTML/PDF; ser invalidado por sincronizacion. | Firma publica o interna directa si no pasa validaciones de `READY`. |
| `READY` | Contrato completo y listo para firma segun las reglas actuales. Sigue siendo reconstruible mientras no este firmado. | Firmar si todas las guardas pasan; editar la reserva; limpiar render antiguo; volver a `DRAFT` si cambian requisitos; ser invalidado si queda incompatible. | No debe bloquear edicion de reserva. No puede firmarse si queda superseded, `VOID`, fuera de rango o con token invalido. |
| `SIGNED` | Contrato firmado y evidencia legal. | Consultar, descargar, contar como firmado y conservar historico. Puede impedir ediciones materiales que lo contradigan. | Cualquier modificacion de contenido legal, firma, estado contractual, conductor o PDF firmado. No se reemplaza silenciosamente. |
| `VOID` / superseded | Contrato retirado de la vista activa. `VOID` aplica a contratos no firmados invalidados; superseded marca una version historica no visible. | Auditoria, trazabilidad y exclusion de la vista activa. | Firma, conteo como contrato activo, reutilizacion para una unidad requerida y render como documento vigente. |

Notas:

- `VOID` es un estado explicito.
- `supersededAt` es una marca de versionado/visibilidad. Cualquier contrato con `supersededAt` no debe considerarse activo, aunque su `status` no sea `VOID`.
- Un contrato `SIGNED` historico superseded solo debe existir por un flujo legal/administrativo explicito. La edicion normal de reservas no debe retirar firmas sin una regla de negocio clara y auditada.

---

## 4. Reglas de edicion

### Aumentar unidades

Al aumentar unidades, el backend recalcula `requiredUnits` desde la reserva actual. Los contratos activos compatibles de las unidades existentes se conservan. Para cada nuevo `logicalUnitIndex` requerido sin contrato activo visible, se crea un contrato `DRAFT`.

No se reordenan contratos firmados ni se cambia su unidad logica. Los nuevos contratos deben usar los siguientes `logicalUnitIndex` libres dentro de `1..requiredUnits`.

### Reducir unidades

Al reducir unidades, los slots fuera del nuevo rango `1..requiredUnits` dejan de ser activos.

- Si los contratos retirados son `DRAFT` o `READY`, se marcan como `VOID` y `supersededAt`.
- Si algun contrato retirado esta `SIGNED`, la edicion se bloquea en el flujo normal.
- Si hay contratos no firmados con render generado en slots conservados y el cambio afecta al contenido legal, se limpian `renderedHtml`, `renderedPdfKey` y `renderedPdfUrl`.

### Reducir por debajo de contratos firmados

No se puede reducir por debajo de los contratos firmados activos. La regla debe vivir en backend y devolver un error de negocio claro.

La UI debe mostrar: "No puedes reducir por debajo de contratos firmados".

Esta regla evita que una reserva visible diga que requiere menos unidades que las ya aceptadas legalmente. Si negocio necesita cancelar o anular una unidad firmada, debe existir un flujo separado de cancelacion, reembolso o auditoria, no una edicion silenciosa de cantidad.

### Cambiar `JETSKI` / `BOAT`

Cambiar la categoria material de la actividad puede cambiar plantilla, deposito, recurso preparado y requisitos de licencia.

- Si no hay contratos firmados activos, los contratos `DRAFT`/`READY` incompatibles se invalidan y se crean los contratos faltantes segun el nuevo `requiredUnits`.
- Si hay contratos firmados activos que quedarian contradichos por el cambio, la edicion material se bloquea o debe desviarse a un flujo administrativo explicito.
- Si el contrato queda en modo moto de agua, se limpia `preparedAssetId` incompatible.
- Si el contrato queda en modo barco, se limpia `preparedJetskiId` incompatible.

### Cambiar licencia

Cambiar `isLicense`, `jetskiLicenseMode`, `licenseSchool`, `licenseType` o `licenseNumber` es material cuando afecta al tipo de contrato, a validaciones de `READY` o al texto legal.

- En contratos no firmados, se conserva solo lo compatible y se limpian renders antiguos.
- Si el cambio obliga a pedir datos de licencia que antes no existian, los contratos afectados deben volver a `DRAFT` hasta completar validaciones.
- Un contrato firmado no puede reinterpretarse como con licencia o sin licencia despues de firmado.

### Cambiar duracion/precio

Duracion, opcion contratada, tarifa, descuentos, precio total, deposito y cualquier campo impreso o inferido por el contrato son cambios materiales.

- Contratos `DRAFT`/`READY` activos pueden conservarse si la unidad logica y el tipo contractual siguen siendo compatibles.
- Siempre que el contenido renderizado pueda cambiar, se limpian `renderedHtml`, `renderedPdfKey` y `renderedPdfUrl` en contratos no firmados.
- Si el contrato estaba `READY`, puede mantenerse `READY` solo si las validaciones siguen pasando y el sistema garantiza render fresco antes de firmar. Si no, vuelve a `DRAFT`.
- Contratos `SIGNED` no cambian. Si el cambio contradice el contrato firmado activo, la edicion debe bloquearse o pasar por un flujo legal separado.

### Cambiar recurso preparado

El recurso preparado forma parte del contexto mostrado al cliente si aparece en el contrato o en el check-in.

- Cambiar `preparedJetskiId` o `preparedAssetId` en contratos no firmados es valido si el recurso es compatible con la categoria actual.
- Al cambiar el recurso preparado de un contrato no firmado, se limpian los renders antiguos.
- Si cambia la categoria de la reserva, se limpia cualquier recurso preparado incompatible.
- Si el contrato esta firmado, no se cambia el recurso firmado. La asignacion operacional real debe resolverse fuera del contrato firmado si negocio lo permite.

### Editar con contratos `READY`

Editar con contratos `READY` esta permitido. El backend debe planificar el impacto:

- Si el cambio no es material para el contrato, el contrato puede seguir `READY`.
- Si el cambio altera contenido renderizado, se limpian los renders no firmados.
- Si el cambio altera requisitos de validacion, el contrato vuelve a `DRAFT`.
- Si el cambio altera tipo contractual o unidad logica, el contrato se invalida como `VOID`/superseded y se crea uno nuevo si sigue faltando una unidad.

### Editar con contratos `SIGNED`

Editar con contratos `SIGNED` esta permitido solo para cambios que no contradigan el contrato firmado activo.

Permitido:

- Aumentar unidades.
- Editar datos operativos no impresos ni legales.
- Cambios administrativos que no alteren el contenido firmado.

Bloqueado en el flujo normal:

- Reducir por debajo de contratos firmados activos.
- Retirar una unidad cuyo contrato activo esta firmado.
- Cambiar categoria, licencia, duracion, precio o recurso preparado si eso contradice el contrato firmado.
- Reutilizar un contrato firmado para otra unidad logica o version material.

---

## 5. Reglas de sincronizacion

El comportamiento objetivo de `syncReservationContracts` debe separarse en dos pasos:

1. Planificacion pura: calcular que debe pasar sin escribir en base de datos.
2. Aplicacion transaccional: aplicar el plan de forma idempotente.

### Calcular `requiredUnits`

`requiredUnits` se calcula en backend desde la reserva persistida o desde el snapshot validado de la edicion. No se acepta como verdad desde la UI.

La regla actual esperada es:

- Sumar unidades principales que requieran contrato.
- `JETSKI` requiere contrato.
- `BOAT` requiere contrato cuando aplica licencia o cuando las reglas de negocio lo indiquen.
- Extras, bar y elementos no contractuales no deben aumentar `requiredUnits`.
- El resultado minimo es `0`.

### Conservar `SIGNED`

Los contratos `SIGNED` se conservan siempre. No se modifican campos legales, firma, render firmado, conductor ni estado.

Si un cambio de reserva haria incompatible un `SIGNED` activo, el plan debe bloquear la edicion en lugar de mutar el contrato. Solo un flujo administrativo explicito podria marcarlo como historico superseded, con auditoria y sin tocar su contenido legal.

### Conservar `DRAFT`/`READY` compatibles

Un contrato no firmado es compatible si:

- No tiene `supersededAt`.
- No esta `VOID`.
- Su `logicalUnitIndex` esta dentro de `1..requiredUnits`.
- Su tipo contractual sigue correspondiendo a la reserva actual.
- Sus requisitos de licencia siguen siendo validos.
- Su recurso preparado, si existe, es compatible con la categoria actual.
- No representa un snapshot materialmente distinto que deba ser reemplazado.

Los contratos compatibles pueden mantenerse para preservar datos de conductor y reducir trabajo operativo.

### Invalidar `DRAFT`/`READY` incompatibles

Un contrato no firmado incompatible se marca como retirado:

- `status = VOID`.
- `supersededAt = now`.
- `preparedJetskiId = null` si no aplica.
- `preparedAssetId = null` si no aplica.
- Debe quedar fuera de listados activos, firma publica y conteos `readyCount`.

La invalidacion debe ser preferible a borrar filas, para conservar trazabilidad y evitar que enlaces antiguos apunten a un contrato firmable.

### Crear contratos faltantes

Despues de conservar e invalidar, el motor calcula los `logicalUnitIndex` faltantes en `1..requiredUnits`.

Para cada slot faltante:

- Crear un nuevo contrato `DRAFT`.
- Asignar `logicalUnitIndex = slot`.
- Asignar `unitIndex` fisico/versionado sin colisionar con los existentes.
- No copiar render antiguo.
- Copiar datos de conductor solo si hay una regla explicita y segura para hacerlo.

### Limpiar render en contratos no firmados

Cuando cambia algo material para el contrato, todo contrato no firmado conservado debe limpiar:

- `renderedHtml`.
- `renderedPdfKey`.
- `renderedPdfUrl`.

El objeto antiguo en almacenamiento externo puede quedar para limpieza posterior, pero el contrato activo no debe apuntar a el.

Cambios materiales incluyen, como minimo:

- Categoria `JETSKI`/`BOAT`.
- Licencia o modo de licencia.
- Duracion, opcion, precio, deposito o plantilla.
- Fecha/hora si aparece en el contrato.
- Cliente o datos legales base usados en render.
- Recurso preparado mostrado en contrato/check-in.
- Version de plantilla.

### Limpiar recurso preparado incompatible

La sincronizacion debe limpiar recursos incompatibles en contratos no firmados:

- Si el contrato queda en contexto `JETSKI`, no debe conservar `preparedAssetId` de barco.
- Si el contrato queda en contexto `BOAT`, no debe conservar `preparedJetskiId`.
- Si el recurso ya no existe, no esta disponible o no pertenece al tipo esperado, se limpia.

En contratos firmados, no se cambia el recurso firmado. Si el recurso firmado ya no coincide con la operativa, se debe tratar como excepcion administrativa.

### Devolver plan aplicado

`syncReservationContracts` debe devolver un resumen estructurado del plan aplicado, util para UI, logs y tests:

| Campo | Significado |
| --- | --- |
| `requiredUnits` | Unidades contractuales requeridas tras la edicion. |
| `keptContractIds` | Contratos activos conservados. |
| `createdContractIds` | Contratos nuevos creados. |
| `invalidatedContractIds` | Contratos no firmados marcados `VOID`/superseded. |
| `renderClearedContractIds` | Contratos no firmados cuyo HTML/PDF fue limpiado. |
| `preparedResourceClearedContractIds` | Contratos cuyo recurso preparado incompatible fue limpiado. |
| `signedContractIds` | Contratos firmados encontrados y preservados. |
| `blockedReason` | Motivo de bloqueo si el plan no puede aplicarse. |
| `warnings` | Avisos mostrables por UI sin ser fuente de verdad. |

---

## 6. Carril B0: ajustes comerciales

Carril B0 define la politica comercial para ajustar una reserva ya creada. En esta fase el RFC solo fija contrato funcional y tecnico: no implica cambios de Prisma, no crea endpoints y no modifica codigo de aplicacion.

El ajuste comercial es independiente del historico legal de pagos y contratos. La reserva puede necesitar un nuevo total comercial, pero los pagos existentes y los contratos firmados no se reescriben.

### Concepto `CommercialAdjustment`

Aunque no se implemente todavia, el modelo logico de auditoria debe representar cada decision comercial aplicada o pendiente sobre una reserva:

| Campo | Significado |
| --- | --- |
| `id` | Identificador unico del ajuste comercial. |
| `reservationId` | Reserva afectada. |
| `oldTotalCents` | Total comercial de servicio antes del ajuste. |
| `newTotalCents` | Total comercial de servicio despues del ajuste. |
| `paidServiceCents` | Importe neto historico de dinero real `IN/OUT` aplicado al servicio, calculado desde movimientos `Payment` existentes. No incluye cobertura de gift, pass ni voucher. |
| `coveredServiceCents` | Importe de servicio cubierto por gift, pass o voucher. Es cobertura comercial/prepagada, no un pago cash normal de la reserva. |
| `chargeableNewTotalCents` | Importe realmente cobrable tras aplicar cobertura: `max(newTotalCents - coveredServiceCents, 0)`. |
| `overpaidServiceCents` | Sobrepago de servicio tras el ajuste: `max(paidServiceCents - chargeableNewTotalCents, 0)`. |
| `pendingServiceCents` | Pendiente de cobrar tras el ajuste: `max(chargeableNewTotalCents - paidServiceCents, 0)`. |
| `refundMode` | Decision sobre el sobrepago: sin devolucion, devolucion real inmediata, devolucion pendiente o credito futuro reservado. |
| `reason` | Motivo obligatorio del ajuste. |
| `status` | Estado del ajuste: aplicado, pendiente de devolucion, devuelto o anulado. |
| `createdByUserId` | Usuario operador que confirma el ajuste. |
| `createdAt` | Fecha de creacion del ajuste. |

`CommercialAdjustment` no sustituye a `Payment`. Es una decision comercial/auditable; el dinero real sigue representado por movimientos `Payment`.

### Vouchers, passes y gifts

Gift vouchers, pass vouchers y consumos de bonos no deben compararse como si fueran pagos cash normales de la reserva. Cubren todo o parte del servicio con un derecho adquirido previamente o con un flujo propio de prepago, por lo que no forman parte de `paidServiceCents`.

Separacion obligatoria de importes:

- `paidServiceCents`: dinero real que entro o salio en la reserva mediante `Payment IN/OUT` de servicio.
- `coveredServiceCents`: importe de servicio cubierto por `giftVoucherId`, `passVoucherId`, `passConsumeId` u otro mecanismo equivalente de gift/pass/voucher.
- `chargeableNewTotalCents`: importe realmente cobrable al cliente despues de restar `coveredServiceCents` al nuevo total comercial.

En fase 1, cualquier reserva con `giftVoucherId`, `passVoucherId` o `passConsumeId` bloquea el ajuste comercial normal de Carril B0. Debe requerir un flujo especifico de gift/pass/voucher que preserve la contabilidad del prepago, el consumo del bono y la trazabilidad de la cobertura.

### Motivo obligatorio

Todo ajuste debe tener un motivo obligatorio elegido de un catalogo cerrado:

- `reduccion_motos`: reduccion de motos.
- `cambio_actividad`: cambio de actividad.
- `mal_tiempo`: mal tiempo.
- `error_operador`: error operador.
- `incidencia_cliente`: incidencia cliente.
- `compensacion`: compensacion.
- `otro`: otro.

El commit debe rechazar ajustes sin motivo. Preview puede calcular importes sin persistir, pero la confirmacion no debe avanzar sin `reason`.

### Regla de pagos historicos

Los pagos historicos son asientos de caja y no se modifican nunca.

Campos prohibidos de editar en pagos existentes:

- `amountCents`.
- `direction`.
- `method`.
- `createdAt`.

Si el ajuste genera mas importe a cobrar, se crea un nuevo `Payment` `IN` cuando entra dinero real. Si el ajuste genera devolucion real, se crea un nuevo `Payment` `OUT` cuando sale dinero real. No se corrigen pagos antiguos para "cuadrar" el total nuevo.

### Endpoint legacy `financial-adjustment`

`/api/admin/reservations/[id]/financial-adjustment` queda deprecated para operaciones normales de tienda.

No debe usarse como implementacion de Carril B0 porque pertenece al flujo legacy y puede mutar pagos historicos para cuadrar importes. Carril B0 define un flujo nuevo: no modifica `Payment` antiguos y solo crea nuevos `Payment IN/OUT` cuando hay entrada o salida real de dinero.

Mientras el endpoint legacy exista, debe tratarse como una excepcion administrativa de alto riesgo y no como camino normal de operacion.

### Pending refund

Si existe sobrepago pero no se devuelve en ese momento, debe quedar registrado como devolucion pendiente.

Reglas:

- `overpaidServiceCents > 0` no implica crear automaticamente un `Payment OUT`.
- Si no hay salida real de caja, el ajuste queda con `refundMode = PENDING_REFUND` y `status = PENDING_REFUND`.
- El sistema debe poder listar o resolver devoluciones pendientes en un flujo posterior.
- El `Payment OUT` se crea solo cuando el dinero sale realmente de caja o del metodo de pago correspondiente.

Esto evita que caja, cierres y auditoria reflejen una salida que aun no ocurrio.

### Credit

Credito queda documentado como concepto futuro, pero no se implementa en fase 1.

En fase 1:

- No se crea saldo a favor reutilizable.
- No se descuenta automaticamente una reserva futura.
- No se usa credito para ocultar una devolucion pendiente.

Si negocio decide soportarlo, `refundMode` podra reservar un valor de credito futuro, respaldado por modelo contable propio, permisos, caducidad y trazabilidad.

### Contratos `SIGNED`

Un contrato `SIGNED` nunca se modifica por un ajuste comercial.

Cancelar o ajustar una reserva firmada conserva el contrato firmado como historico legal. No se cambian estado, firma, conductor, contenido legal, HTML/PDF firmado, recurso firmado ni snapshots renderizados. Si la politica comercial permite ajustar o cancelar la reserva, el ajuste queda como hecho comercial posterior; el contrato firmado sigue siendo evidencia de lo que el cliente acepto en su momento.

Si el ajuste contradice contenido firmado y negocio necesita reflejarlo legalmente, debe existir un flujo legal/administrativo separado. Carril B0 no reutiliza ni reescribe contratos firmados.

### Helper unico de politica

`resolveCommercialAdjustmentPolicy` debe ser la fuente unica de decision para ajustes comerciales.

Responsabilidades del helper:

- Recibir snapshot de reserva, total anterior, total propuesto, pagos historicos relevantes, contratos firmados existentes, motivo y modo de devolucion solicitado.
- Calcular `oldTotalCents`, `newTotalCents`, `paidServiceCents`, `coveredServiceCents`, `chargeableNewTotalCents`, `overpaidServiceCents` y `pendingServiceCents`.
- Decidir si el ajuste esta permitido, bloqueado o permitido con avisos.
- Bloquear en fase 1 el ajuste normal si la reserva tiene `giftVoucherId`, `passVoucherId` o `passConsumeId`.
- Decidir si corresponde `Payment IN`, `Payment OUT`, devolucion pendiente o ningun movimiento de caja.
- Preservar la regla de no mutar pagos historicos.
- Preservar la regla de no mutar contratos `SIGNED`.
- Devolver un resultado estructurado consumible por preview, commit, logs y tests.

Preview y commit deben usar el mismo helper. Commit debe recalcular la politica dentro del contexto transaccional o con datos recien leidos, y no confiar ciegamente en un preview antiguo.

### Flujo esperado

El flujo de ajuste comercial es:

1. `resolveCommercialAdjustmentPolicy`.
2. Preview para mostrar impacto: total anterior, total nuevo, cobertura, importe cobrable, pendiente de cobro, sobrepago, devolucion pendiente o movimiento de caja previsto.
3. Confirmacion explicita con motivo obligatorio y modo de devolucion.
4. Commit: aplicar cambio comercial, crear solo nuevos movimientos `Payment IN/OUT` cuando haya dinero real, registrar ajuste y conservar historicos.

---

## 7. Invariantes

- No hay mas de un contrato activo por unidad logica. Activo significa `supersededAt = null`, `status != VOID` y `logicalUnitIndex` dentro de `1..requiredUnits`.
- `SIGNED` nunca cambia su estado, contenido legal, firma, conductor, render ni PDF firmado.
- `Payment` historicos no se mutan por Carril B0; todo dinero real posterior se representa con nuevos `Payment IN/OUT`.
- Gift/pass/voucher no cuenta como pago cash normal: `paidServiceCents` solo refleja dinero real y la cobertura va en `coveredServiceCents`.
- Reservas con `giftVoucherId`, `passVoucherId` o `passConsumeId` bloquean en fase 1 el ajuste comercial normal y requieren flujo especifico.
- `VOID`/superseded nunca se firma.
- `requiredUnits` debe coincidir con contratos activos visibles, salvo historicos firmados superseded.
- Los contratos no firmados no deben conservar PDF/render antiguo tras cambios materiales.
- Los contratos nuevos deben tener `logicalUnitIndex` estable.
- `readyCount` solo cuenta contratos visibles `READY` o `SIGNED` dentro de `1..requiredUnits`.
- La firma solo puede operar sobre el contrato visible vigente para su unidad logica.
- La sincronizacion debe ser idempotente.
- Los errores de bloqueo deben ocurrir antes de escribir cambios parciales.
- Los pagos historicos no se modifican: cualquier cobro o devolucion real posterior se representa con nuevos movimientos `Payment IN/OUT`.
- Todo ajuste comercial confirmado tiene motivo obligatorio.
- Un sobrepago no devuelto debe quedar como devolucion pendiente, no como `Payment OUT` ficticio.

---

## 8. Seguridad de firma

`saveContractSignature` debe aplicar guardas estrictas antes de subir firma, cambiar estado o regenerar PDF firmado.

Guardas obligatorias:

- El contrato existe.
- El contrato pertenece a una reserva activa.
- La reserva existe y esta activa.
- El contrato no esta `VOID`.
- El contrato no tiene `supersededAt`.
- El contrato no esta firmado (`signedAt` nulo y estado distinto de `SIGNED`).
- El contrato esta `READY`.
- El token de firma es valido, no expirado y corresponde a la reserva/contrato esperado.
- El contrato visible sigue dentro de `1..requiredUnits` para la reserva actual.

Guardas recomendadas:

- El HTML/PDF que se firmara fue generado desde la version actual de la reserva.
- Si `renderedHtml` o `renderedPdfKey` faltan, se regeneran desde datos actuales antes de firmar.
- La validacion de conductor, documento, nacimiento, licencia y autorizacion de menor sigue pasando.
- La operacion completa ocurre en transaccion o con una estrategia que evite doble firma concurrente.

Errores esperados:

- Contrato inexistente: `404` o error equivalente.
- Contrato no firmable por estado: `409`.
- Token invalido o expirado: `401`/`403`.
- Reserva inactiva o cancelada: `409`.

---

## 9. UX recomendada

La UI debe anticipar impactos, pero el backend decide.

Mensajes recomendados:

- "Se crearán X contratos nuevos"
- "Se invalidarán X contratos no firmados"
- "No puedes reducir por debajo de contratos firmados"
- "Este cambio invalida PDFs no firmados"

Comportamiento recomendado:

- Antes de guardar cambios materiales, mostrar un preview del plan si el backend expone endpoint/helper de previsualizacion.
- Diferenciar avisos bloqueantes de avisos informativos.
- En reservas con contratos `READY`, no impedir editar; avisar que el cambio puede invalidar renders o devolver contratos a `DRAFT`.
- En reservas con contratos `SIGNED`, mostrar claramente que los contratos firmados no se modificaran y que ciertas ediciones pueden bloquearse.
- En ajustes comerciales, mostrar siempre total anterior, total nuevo, pagado historico, pendiente de cobro, sobrepago y devolucion pendiente si aplica.
- No mostrar una devolucion como ejecutada hasta que exista `Payment OUT` real.
- Tras guardar, refrescar contratos desde backend y no confiar en estado local anterior.

---

## 10. Tests imprescindibles

Antes de implementar, deben existir tests que cubran como minimo:

- `computeRequiredContractUnits` para `JETSKI`, `BOAT` con licencia, `BOAT` sin licencia, extras y cantidad cero.
- Plan puro: aumentar unidades crea slots faltantes sin tocar contratos existentes.
- Plan puro: reducir unidades invalida `DRAFT`/`READY` fuera de rango.
- Plan puro: reducir unidades bloquea si retiraria un `SIGNED`.
- Plan puro: reducir por debajo de contratos firmados activos devuelve bloqueo.
- Plan puro: no crea mas de un contrato activo por `logicalUnitIndex`.
- Sincronizacion idempotente: ejecutar dos veces no crea duplicados ni cambia contadores.
- Cambio `JETSKI` -> `BOAT` limpia `preparedJetskiId` en contratos no firmados compatibles o invalida los incompatibles.
- Cambio `BOAT` -> `JETSKI` limpia `preparedAssetId` en contratos no firmados compatibles o invalida los incompatibles.
- Cambio de licencia limpia render y devuelve a `DRAFT` cuando faltan datos obligatorios.
- Cambio de duracion/precio limpia `renderedHtml`, `renderedPdfKey` y `renderedPdfUrl` en no firmados.
- Contrato `READY` no bloquea edicion y queda sincronizado correctamente.
- Contrato `SIGNED` no se muta ante una edicion permitida.
- Contrato `SIGNED` bloquea una edicion material incompatible.
- `saveContractSignature` rechaza contrato inexistente.
- `saveContractSignature` rechaza contrato `VOID`.
- `saveContractSignature` rechaza contrato con `supersededAt`.
- `saveContractSignature` rechaza contrato ya firmado.
- `saveContractSignature` rechaza contrato `DRAFT`.
- `saveContractSignature` rechaza token invalido, expirado o de otra reserva.
- `saveContractSignature` rechaza reserva cancelada/inactiva.
- Firma concurrente: dos intentos simultaneos no generan doble firma ni estados inconsistentes.
- Endpoints de update/ensure aplican el helper y devuelven `requiredUnits`, `readyCount` y plan aplicado coherente.
- Listados publicos y de tienda excluyen contratos `VOID`/superseded de la vista activa.
- `resolveCommercialAdjustmentPolicy` calcula `chargeableNewTotalCents` descontando `coveredServiceCents` antes de comparar contra `paidServiceCents`.
- `resolveCommercialAdjustmentPolicy` calcula pendiente de cobro cuando `chargeableNewTotalCents > paidServiceCents`.
- `resolveCommercialAdjustmentPolicy` calcula sobrepago cuando `paidServiceCents > chargeableNewTotalCents`.
- Ajuste con sobrepago y sin salida real queda como devolucion pendiente y no crea `Payment OUT`.
- Ajuste con devolucion real crea nuevo `Payment OUT` sin mutar pagos historicos.
- Ajuste con importe adicional crea nuevo `Payment IN` solo cuando entra dinero real.
- Ajuste sin motivo obligatorio se bloquea en commit.
- Ajuste sobre reserva con contrato `SIGNED` conserva contrato firmado sin mutarlo.
- Preview y commit usan la misma politica y devuelven importes coherentes.

---

## 11. Plan de implementacion por fases

### Fase 1: blindar firma

- Endurecer `saveContractSignature` con guardas de existencia, reserva activa, estado `READY`, no `VOID`, no superseded, no firmado y token valido.
- Asegurar que la firma solo opera sobre el contrato activo visible.
- Agregar tests de rechazo antes de tocar sincronizacion.

### Fase 2: helper puro de planificacion

- Crear un helper puro que reciba snapshot de reserva y contratos existentes.
- Devolver un plan sin escribir en base de datos.
- Cubrir con tests unitarios los escenarios de aumento, reduccion, incompatibilidad, renders y recursos preparados.

### Carril B0: politica de ajustes comerciales

- Definir `resolveCommercialAdjustmentPolicy` como helper puro antes de exponer preview o commit.
- Usar el mismo helper para preview y commit.
- Mantener pagos historicos inmutables y representar dinero real solo con nuevos `Payment IN/OUT`.
- Separar dinero real (`paidServiceCents`) de cobertura gift/pass/voucher (`coveredServiceCents`) y calcular el cobrable real con `chargeableNewTotalCents`.
- Bloquear en fase 1 los ajustes normales sobre reservas con `giftVoucherId`, `passVoucherId` o `passConsumeId`.
- Excluir `/api/admin/reservations/[id]/financial-adjustment` del Carril B0 y documentarlo como legacy/deprecated para tienda.
- Registrar sobrepagos no devueltos como devolucion pendiente.
- Dejar credito fuera de fase 1, solo como concepto futuro documentado.
- Conservar contratos `SIGNED` como historico legal ante ajustes o cancelaciones permitidas por negocio.

### Fase 3: aplicar sync en update/ensure

- Usar el helper en los flujos de update y ensure.
- Aplicar el plan dentro de transaccion.
- Devolver resumen aplicado para UI y logs.
- Mantener compatibilidad con campos actuales, sin cambios de Prisma en esta fase.

### Fase 4: UI de preview/avisos

- Mostrar preview de contratos creados, invalidados y renders limpiados.
- Avisar cuando una edicion afecte PDFs no firmados.
- Bloquear visualmente reducciones por debajo de contratos firmados, sin depender de la UI como autoridad.

### Fase 5: limpieza y auditoria

- Revisar listados para asegurar que `VOID`/superseded no aparecen como activos.
- Auditar enlaces publicos antiguos.
- Revisar objetos PDF antiguos sin referencia para posible limpieza diferida.
- Documentar flujos administrativos para historicos firmados superseded si negocio los requiere.

---

## 12. Decisiones abiertas

- Definir si se necesita almacenar un hash/fingerprint material del contrato en una fase posterior o si basta con limpiar renders de forma conservadora cuando update detecta cambios materiales.
- Definir el flujo legal para una unidad firmada que negocio quiera cancelar, retirar o sustituir. No debe mezclarse con la edicion normal de cantidad.
- Definir si `READY` debe volver siempre a `DRAFT` ante cualquier cambio material o si puede mantenerse `READY` cuando las validaciones siguen pasando y el render se regenera antes de firma.
- Definir si el recurso preparado firmado representa compromiso legal o solo informacion operativa mostrada al cliente.
- Definir el detalle exacto de "reserva activa" para firma: estados permitidos, por ejemplo `SCHEDULED`, `WAITING` y `READY_FOR_PLATFORM`, y estados bloqueados como `CANCELED` o `COMPLETED`.
- Definir los valores finales de `refundMode` y `status` para `CommercialAdjustment`.
- Definir si el motivo `otro` requiere un texto libre adicional obligatorio.
- Definir como se listan, autorizan y cierran las devoluciones pendientes.
- Definir la separacion exacta entre importes de servicio, fianza, extras, bar y otros conceptos para calcular `paidServiceCents`.
- Definir el flujo especifico para ajustar reservas con gift/pass/voucher: cobertura parcial, devolucion del prepago, reversa de consumo y efectos sobre `coveredServiceCents`.
- Definir el modelo futuro de credito, si negocio lo aprueba: saldo, caducidad, permisos, uso parcial y auditoria.
- Definir que ajustes comerciales sobre reservas con `SIGNED` se permiten sin flujo legal adicional y cuales deben bloquearse.
- Definir si el endpoint legacy `/api/admin/reservations/[id]/financial-adjustment` debe eliminarse, protegerse por permisos reforzados o quedar solo como herramienta administrativa temporal.

---

## 13. Riesgos pendientes

- Compatibilidad con datos legacy que tengan `logicalUnitIndex` nulo o contratos visibles duplicados.
- Enlaces publicos antiguos que apunten a contratos ahora superseded.
- Limpieza de PDFs antiguos en S3: limpiar referencias es inmediato, borrar objetos debe ser diferido y auditable.
- Concurrencia entre update de reserva, ensure de contratos y firma publica.
- Ambiguedad si un cambio de precio/duracion ocurre despues de firma pero antes de operar la reserva.
- Posible diferencia entre unidad contractual y unidad operacional de plataforma.
- Crear `Payment OUT` antes de una salida real de caja descuadraria cierres y auditoria.
- Mutar pagos historicos romperia trazabilidad contable y podria invalidar cierres previos.
- Doble commit concurrente de un ajuste podria duplicar cobros, devoluciones o pendientes si no hay guardas transaccionales.
- Clasificar mal `paidServiceCents` puede mezclar servicio con fianzas, bar o extras y producir saldos incorrectos.
- Tratar gift/pass/voucher como pago cash normal podria cobrar o devolver importes incorrectos porque mezcla dinero real de la reserva con cobertura prepagada.
- Mientras `/api/admin/reservations/[id]/financial-adjustment` exista, un uso manual puede romper las invariantes de Carril B0 al mutar pagos historicos.
- Las devoluciones pendientes pueden quedar olvidadas si no existe vista operativa, responsable y cierre explicito.
- Ajustar comercialmente una reserva firmada sin comunicar bien el historico legal puede generar discrepancias entre operacion, cliente y contrato conservado.
