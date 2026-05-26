# API pública SeaRiders Fase 2

## Checkout web y reserva online

Base path previsto: `/api/public/v2`

Objetivo:
- Permitir creación segura de reservas web.
- Bloquear capacidad de forma temporal durante el checkout.
- Soportar reintentos seguros con idempotencia.
- Preparar integración de pagos online, empezando por Stripe.
- Mantener separada la fase de checkout temporal de la reserva operativa final.

No cubre en esta fase:
- Operativa interna de tienda/plataforma.
- Contratos, firma o check-in público.
- Cancelaciones comerciales complejas o reembolsos automáticos.

---

## 1. Resumen funcional

El flujo recomendado separa dos entidades:

- `WebCheckout`: checkout temporal, con hold de capacidad y posible pago en curso.
- `Reservation`: reserva final confirmada, ya integrada en el flujo operativo interno.

Principio clave:
- La web no crea directamente una `Reservation` final al iniciar el proceso.
- Primero crea un `WebCheckout` temporal con expiración.
- Solo cuando el checkout queda confirmado se materializa la reserva final.

Esto evita:
- doble reserva por reintentos
- sobreventa por concurrencia
- reservas huérfanas pagadas a medias
- mezcla de estados de pago con estados operativos

---

## 2. Flujo checkout web

### Flujo recomendado

1. La web consulta catálogo, precio y disponibilidad.
2. La web llama a `POST /checkouts` con cliente, selección, fecha, hora y promo.
3. El sistema:
   - revalida precio
   - revalida disponibilidad
   - crea `WebCheckout`
   - crea `hold` temporal de capacidad
   - devuelve `checkoutId`, `expiresAt` y siguiente acción
4. Si el flujo requiere prepago:
   - la web llama a `POST /checkouts/{id}/payment-session`
   - el backend crea sesión/intento de pago Stripe
   - devuelve datos de pago
5. Stripe confirma el pago por webhook
6. El backend marca el checkout como pagado
7. La web o el backend llama a `POST /checkouts/{id}/confirm`
8. El sistema crea la `Reservation` final con `source=WEB`
9. Se libera el hold temporal y queda enlazado a la reserva final
10. Si el checkout caduca antes de confirmarse, el hold expira y se libera capacidad

### Variantes de negocio

- `pre-pay`: se paga antes de crear la reserva final.
- `post-pay`: se confirma la reserva sin pago online inicial.
- `deposit-only`: se cobra solo señal o depósito.
- `full-pay`: se cobra importe completo.

La recomendación inicial para partner web es:
- soportar `pre-pay` y `post-pay`
- dejar `deposit-only` preparado a nivel de contrato

---

## 3. Estados previstos

### Estados de WebCheckout

- `CREATED`: checkout creado, aún no preparado para pago
- `HOLD_ACTIVE`: hold de capacidad activo
- `PAYMENT_PENDING`: sesión de pago creada, pendiente de resultado
- `PAID`: pago confirmado
- `CONFIRMED`: reserva final creada
- `EXPIRED`: hold expirado por tiempo
- `FAILED`: error técnico o pago fallido
- `CANCELED`: cancelado por cliente o por sistema

### Estados de Reservation final

Estados operativos previstos para la reserva confirmada:

- `SCHEDULED`
- `WAITING`
- `READY_FOR_PLATFORM`
- `IN_SEA`
- `COMPLETED`
- `CANCELED`

Nota:
- Los estados de checkout no deben mezclarse con los estados operativos de la reserva final.

---

## 4. Endpoints previstos

## 4.1 POST `/api/public/v2/checkouts`

Crea checkout temporal e inicia hold de capacidad.

### Headers

- `Authorization: Bearer <token>`
- `X-Api-Client: <clientId>`
- `Idempotency-Key: <unique-key>`
- `X-Request-Id: <external-request-id>` opcional

### Request ejemplo

```json
{
  "customer": {
    "name": "John Smith",
    "phone": "+34600111222",
    "email": "john@example.com",
    "country": "GB"
  },
  "booking": {
    "date": "2026-06-10",
    "time": "11:00",
    "channel": "WEB",
    "flow": "PREPAY"
  },
  "items": [
    {
      "serviceCode": "JETSKI_TOUR",
      "optionCode": "JETSKI_TOUR_30_2",
      "quantity": 2,
      "pax": 2,
      "promoCode": "SUMMER10"
    }
  ]
}
```

### Response ejemplo

