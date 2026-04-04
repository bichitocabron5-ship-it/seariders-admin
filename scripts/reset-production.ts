// scripts/reset-production.ts
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL");
  }

  if (process.env.CONFIRM_RESET_PRODUCTION !== "YES_I_UNDERSTAND") {
    throw new Error(
      "⛔ Reset bloqueado.\nDefine CONFIRM_RESET_PRODUCTION=YES_I_UNDERSTAND para continuar."
    );
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS public CASCADE;`);
    await client.query(`CREATE SCHEMA public;`);
    console.log("✅ Schema public reseteado correctamente");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Error reseteando producción:", e);
  process.exit(1);
});