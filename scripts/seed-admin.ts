// scripts/seed-admin.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const ALL_ROLES: RoleName[] = [
  RoleName.ADMIN,
  RoleName.BOOTH,
  RoleName.STORE,
  RoleName.PLATFORM,
  RoleName.BAR,
  RoleName.MECHANIC,
  RoleName.HR,
];

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim() || "jose";
  const fullName = process.env.SEED_ADMIN_FULLNAME?.trim() || "José";
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!password) {
    throw new Error("Falta SEED_ADMIN_PASSWORD en variables de entorno.");
  }

  for (const roleName of ALL_ROLES) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
      },
    });
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Falta DATABASE_URL");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.ADMIN },
  });

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      fullName,
      passwordHash,
      isActive: true,
    },
    create: {
      fullName,
      username,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  console.log("✅ Roles base preparados correctamente");
  console.log(`✅ Admin preparado correctamente`);
  console.log(`Usuario: ${username}`);
  console.log(`Rol: ${adminRole.name}`);
  console.log(`Roles creados: ${ALL_ROLES.join(", ")}`);
}

main()
  .catch((err) => {
    console.error("❌ Error creando admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });