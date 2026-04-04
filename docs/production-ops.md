// docs/production-ops.md
# 🚀 Producción segura - SeaRiders

## ❌ NUNCA hacer en producción
- npx prisma db seed
- npx prisma migrate reset
- ejecutar scripts sin revisar variables

---

## ✅ SÍ hacer en producción
- npx prisma migrate deploy
- npm run seed:admin
- npm run seed:faults

---

## 🧹 Reset total (solo emergencias)

Requiere confirmación explícita:

---

## 🧪 Desarrollo (local)

---

## 🧠 Regla clave

Producción = datos reales  
Local = pruebas  

Nunca mezclar.