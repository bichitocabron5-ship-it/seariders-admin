import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(new URL("./route.ts", import.meta.url), "utf8");

function transactionBody() {
  const start = routeSource.indexOf("prisma.$transaction(async (tx) =>");
  const end = routeSource.indexOf("}, FORMALIZE_TRANSACTION_OPTIONS)", start);
  assert.ok(start >= 0, "formalize transaction start not found");
  assert.ok(end > start, "formalize transaction options end not found");
  return routeSource.slice(start, end);
}

test("formalize syncs reservation contracts once and then only reads final progress", () => {
  const syncCalls = routeSource.match(/await syncReservationContractsTx\(tx,/g) ?? [];

  assert.equal(syncCalls.length, 1);
  assert.match(
    routeSource,
    /const contracts = await readReservationContractProgressTx\(tx, id\);/
  );
  assert.equal(routeSource.includes("ensureContractsTx"), false);
});

test("formalize transaction has bounded Prisma timeout options", () => {
  assert.match(routeSource, /maxWait:\s*10_000/);
  assert.match(routeSource, /timeout:\s*15_000/);
  assert.match(routeSource, /}, FORMALIZE_TRANSACTION_OPTIONS\);/);
});

test("formalize does not run concurrent Prisma queries on the same transaction client", () => {
  assert.equal(transactionBody().includes("Promise.all"), false);
});