```json
{
  "requestId": "ext-1001",
  "ok": true,
  "checkout": {
    "id": "wch_01JXYZ...",
    "status": "HOLD_ACTIVE",
    "expiresAt": "2026-06-10T09:12:00.000Z",
    "flow": "PREPAY",
    "paymentMode": "FULL_PAY",
    "currency": "EUR",
    "amounts": {
      "serviceTotalCents": 16200,
      "depositCents": 20000,
      "dueNowCents": 36200
    }
  },
  "nextAction": {
    "type": "CREATE_PAYMENT_SESSION"
  }
}
```

## 4.2 GET `/api/public/v2/checkouts/{checkoutId}`

Consulta estado de checkout.

### Response ejemplo

```json
{
  "requestId": "ext-1002",
  "ok": true,
  "checkout": {
    "id": "wch_01JXYZ...",
    "status": "PAYMENT_PENDING",
    "expiresAt": "2026-06-10T09:12:00.000Z",
    "flow": "PREPAY",
    "paymentStatus": "PENDING",
    "reservationId": null
  }
}
```

## 4.3 POST `/api/public/v2/checkouts/{checkoutId}/payment-session`

Crea sesión o intento de pago online.

### Headers

- `Authorization: Bearer <token>`
- `X-Api-Client: <clientId>`
- `Idempotency-Key: <unique-key>`

### Request ejemplo

```json
{
  "provider": "STRIPE",
  "returnUrl": "https://partner.example.com/booking/return",
  "cancelUrl": "https://partner.example.com/booking/cancel"
}
```

### Response ejemplo

```json
{
  "requestId": "ext-1003",
  "ok": true,
  "checkout": {
    "id": "wch_01JXYZ...",
    "status": "PAYMENT_PENDING",
    "expiresAt": "2026-06-10T09:12:00.000Z"
  },
  "payment": {
    "provider": "STRIPE",
    "status": "PENDING",
    "clientSecret": "pi_xxx_secret_xxx",
    "publishableKey": "pk_live_xxx"
  }
}
```

## 4.4 POST `/api/public/v2/checkouts/{checkoutId}/confirm`

Confirma el checkout y materializa la reserva final.

Uso previsto:
- tras pago confirmado
- o directamente en flujo `post-pay`

### Headers

- `Authorization: Bearer <token>`
- `X-Api-Client: <clientId>`
- `Idempotency-Key: <unique-key>`

### Request ejemplo

```json
{
  "acceptTerms": true
}
```

### Response ejemplo

```json
{
  "requestId": "ext-1004",
  "ok": true,
  "checkout": {
    "id": "wch_01JXYZ...",
    "status": "CONFIRMED"
  },
  "reservation": {
    "reservationId": "res_01JABC...",
    "source": "WEB",
    "status": "WAITING",
    "date": "2026-06-10",
    "time": "11:00"
  }
}
```

## 4.5 POST `/api/public/v2/checkouts/{checkoutId}/cancel`

Cancela checkout no confirmado y libera hold si sigue activo.

### Response ejemplo

```json
{
  "requestId": "ext-1005",
  "ok": true,
  "checkout": {
    "id": "wch_01JXYZ...",
    "status": "CANCELED"
  }
}
```

---

## 5. Autenticación

Autenticación prevista server-to-server:

- `Authorization: Bearer <token>`
- `X-Api-Client: <clientId>`

Recomendaciones:
- token único por partner
- rotación periódica
- rate limiting por cliente/IP
- trazabilidad por `requestId`

Comportamiento esperado:
- credenciales inválidas: `401 UNAUTHORIZED`
- cliente sin permisos para la operación: `403 FORBIDDEN`

---

## 6. Hold temporal de capacidad

El hold temporal bloquea capacidad antes del pago y antes de la creación de la reserva final.

Principios:
- el hold se crea dentro de la misma transacción que valida disponibilidad
- el hold descuenta capacidad temporalmente
- la disponibilidad pública debe tener en cuenta reservas confirmadas y holds activos
- al confirmar checkout, el hold deja de ser temporal y se transforma en reserva final

Recomendación inicial:
- TTL de hold: `10-15 minutos`

---

## 7. Expiración

Cada checkout lleva `expiresAt`.

Reglas:
- si llega a `expiresAt` sin confirmación, pasa a `EXPIRED`
- un checkout expirado no puede pagarse ni confirmarse
- el hold debe liberarse automáticamente al expirar
- un webhook de pago recibido después de la expiración no debe crear reserva automáticamente sin validación adicional

Respuesta esperada en checkout expirado:
- `410 CHECKOUT_EXPIRED`

---

## 8. Idempotencia

Todos los `POST` públicos de checkout deben ser idempotentes.

Headers:
- `Idempotency-Key: <unique-key>`

Reglas:
- misma clave + mismo payload: devuelve exactamente el mismo resultado
- misma clave + payload distinto: devuelve conflicto
- la clave debe ser única por operación lógica
- el partner debe generar una clave nueva para cada nueva intención real

Endpoints que deben requerir idempotencia:
- `POST /checkouts`
- `POST /checkouts/{id}/payment-session`
- `POST /checkouts/{id}/confirm`
- `POST /checkouts/{id}/cancel`

Respuesta de conflicto recomendada:
- `409 IDEMPOTENCY_CONFLICT`

---

## 9. Flujo Stripe

### Flujo previsto con Stripe

1. Partner crea checkout
2. Backend devuelve hold activo
3. Partner solicita `payment-session`
4. Backend crea `PaymentIntent` o sesión Stripe
5. Partner presenta pago al cliente
6. Stripe envía webhook al backend
7. Backend valida firma webhook
8. Backend marca checkout como `PAID`
9. Backend o partner confirma checkout
10. Backend crea reserva final

### Reglas recomendadas

- usar `checkoutId` como referencia principal en metadata Stripe
- no confiar solo en redirect del navegador para confirmar pago
- el estado definitivo de pago debe venir por webhook
- si Stripe confirma pago pero el checkout ya expiró, el backend debe aplicar flujo de revisión o reversión según negocio

### Estados de pago externos orientativos

- `PENDING`
- `AUTHORIZED`
- `SUCCEEDED`
- `FAILED`
- `CANCELED`
- `REFUNDED`

---

## 10. Errores estándar

Códigos previstos:

- `INVALID_INPUT`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NO_PRICE`
- `NO_AVAILABILITY`
- `PROMO_INVALID`
- `CHECKOUT_EXPIRED`
- `CHECKOUT_NOT_FOUND`
- `CHECKOUT_NOT_PAYABLE`
- `CHECKOUT_NOT_CONFIRMABLE`
- `PAYMENT_FAILED`
- `IDEMPOTENCY_CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

### Formato estándar

```json
{
  "requestId": "ext-2001",
  "ok": false,
  "error": {
    "code": "NO_AVAILABILITY",
    "message": "No availability for requested slot."
  }
}
```

### Ejemplo `CHECKOUT_EXPIRED`

```json
{
  "requestId": "ext-2002",
  "ok": false,
  "error": {
    "code": "CHECKOUT_EXPIRED",
    "message": "Checkout has expired."
  }
}
```

### Ejemplo `IDEMPOTENCY_CONFLICT`

```json
{
  "requestId": "ext-2003",
  "ok": false,
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Idempotency-Key already used with different payload."
  }
}
```

---

## 11. Reglas funcionales resumidas

- `source` de la reserva final: `WEB`
- `channel` comercial: `WEB`
- promociones: revalidadas en backend al crear checkout
- precio: siempre recalculado en backend
- disponibilidad: siempre revalidada en backend
- capacidad: bloqueada con hold temporal antes del pago
- reserva final: solo tras confirmación
- reintentos: protegidos con idempotencia

---

## 12. Diagrama textual simple

```text
PARTNER WEB
  |
  | 1. quote + availability
  v
SEARIDERS PUBLIC API
  |
  | 2. POST /checkouts
  |    - validate price
  |    - validate availability
  |    - create checkout
  |    - create temporary hold
  v
CHECKOUT = HOLD_ACTIVE
  |
  | 3. POST /checkouts/{id}/payment-session
  v
STRIPE
  |
  | 4. customer pays
  | 5. webhook
  v
SEARIDERS PUBLIC API
  |
  | 6. checkout -> PAID
  | 7. POST /checkouts/{id}/confirm
  v
RESERVATION CREATED
  |
  | source=WEB
  | status=WAITING
  v
INTERNAL OPERATIONS FLOW
```

---

## 13. Notas para partner externo

- El partner no debe asumir que una disponibilidad consultada minutos antes sigue libre sin checkout activo.
- El partner no debe asumir que el redirect de Stripe equivale a pago confirmado.
- El partner debe tratar `expiresAt` como límite real de validez del checkout.
- El partner debe enviar `Idempotency-Key` en todos los `POST`.
- El partner debe almacenar `checkoutId` como identificador principal de integración hasta recibir `reservationId`.

