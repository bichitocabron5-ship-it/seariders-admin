// scripts/delete-last-canceled.ts
import "dotenv/config";
import { Prisma, ReservationSource, ReservationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const TARGET_SOURCES = [ReservationSource.STORE, ReservationSource.BOOTH] as const;

type UpdateManyDelegate<Args> = {
  updateMany(args: Args): Promise<unknown>;
};

type DeleteManyDelegate<Args> = {
  deleteMany(args: Args): Promise<unknown>;
};

function hasUpdateMany<Args>(value: unknown): value is UpdateManyDelegate<Args> {
  return (
    typeof value === "object" &&
    value !== null &&
    "updateMany" in value &&
    typeof value.updateMany === "function"
  );
}

function hasDeleteMany<Args>(value: unknown): value is DeleteManyDelegate<Args> {
  return (
    typeof value === "object" &&
    value !== null &&
    "deleteMany" in value &&
    typeof value.deleteMany === "function"
  );
}

type LegacyTx = Prisma.TransactionClient & {
  giftVoucher?: unknown;
  passConsume?: unknown;
  reservationItem?: unknown;
  payment?: unknown;
  reservationContract?: unknown;
  contract?: unknown;
  fulfillmentTask?: unknown;
  reservationUnit?: unknown;
};

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CANCELED,
      source: { in: [...TARGET_SOURCES] },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      source: true,
      createdAt: true,
    },
  });

  if (reservations.length === 0) {
    console.log("No hay reservas canceladas de STORE/BOOTH para borrar.");
    return;
  }

  const ids = reservations.map((reservation) => reservation.id);
  console.log(`Total canceladas STORE/BOOTH a borrar: ${reservations.length}`);
  console.log("Reservas a borrar:", reservations);

  await prisma.$transaction(async (tx) => {
    const legacyTx = tx as LegacyTx;

    if (
      hasUpdateMany<{
        where: { redeemedReservationId: { in: string[] } };
        data: { redeemedReservationId: null };
      }>(legacyTx.giftVoucher)
    ) {
      await legacyTx.giftVoucher.updateMany({
        where: { redeemedReservationId: { in: ids } },
        data: { redeemedReservationId: null },
      });
    }

    if (
      hasUpdateMany<{
        where: { reservationId: { in: string[] } };
        data: { reservationId: null };
      }>(legacyTx.passConsume)
    ) {
      await legacyTx.passConsume.updateMany({
        where: { reservationId: { in: ids } },
        data: { reservationId: null },
      });
    }

    if (
      hasUpdateMany<{
        where: { splitReservationId: { in: string[] } };
        data: { splitReservationId: null };
      }>(legacyTx.reservationItem)
    ) {
      await legacyTx.reservationItem.updateMany({
        where: { splitReservationId: { in: ids } },
        data: { splitReservationId: null },
      });
    }

    if (
      hasDeleteMany<{
        where: { reservationId: { in: string[] } };
      }>(legacyTx.reservationItem)
    ) {
      await legacyTx.reservationItem.deleteMany({
        where: { reservationId: { in: ids } },
      });
    }

    if (
      hasDeleteMany<{
        where: { reservationId: { in: string[] } };
      }>(legacyTx.payment)
    ) {
      await legacyTx.payment.deleteMany({
        where: { reservationId: { in: ids } },
      });
    }

    if (
      hasDeleteMany<{
        where: { reservationId: { in: string[] } };
      }>(legacyTx.reservationContract)
    ) {
      await legacyTx.reservationContract.deleteMany({
        where: { reservationId: { in: ids } },
      });
    }

    if (
      hasDeleteMany<{
        where: { reservationId: { in: string[] } };
      }>(legacyTx.contract)
    ) {
      await legacyTx.contract.deleteMany({
        where: { reservationId: { in: ids } },
      });
    }

    if (
      hasDeleteMany<{
        where: { reservationId: { in: string[] } };
      }>(legacyTx.fulfillmentTask)
    ) {
      await legacyTx.fulfillmentTask.deleteMany({
        where: { reservationId: { in: ids } },
      });
    }

    if (
      hasDeleteMany<{
        where: { reservationId: { in: string[] } };
      }>(legacyTx.reservationUnit)
    ) {
      await legacyTx.reservationUnit.deleteMany({
        where: { reservationId: { in: ids } },
      });
    }

    await tx.reservation.deleteMany({
      where: { id: { in: ids } },
    });
  });

  console.log("Reservas canceladas de STORE/BOOTH eliminadas correctamente.");
}

main()
  .catch((error) => {
    console.error("Error borrando reservas:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
