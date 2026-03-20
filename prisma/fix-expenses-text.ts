import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

type TableName = "ExpenseCategory" | "ExpenseVendor" | "Expense";

type Options = {
  apply: boolean;
  limit: number | null;
  table: TableName | null;
  sample: number;
};

function parseArgs(argv: string[]): Options {
  let apply = false;
  let limit: number | null = null;
  let table: TableName | null = null;
  let sample = 20;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];

    if (a === "--apply") {
      apply = true;
      continue;
    }
    if (a === "--dry-run") {
      apply = false;
      continue;
    }
    if (a === "--limit") {
      const raw = argv[i + 1];
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error("`--limit` debe ser un entero > 0");
      }
      limit = Math.floor(n);
      i += 1;
      continue;
    }
    if (a === "--sample") {
      const raw = argv[i + 1];
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error("`--sample` debe ser un entero > 0");
      }
      sample = Math.floor(n);
      i += 1;
      continue;
    }
    if (a === "--table") {
      const raw = argv[i + 1] as TableName | undefined;
      if (!raw || !["ExpenseCategory", "ExpenseVendor", "Expense"].includes(raw)) {
        throw new Error("`--table` debe ser: ExpenseCategory | ExpenseVendor | Expense");
      }
      table = raw;
      i += 1;
      continue;
    }
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Argumento no reconocido: ${a}`);
  }

  return { apply, limit, table, sample };
}

function printHelp() {
  console.log(`
Uso:
  pnpm tsx prisma/fix-expenses-text.ts [--dry-run] [--apply] [--table <tabla>] [--limit <n>] [--sample <n>]

Opciones:
  --dry-run              No escribe en DB (por defecto)
  --apply                Aplica cambios en DB
  --table <tabla>        ExpenseCategory | ExpenseVendor | Expense
  --limit <n>            Limita registros inspeccionados por tabla
  --sample <n>           Muestras impresas por tabla (default: 20)
  --help, -h             Mostrar ayuda

Ejemplos:
  pnpm tsx prisma/fix-expenses-text.ts --dry-run
  pnpm tsx prisma/fix-expenses-text.ts --dry-run --table ExpenseVendor --sample 50
  pnpm tsx prisma/fix-expenses-text.ts --apply --table Expense
`);
}

function looksMojibake(value: string) {
  return /[ÃÂâ]/.test(value);
}

function normalizeText(value: string | null | undefined) {
  if (value == null) return value;
  const trimmed = value.trim();
  if (!trimmed) return "";

  let normalized = trimmed;

  if (looksMojibake(normalized)) {
    try {
      normalized = Buffer.from(normalized, "latin1").toString("utf8");
    } catch {
      // Si falla, mantenemos el original.
    }
  }

  normalized = normalized
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');

  return normalized;
}

function changedPatch<T extends Record<string, unknown>>(
  row: T,
  keys: (keyof T)[]
): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of keys) {
    const current = row[key];
    if (typeof current !== "string" && current !== null) continue;
    const next = normalizeText(current as string | null);
    if (next !== current) {
      patch[key] = next as T[keyof T];
    }
  }
  return patch;
}

async function processExpenseCategory(opts: Options) {
  if (!prisma) throw new Error("Prisma no inicializado");
  const rows = await prisma.expenseCategory.findMany({
    ...(opts.limit ? { take: opts.limit } : {}),
    select: { id: true, name: true, code: true, description: true },
    orderBy: { createdAt: "asc" },
  });

  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  let failed = 0;
  const previews: string[] = [];

  for (const row of rows) {
    scanned += 1;
    const patch = changedPatch(row, ["name", "code", "description"]);
    if (!Object.keys(patch).length) continue;
    candidates += 1;

    if (previews.length < opts.sample) {
      previews.push(
        `ExpenseCategory ${row.id} :: ${JSON.stringify({
          before: { name: row.name, code: row.code, description: row.description },
          after: patch,
        })}`
      );
    }

    if (!opts.apply) continue;

    try {
      await prisma.expenseCategory.update({
        where: { id: row.id },
        data: patch,
      });
      updated += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ExpenseCategory][${row.id}] ERROR: ${msg}`);
    }
  }

  return { table: "ExpenseCategory" as const, scanned, candidates, updated, failed, previews };
}

async function processExpenseVendor(opts: Options) {
  if (!prisma) throw new Error("Prisma no inicializado");
  const rows = await prisma.expenseVendor.findMany({
    ...(opts.limit ? { take: opts.limit } : {}),
    select: {
      id: true,
      name: true,
      code: true,
      taxId: true,
      email: true,
      phone: true,
      contactPerson: true,
      note: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  let failed = 0;
  const previews: string[] = [];

  for (const row of rows) {
    scanned += 1;
    const patch = changedPatch(row, [
      "name",
      "code",
      "taxId",
      "email",
      "phone",
      "contactPerson",
      "note",
    ]);
    if (!Object.keys(patch).length) continue;
    candidates += 1;

    if (previews.length < opts.sample) {
      previews.push(
        `ExpenseVendor ${row.id} :: ${JSON.stringify({
          before: {
            name: row.name,
            code: row.code,
            taxId: row.taxId,
            email: row.email,
            phone: row.phone,
            contactPerson: row.contactPerson,
            note: row.note,
          },
          after: patch,
        })}`
      );
    }

    if (!opts.apply) continue;

    try {
      await prisma.expenseVendor.update({
        where: { id: row.id },
        data: patch,
      });
      updated += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ExpenseVendor][${row.id}] ERROR: ${msg}`);
    }
  }

  return { table: "ExpenseVendor" as const, scanned, candidates, updated, failed, previews };
}

async function processExpense(opts: Options) {
  if (!prisma) throw new Error("Prisma no inicializado");
  const rows = await prisma.expense.findMany({
    ...(opts.limit ? { take: opts.limit } : {}),
    select: {
      id: true,
      description: true,
      reference: true,
      invoiceNumber: true,
      note: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  let failed = 0;
  const previews: string[] = [];

  for (const row of rows) {
    scanned += 1;
    const patch = changedPatch(row, ["description", "reference", "invoiceNumber", "note"]);
    if (!Object.keys(patch).length) continue;
    candidates += 1;

    if (previews.length < opts.sample) {
      previews.push(
        `Expense ${row.id} :: ${JSON.stringify({
          before: {
            description: row.description,
            reference: row.reference,
            invoiceNumber: row.invoiceNumber,
            note: row.note,
          },
          after: patch,
        })}`
      );
    }

    if (!opts.apply) continue;

    try {
      await prisma.expense.update({
        where: { id: row.id },
        data: patch,
      });
      updated += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Expense][${row.id}] ERROR: ${msg}`);
    }
  }

  return { table: "Expense" as const, scanned, candidates, updated, failed, previews };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  prisma = new PrismaClient();
  const targets: TableName[] = opts.table
    ? [opts.table]
    : ["ExpenseCategory", "ExpenseVendor", "Expense"];

  console.log(`Modo: ${opts.apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Tablas: ${targets.join(", ")}`);
  if (opts.limit) console.log(`Límite por tabla: ${opts.limit}`);
  console.log("");

  const results = [];
  if (targets.includes("ExpenseCategory")) results.push(await processExpenseCategory(opts));
  if (targets.includes("ExpenseVendor")) results.push(await processExpenseVendor(opts));
  if (targets.includes("Expense")) results.push(await processExpense(opts));

  for (const r of results) {
    console.log(`\n== ${r.table} ==`);
    console.log(`Scanned: ${r.scanned}`);
    console.log(`Candidates: ${r.candidates}`);
    if (opts.apply) {
      console.log(`Updated: ${r.updated}`);
      console.log(`Failed: ${r.failed}`);
    }
    if (r.previews.length) {
      console.log(`Samples (${r.previews.length}):`);
      for (const line of r.previews) console.log(`- ${line}`);
    } else {
      console.log("Samples: none");
    }
  }

  const totalCandidates = results.reduce((acc, r) => acc + r.candidates, 0);
  const totalUpdated = results.reduce((acc, r) => acc + r.updated, 0);
  const totalFailed = results.reduce((acc, r) => acc + r.failed, 0);
  console.log("\n== Resumen ==");
  console.log(`Candidates: ${totalCandidates}`);
  if (opts.apply) {
    console.log(`Updated: ${totalUpdated}`);
    console.log(`Failed: ${totalFailed}`);
  } else {
    console.log("No se aplicaron cambios (dry-run).");
  }
}

main()
  .catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
