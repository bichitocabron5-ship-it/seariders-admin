// prisma/check-fault-code.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.slice(0, 80), "...");

  const count = await prisma.faultCodeCatalog.count();
  console.log("faultCodeCatalog count =", count);

  const rows = await prisma.faultCodeCatalog.findMany({
    where: {
      code: {
        contains: "P0562",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      brand: true,
      code: true,
      titleEs: true,
      isActive: true,
    },
  });

  console.log("rows =", rows);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });