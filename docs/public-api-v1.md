# API pública SeaRiders Fase 1

Base path: `/api/public/v1`

Objetivo:
- Exponer catálogo público, quote comercial y disponibilidad real para integración server-to-server.
- No crear reservas todavía.
- No tocar pagos todavía.
- No exponer IDs internos, comisiones, caja, canales internos ni datos operativos sensibles.

## Autenticación

La capa ya soporta autenticación propia para server-to-server con:

- `Authorization: Bearer <token>`
- `X-Api-Client: <clientId>` opcional

Configuración:

- `PUBLIC_API_BEARER_TOKEN`
- `PUBLIC_API_CLIENT_ID` opcional

Comportamiento actual:

- Si `PUBLIC_API_BEARER_TOKEN` no está configurado, la API pública no exige Bearer todavía.
- Si está configurado, todas las rutas `/api/public/v1/*` validan el token y devuelven `UNAUTHORIZED` cuando no coincide.

Pendiente recomendado:

- Añadir rate limiting por cliente/IP y observabilidad por `requestId`.

## Convenciones

- Todas las respuestas incluyen `requestId`.
- Todos los endpoints trabajan con `serviceCode` y `optionCode`.
- Si faltara algún código histórico, el backend ya puede derivar un fallback estable:
  - `serviceCode`: normalización de `service.code`, o si faltara, `service.name`
  - `optionCode`: normalización de `serviceOption.code`, o si faltara, `SERVICECODE_DURATION_PAX`

Recomendación operativa:

- Mantener `Service.code` y `ServiceOption.code` como fuente de verdad estable.
- Si aparecieran registros legacy sin código, hacer backfill persistente en admin antes de Fase 2.

## Errores estables

- `INVALID_INPUT`
- `NO_PRICE`
- `NO_AVAILABILITY`
- `PROMO_INVALID`
- `UNAUTHORIZED`
- `RATE_LIMITED`

Formato:

```json
{
  "requestId": "0b8d8b7d-5b71-48bd-bbbf-4f47d4914b7e",
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Body inválido."
  }
}
```

## 1. GET /api/public/v1/catalog

Devuelve catálogo público saneado para web.

Ejemplo:

```http
GET /api/public/v1/catalog
Authorization: Bearer <token>
X-Api-Client: seariders-public-web
X-Request-Id: ext-12345
```

Respuesta ejemplo:

```json
{
  "requestId": "ext-12345",
  "ok": true,
  "auth": {
    "enforced": true,
    "clientId": "seariders-public-web"
  },
  "generatedAt": "2026-05-26T19:15:00.000Z",
  "categories": {
    "main": ["JETSKI", "TOWABLE"],
    "extra": ["EXTRA"]
  },
  "services": [
    {
      "serviceCode": "JETSKI_TOUR",
      "name": "Jetski Tour",
      "category": "JETSKI",
      "isExternalActivity": false,
      "isLicense": false,
      "options": [
        {
          "optionCode": "JETSKI_TOUR_30_2",
          "durationMinutes": 30,
          "contractedMinutes": 30,
          "paxMax": 2,
          "displayLabel": "30 min",
          "secondaryLabel": "Hasta 2 pax"
        }
      ]
    }
  ],
  "extras": [
    {
      "serviceCode": "GOPRO",
      "name": "GoPro",
      "category": "EXTRA",
      "hasStandalonePricing": true
    }
  ]
}
```

Lógica reutilizada:

- `buildPosCatalog("STORE")`
- `annotateServiceOptions`
- `service-channel-availability`
- pricing vigente por `ServicePrice`

## 2. POST /api/public/v1/pricing/quote

Calcula precio vigente y promociones aplicables sin crear reserva.

Body ejemplo:

```json
{
  "serviceCode": "JETSKI_TOUR",
  "optionCode": "JETSKI_TOUR_30_2",
  "quantity": 2,
  "pax": 2,
  "date": "2026-06-10",
  "time": "11:00",
  "customerCountry": "ES",
  "jetskiLicenseMode": "GREEN_LIMITED",
  "promoCode": "SUMMER10"
}
```

Respuesta ejemplo:

```json
{
  "requestId": "4a269706-7600-430f-8d5f-41dbfb1c1d46",
  "ok": true,
  "service": {
    "serviceCode": "JETSKI_TOUR",
    "name": "Jetski Tour",
    "category": "JETSKI"
  },
  "option": {
    "optionCode": "JETSKI_TOUR_30_2",
    "durationMinutes": 30,
    "paxMax": 2
  },
  "quantity": 2,
  "pax": 2,
  "pricingTier": "RESIDENT",
  "baseUnitPriceCents": 9000,
  "baseTotalCents": 18000,
  "discountCents": 1800,
  "finalTotalCents": 16200,
  "appliedPromotion": {
    "code": "SUMMER10",
    "name": "Promo verano",
    "kind": "PERCENT",
    "value": 10
  },
  "availablePromotions": [
    {
      "code": "SUMMER10",
      "name": "Promo verano",
      "kind": "PERCENT",
      "value": 10,
      "discountCents": 1800
    }
  ],
  "pricingMeta": {
    "modeLabel": "Tarifa residente / llave verde",
    "effectiveAt": "2026-06-10T09:00:00.000Z"
  }
}
```

Lógica reutilizada:

- `findActiveServicePrice`
- `resolvePricingTierForJetskiMode`
- `computeAutoDiscountDetail`
- `listPromotionOptions`

Reglas de Fase 1:

- Si no existe precio vigente: `NO_PRICE`
- Si `promoCode` no aplica a la combinación solicitada: `PROMO_INVALID`

## 3. GET /api/public/v1/availability

Consulta disponibilidad real por servicio/opción y fecha.

Ejemplo:

```http
GET /api/public/v1/availability?serviceCode=JETSKI_TOUR&optionCode=JETSKI_TOUR_30_2&date=2026-06-10&quantity=2
Authorization: Bearer <token>
```

Respuesta ejemplo:

```json
{
  "requestId": "73fbb1ad-e849-4fea-9461-68e73418117a",
  "ok": true,
  "service": {
    "serviceCode": "JETSKI_TOUR",
    "name": "Jetski Tour",
    "category": "JETSKI"
  },
  "option": {
    "optionCode": "JETSKI_TOUR_30_2",
    "durationMinutes": 30,
    "paxMax": 2
  },
  "date": "2026-06-10",
  "intervalMinutes": 30,
  "openTime": "09:00",
  "closeTime": "20:00",
  "quantity": 2,
  "availableSlotCount": 12,
  "slots": [
    { "time": "09:00", "available": true, "freeUnits": 4 },
    { "time": "09:30", "available": false, "freeUnits": 0 }
  ]
}
```

Si se manda `time=HH:mm` y esa hora no cabe o no tiene capacidad, responde `NO_AVAILABILITY`.

Lógica reutilizada:

- `buildCapacityBlockingReservationWhere`
- `reservation-capacity`
- `reservation-operations`
- `slot-config`

Capacidad bloqueante incluida:

- `STORE`
- `BOOTH`
- `WEB`

Estados bloqueantes:

- `SCHEDULED`
- `WAITING`
- `READY_FOR_PLATFORM`
- `IN_SEA`

## Qué queda para Fase 2

- Crear endpoint de reserva pública.
- Persistir cliente, línea principal y extras.
- Revalidar quote y disponibilidad en transacción justo antes de crear.
- Bloquear doble venta con control transaccional de capacidad.
- Gestionar canal público WEB de forma explícita en creación.
- Diseñar idempotencia (`Idempotency-Key`).
- Añadir cancelación técnica y estados pre-pago.
- Integrar pago sin exponer credenciales ni lógica interna.

