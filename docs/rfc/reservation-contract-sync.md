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

## 6. Invariantes

- No hay mas de un contrato activo por unidad logica. Activo significa `supersededAt = null`, `status != VOID` y `logicalUnitIndex` dentro de `1..requiredUnits`.
- `SIGNED` nunca cambia su estado, contenido legal, firma, conductor, render ni PDF firmado.
- `VOID`/superseded nunca se firma.
- `requiredUnits` debe coincidir con contratos activos visibles, salvo historicos firmados superseded.
- Los contratos no firmados no deben conservar PDF/render antiguo tras cambios materiales.
- Los contratos nuevos deben tener `logicalUnitIndex` estable.
- `readyCount` solo cuenta contratos visibles `READY` o `SIGNED` dentro de `1..requiredUnits`.
- La firma solo puede operar sobre el contrato visible vigente para su unidad logica.
- La sincronizacion debe ser idempotente.
- Los errores de bloqueo deben ocurrir antes de escribir cambios parciales.

---

## 7. Seguridad de firma

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

## 8. UX recomendada

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
- Tras guardar, refrescar contratos desde backend y no confiar en estado local anterior.

---

## 9. Tests imprescindibles

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

---

## 10. Plan de implementacion por fases

### Fase 1: blindar firma

- Endurecer `saveContractSignature` con guardas de existencia, reserva activa, estado `READY`, no `VOID`, no superseded, no firmado y token valido.
- Asegurar que la firma solo opera sobre el contrato activo visible.
- Agregar tests de rechazo antes de tocar sincronizacion.

### Fase 2: helper puro de planificacion

- Crear un helper puro que reciba snapshot de reserva y contratos existentes.
- Devolver un plan sin escribir en base de datos.
- Cubrir con tests unitarios los escenarios de aumento, reduccion, incompatibilidad, renders y recursos preparados.

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

## 11. Decisiones abiertas

- Definir si se necesita almacenar un hash/fingerprint material del contrato en una fase posterior o si basta con limpiar renders de forma conservadora cuando update detecta cambios materiales.
- Definir el flujo legal para una unidad firmada que negocio quiera cancelar, retirar o sustituir. No debe mezclarse con la edicion normal de cantidad.
- Definir si `READY` debe volver siempre a `DRAFT` ante cualquier cambio material o si puede mantenerse `READY` cuando las validaciones siguen pasando y el render se regenera antes de firma.
- Definir si el recurso preparado firmado representa compromiso legal o solo informacion operativa mostrada al cliente.
- Definir el detalle exacto de "reserva activa" para firma: estados permitidos, por ejemplo `SCHEDULED`, `WAITING` y `READY_FOR_PLATFORM`, y estados bloqueados como `CANCELED` o `COMPLETED`.

---

## 12. Riesgos pendientes

- Compatibilidad con datos legacy que tengan `logicalUnitIndex` nulo o contratos visibles duplicados.
- Enlaces publicos antiguos que apunten a contratos ahora superseded.
- Limpieza de PDFs antiguos en S3: limpiar referencias es inmediato, borrar objetos debe ser diferido y auditable.
- Concurrencia entre update de reserva, ensure de contratos y firma publica.
- Ambiguedad si un cambio de precio/duracion ocurre despues de firma pero antes de operar la reserva.
- Posible diferencia entre unidad contractual y unidad operacional de plataforma.
