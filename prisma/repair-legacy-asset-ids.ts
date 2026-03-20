import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

type LegacyAssetRow = {
  id: string;
  name: string;
  code: string | null;
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definido.");
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const legacyAssets = await client.query<LegacyAssetRow>(
      `SELECT "id", "name", "code"
       FROM "Asset"
       WHERE COALESCE("id", '') = ''`
    );

    if (legacyAssets.rows.length === 0) {
      console.log("No hay assets legacy con id vacío.");
      await client.query("COMMIT");
      return;
    }

    for (const row of legacyAssets.rows) {
      const newId = randomUUID();
      const legacyCode = row.code;
      const tempCode = legacyCode ? `__legacy__${legacyCode}__${newId}` : null;

      if (legacyCode) {
        await client.query(
          `UPDATE "Asset"
           SET "code" = $2
           WHERE COALESCE("id", '') = '' AND "name" = $1 AND "code" = $3`,
          [row.name, tempCode, legacyCode]
        );
      }

      await client.query(
        `INSERT INTO "Asset" (
          "id", "type", "status", "name", "code", "model", "year", "plate",
          "chassisNumber", "maxPax", "note", "currentHours", "lastServiceHours",
          "serviceIntervalHours", "serviceWarnHours", "isMotorized",
          "createdAt", "updatedAt", "operabilityStatus"
        )
        SELECT
          $1, "type", "status", "name", $2, "model", "year", "plate",
          "chassisNumber", "maxPax", "note", "currentHours", "lastServiceHours",
          "serviceIntervalHours", "serviceWarnHours", "isMotorized",
          "createdAt", "updatedAt", "operabilityStatus"
        FROM "Asset"
        WHERE COALESCE("id", '') = '' AND "name" = $3 AND COALESCE("code", '') = COALESCE($4, '')`,
        [newId, legacyCode, row.name, tempCode]
      );

      await client.query(
        `UPDATE "MonitorRun" SET "monitorAssetId" = $1 WHERE "monitorAssetId" = ''`,
        [newId]
      );
      await client.query(
        `UPDATE "MonitorRunAssignment" SET "assetId" = $1 WHERE "assetId" = ''`,
        [newId]
      );
      await client.query(
        `UPDATE "MaintenanceEvent" SET "assetId" = $1 WHERE "assetId" = ''`,
        [newId]
      );
      await client.query(
        `UPDATE "Incident" SET "assetId" = $1 WHERE "assetId" = ''`,
        [newId]
      );

      await client.query(
        `DELETE FROM "Asset"
         WHERE COALESCE("id", '') = '' AND "name" = $1 AND COALESCE("code", '') = COALESCE($2, '')`,
        [row.name, tempCode]
      );

      console.log(`Asset reparado: ${row.name}${legacyCode ? ` (${legacyCode})` : ""} -> ${newId}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
