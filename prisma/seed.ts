// src/prisma/seed.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { EmployeeKind, RoleName } from "@prisma/client";
import { prisma, pgPool } from "../src/lib/prisma";
import "dotenv/config";

if (process.env.ALLOW_DEV_SEED !== "true") {
  throw new Error(
    "⛔ Seed de desarrollo bloqueado.\nUsa ALLOW_DEV_SEED=true solo en entorno de desarrollo."
  );
}

// Contraseña temporal para todos
const TEMP_PASSWORD = "SeaRiders2026!";

function toCode(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function upsertCommissionRule(params: {
  channelId: string;
  serviceId: string;
  commissionPct: number;
}) {
  const { channelId, serviceId, commissionPct } = params;

  await prisma.channelCommissionRule.upsert({
    where: { channelId_serviceId: { channelId, serviceId } },
    update: { commissionPct, isActive: true },
    create: { channelId, serviceId, commissionPct, isActive: true },
  });
}

async function serviceIdByName(name: string) {
  const s = await prisma.service.findFirst({
    where: { name },
    select: { id: true },
  });
  if (!s) throw new Error(`Service no existe: ${name}`);
  return s.id;
}

async function ensureExtraTimeServices() {
  const names = ["Tiempo extra 15", "Tiempo extra 30", "Tiempo extra 60"] as const;

  for (const name of names) {
    const code = `EXTRA_${toCode(name)}`;

    await prisma.service.upsert({
      where: { code },
      update: {
        name,
        category: "EXTRA",
        isActive: true,
        requiresPlatform: false,
        requiresJetski: false,
        requiresMonitor: false,
        isLicense: false,
      },
      create: {
        code,
        name,
        category: "EXTRA",
        isActive: true,
        requiresPlatform: false,
        requiresJetski: false,
        requiresMonitor: false,
        isLicense: false,
      },
    });
  }
}

async function main() {
  // 1) Roles
  const roles: RoleName[] = [
    RoleName.ADMIN,
    RoleName.STORE,
    RoleName.PLATFORM,
    RoleName.BOOTH,
    RoleName.BAR,
    RoleName.MECHANIC,
    RoleName.HR,
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r },
      update: {},
      create: { name: r },
    });
  }

  const roleMap = Object.fromEntries(
    (await prisma.role.findMany({ select: { id: true, name: true } })).map((r) => [r.name, r.id])
  ) as Record<RoleName, string>;

  // 2) Employees
  // Solo trabajadores reales. NO meter ADMIN/PLATFORM como kind.
  const employees: Array<{
    code: string;
    fullName: string;
    email: string | null;
    phone?: string | null;
    kind: EmployeeKind;
    jobTitle?: string | null;
    note?: string | null;
  }> = [
    {
      code: "EMP-MEC-001",
      fullName: "Jose Villa",
      email: "ldcdd_29@hotmail.es",
      phone: "+34 679458347",
      kind: EmployeeKind.MECHANIC,
      jobTitle: "Mecánico",
      note: null,
    },
    {
      code: "EMP-PLT-001",
      fullName: "Carlos Villa",
      email: "carlos.villa@seariders.local",
      kind: EmployeeKind.MANAGER,
      jobTitle: "Encargado plataforma",
      note: null,
    },
    {
      code: "EMP-HR-001",
      fullName: "RRHH Demo",
      email: "rrhh@seariders.local",
      kind: EmployeeKind.HR,
      jobTitle: "Recursos Humanos",
      note: null,
    },
  ];

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { code: e.code },
      update: {
        fullName: e.fullName,
        email: e.email,
        phone: e.phone ?? null,
        kind: e.kind,
        jobTitle: e.jobTitle ?? null,
        isActive: true,
        note: e.note ?? null,
      },
      create: {
        code: e.code,
        fullName: e.fullName,
        email: e.email,
        phone: e.phone ?? null,
        kind: e.kind,
        jobTitle: e.jobTitle ?? null,
        isActive: true,
        note: e.note ?? null,
      },
    });
  }

  const employeeMap = Object.fromEntries(
    (
      await prisma.employee.findMany({
        select: { id: true, code: true, fullName: true, email: true },
      })
    ).map((e) => [e.code, e])
  ) as Record<string, { id: string; code: string | null; fullName: string; email: string | null }>;

  // 3) Users
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);

  const users: Array<{
    fullName: string;
    username: string;
    email?: string | null;
    passportCode?: string | null;
    role: RoleName;
    employeeCode?: string;
  }> = [
    // Admins sin trabajador vinculado
    {
      fullName: "José",
      username: "jose",
      email: "jose.admin@seariders.local",
      passportCode: "PASS-ADM-01",
      role: RoleName.ADMIN,
    },
    {
      fullName: "Carlos",
      username: "carlos_admin",
      email: "carlos.admin@seariders.local",
      passportCode: "PASS-ADM-02",
      role: RoleName.ADMIN,
    },

    // Operativos vinculados a trabajador
    {
      employeeCode: "EMP-MEC-001",
      fullName: "Jose Villa",
      username: "jose_mechanic",
      email: "ldcdd_29@hotmail.es",
      passportCode: "EMP-MEC-01",
      role: RoleName.MECHANIC,
    },
    {
      employeeCode: "EMP-PLT-001",
      fullName: "Carlos Villa",
      username: "carlos",
      email: "carlos.villa@seariders.local",
      passportCode: "PASS-PLT-01",
      role: RoleName.PLATFORM,
    },
    {
      employeeCode: "EMP-HR-001",
      fullName: "RRHH Demo",
      username: "rrhh_demo",
      email: "rrhh@seariders.local",
      passportCode: "PASS-HR-01",
      role: RoleName.HR,
    },

    // Usuarios operativos ya existentes
    { fullName: "Mike", username: "mike", passportCode: "PASS-CRP-02", role: RoleName.BOOTH },
    { fullName: "Charles", username: "charles", passportCode: "PASS-CRP-01", role: RoleName.BOOTH },
    { fullName: "Tomás", username: "tomas", passportCode: "PASS-STR-01", role: RoleName.STORE },
    { fullName: "María", username: "maria", passportCode: "PASS-STR-02", role: RoleName.STORE },
    { fullName: "Moha", username: "moha", passportCode: "PASS-PLT-02", role: RoleName.PLATFORM },
    { fullName: "Gisela Villa", username: "gisela", passportCode: "PASS-BAR-02", role: RoleName.BAR },
    { fullName: "Aarón", username: "aaron", passportCode: "PASS-BAR-01", role: RoleName.BAR },
  ];

  for (const u of users) {
    const employee = u.employeeCode ? employeeMap[u.employeeCode] ?? null : null;

    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        fullName: u.fullName,
        passwordHash,
        isActive: true,
        employee: employee ? { connect: { id: employee.id } } : undefined,
        email: u.email ?? null,
        passportCode: u.passportCode ?? null,
      },
      create: {
        fullName: u.fullName,
        username: u.username,
        passwordHash,
        isActive: true,
        employee: employee ? { connect: { id: employee.id } } : undefined,
        email: u.email ?? null,
        passportCode: u.passportCode ?? null,
      },
      select: { id: true, username: true },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: roleMap[u.role],
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: roleMap[u.role],
      },
    });
  }

  // 5) Monitores
  const monitors = [
    "Peluky",
    "Ian",
    "Iván",
    "Giovani",
    "Tomás",
    "Tony",
    "Titi",
    "Sufian",
    "Capi",
  ];

  for (const name of monitors) {
    await prisma.monitor.upsert({
      where: { name },
      update: { isActive: true, maxCapacity: 4 },
      create: { name, isActive: true, maxCapacity: 4 },
    });
  }

  // 6) Jetskis
  for (let n = 1; n <= 21; n++) {
    await prisma.jetski.upsert({
      where: { number: n },
      update: { status: "OPERATIONAL" },
      create: { number: n, status: "OPERATIONAL" },
    });
  }

  // 7) Channels
  const channels = [
    {
      name: "OLYMPIC",
      commissionEnabled: false,
      commissionBps: 0,
      commissionPct: 0,
      commissionAppliesToDeposit: false,
      isActive: true,
    },
    {
      name: "KARIM",
      commissionEnabled: true,
      commissionBps: 2000,
      commissionPct: 20,
      commissionAppliesToDeposit: false,
      isActive: true,
    },
    {
      name: "NOMAD",
      commissionEnabled: true,
      commissionBps: 2000,
      commissionPct: 20,
      commissionAppliesToDeposit: false,
      isActive: true,
    },
    {
      name: "Oyde",
      commissionEnabled: true,
      commissionBps: 2500,
      commissionPct: 25,
      commissionAppliesToDeposit: false,
      isActive: true,
    },
    {
      name: "Brutal",
      commissionEnabled: true,
      commissionBps: 5000,
      commissionPct: 50,
      commissionAppliesToDeposit: false,
      isActive: true,
    },
  ];

  for (const c of channels) {
    await prisma.channel.upsert({
      where: { name: c.name },
      update: {
        isActive: true,
        commissionEnabled: c.commissionEnabled,
        commissionBps: c.commissionBps,
        commissionPct: c.commissionPct,
        commissionAppliesToDeposit: c.commissionAppliesToDeposit,
      },
      create: c,
    });
  }

  // 8) Services base
  const jetski = await prisma.service.upsert({
    where: { code: "JETSKI" },
    update: { isActive: true, category: "JETSKI" },
    create: {
      code: "JETSKI",
      name: "Jetski",
      category: "JETSKI",
      requiresPlatform: true,
      requiresJetski: true,
      requiresMonitor: true,
      isActive: true,
    },
  });

  const gopro = await prisma.service.upsert({
    where: { code: "GOPRO" },
    update: { isActive: true, category: "EXTRA" },
    create: {
      code: "GOPRO",
      name: "GoPro",
      category: "EXTRA",
      requiresPlatform: false,
      requiresJetski: false,
      requiresMonitor: false,
      isActive: true,
    },
  });

  // Servicios usados por las comisiones
  const flyboard = await prisma.service.upsert({
    where: { code: "FLYBOARD" },
    update: { isActive: true, category: "NAUTICA" },
    create: {
      code: "FLYBOARD",
      name: "Flyboard",
      category: "NAUTICA",
      requiresPlatform: false,
      requiresJetski: false,
      requiresMonitor: true,
      isActive: true,
    },
  });

  const parasailing = await prisma.service.upsert({
    where: { code: "PARASAILING" },
    update: { isActive: true, category: "NAUTICA" },
    create: {
      code: "PARASAILING",
      name: "Parasailing",
      category: "NAUTICA",
      requiresPlatform: false,
      requiresJetski: false,
      requiresMonitor: true,
      isActive: true,
    },
  });

  const wake15 = await prisma.service.upsert({
    where: { code: "WAKEBOARD_15" },
    update: { isActive: true, category: "NAUTICA" },
    create: {
      code: "WAKEBOARD_15",
      name: "Wakeboard 15 min",
      category: "NAUTICA",
      requiresPlatform: false,
      requiresJetski: false,
      requiresMonitor: true,
      isActive: true,
    },
  });

  const wake30 = await prisma.service.upsert({
    where: { code: "WAKEBOARD_30" },
    update: { isActive: true, category: "NAUTICA" },
    create: {
      code: "WAKEBOARD_30",
      name: "Wakeboard 30 min",
      category: "NAUTICA",
      requiresPlatform: false,
      requiresJetski: false,
      requiresMonitor: true,
      isActive: true,
    },
  });

  const banana = await prisma.service.upsert({
    where: { code: "BANANA_BOAT" },
    update: { isActive: true, category: "NAUTICA" },
    create: {
      code: "BANANA_BOAT",
      name: "Banana Boat",
      category: "NAUTICA",
      requiresPlatform: false,
      requiresJetski: false,
      requiresMonitor: true,
      isActive: true,
    },
  });

  // 9) Options
  const existingJetski60 = await prisma.serviceOption.findFirst({
    where: { serviceId: jetski.id, durationMinutes: 60, paxMax: 2 },
  });

  const jetski60 =
    existingJetski60 ??
    (await prisma.serviceOption.create({
      data: {
        serviceId: jetski.id,
        code: "JETSKI_60_2",
        durationMinutes: 60,
        paxMax: 2,
        contractedMinutes: 60,
        basePriceCents: 15000,
        isActive: true,
      },
    }));

  // 10) ServicePrice
  const jetski60PriceExists = await prisma.servicePrice.findFirst({
    where: { serviceId: jetski.id, durationMin: 60, isActive: true },
  });

  if (!jetski60PriceExists) {
    await prisma.servicePrice.create({
      data: {
        serviceId: jetski.id,
        durationMin: 60,
        basePriceCents: 15000,
      },
    });
  }

  const goproPriceExists = await prisma.servicePrice.findFirst({
    where: { serviceId: gopro.id, durationMin: null, isActive: true },
  });

  if (!goproPriceExists) {
    await prisma.servicePrice.create({
      data: {
        serviceId: gopro.id,
        durationMin: null,
        basePriceCents: 3000,
      },
    });
  }

  // 11) Comisiones por canal/actividad
  const oyde = await prisma.channel.findFirst({ where: { name: "Oyde" }, select: { id: true } });
  const brutal = await prisma.channel.findFirst({ where: { name: "Brutal" }, select: { id: true } });

  if (!oyde) throw new Error("Canal Oyde no existe en seed");
  if (!brutal) throw new Error("Canal Brutal no existe en seed");

  await upsertCommissionRule({
    channelId: oyde.id,
    serviceId: await serviceIdByName("Jetski"),
    commissionPct: 25,
  });
  await upsertCommissionRule({
    channelId: oyde.id,
    serviceId: await serviceIdByName("Flyboard"),
    commissionPct: 20,
  });
  await upsertCommissionRule({
    channelId: oyde.id,
    serviceId: await serviceIdByName("Wakeboard 15 min"),
    commissionPct: 14,
  });
  await upsertCommissionRule({
    channelId: oyde.id,
    serviceId: await serviceIdByName("Wakeboard 30 min"),
    commissionPct: 20,
  });
  await upsertCommissionRule({
    channelId: oyde.id,
    serviceId: await serviceIdByName("Banana Boat"),
    commissionPct: 30,
  });

  await upsertCommissionRule({
    channelId: brutal.id,
    serviceId: parasailing.id,
    commissionPct: 50,
  });
  await upsertCommissionRule({
    channelId: brutal.id,
    serviceId: flyboard.id,
    commissionPct: 50,
  });

  // 12) Extras tiempo
  await ensureExtraTimeServices();

  console.log("📦 Catálogo seed OK:", {
    jetskiServiceId: jetski.id,
    jetski60OptionId: jetski60.id,
    goproServiceId: gopro.id,
    flyboardServiceId: flyboard.id,
    parasailingServiceId: parasailing.id,
    wake15ServiceId: wake15.id,
    wake30ServiceId: wake30.id,
    bananaServiceId: banana.id,
  });

  console.log("✅ Seed completado.");
  console.log("Usuarios creados:", users.map((u) => u.username).join(", "));
  console.log("Contraseña temporal:", TEMP_PASSWORD);

  // 13) Expense categories
  for (const c of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        description: c.description,
        isActive: true,
      },
      create: {
        name: c.name,
        code: c.code,
        description: c.description,
        isActive: true,
      },
    });
  }

  // 14) Expense vendors
  for (const v of expenseVendors) {
    await prisma.expenseVendor.upsert({
      where: { code: v.code },
      update: {
        name: v.name,
        taxId: v.taxId,
        isActive: true,
      },
      create: {
        name: v.name,
        code: v.code,
        taxId: v.taxId,
        isActive: true,
      },
    });
  }
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pgPool.end();
  });

const expenseCategories = [
  {
    name: "Combustible",
    code: "FUEL",
    description: "Gasolina, combustible embarcaciones, jetskis y vehículos",
  },
  {
    name: "Comisiones bancarias",
    code: "BANK_FEES",
    description: "TPV, transferencias, comisiones bancarias, descubierto e intereses",
  },
  {
    name: "Impuestos y cotizaciones",
    code: "TAX_SOCIAL",
    description: "IVA, Hacienda, Seguridad Social y otras obligaciones",
  },
  {
    name: "Gestoría y asesoría",
    code: "LEGAL_ADMIN",
    description: "Asesoría, gestoría, trámites administrativos y soporte legal",
  },
  {
    name: "Oficina y software",
    code: "OFFICE_SOFTWARE",
    description: "Servidores, apps, software y herramientas de administración",
  },
  {
    name: "Marketing",
    code: "MARKETING",
    description: "Publicidad, reseñas, campañas, promoción y captación",
  },
  {
    name: "Suministros",
    code: "SUPPLIES",
    description: "Agua, luz, limpieza, material consumible y telecomunicaciones",
  },
  {
    name: "Puerto y marina",
    code: "PORT_FEES",
    description: "Gastos portuarios, marina, tasas e instalaciones",
  },
  {
    name: "Recambios",
    code: "SPARE_PARTS",
    description: "Piezas, componentes, recambios y material técnico",
  },
  {
    name: "Taller externo",
    code: "EXT_WORKSHOP",
    description: "Reparaciones y trabajos realizados por taller externo",
  },
  {
    name: "Personal externo",
    code: "EXTERNAL_STAFF",
    description: "Soporte externo, servicios profesionales y personal no interno",
  },
  {
    name: "Financiación y amortización",
    code: "FINANCING",
    description: "Créditos, tarjetas, amortizaciones y costes financieros",
  },
  {
    name: "Operativa general",
    code: "GENERAL_OPS",
    description: "Gasto general no clasificado en categorías específicas",
  },
];

const expenseVendors = [
  { name: "Sabadell", code: "SABADELL", taxId: null },
  { name: "Hacienda", code: "HACIENDA", taxId: null },
  { name: "Seguridad Social", code: "SEG_SOCIAL", taxId: null },
  { name: "Asesoría Lluro", code: "ASESORIA_LLURO", taxId: null },
  { name: "Cloudways", code: "CLOUDWAYS", taxId: null },
  { name: "WCM", code: "WCM", taxId: null },
  { name: "Google", code: "GOOGLE", taxId: null },
  { name: "Telefónica", code: "TELEFONICA", taxId: null },
  { name: "Marina Badalona", code: "MARINA_BADALONA", taxId: null },
  { name: "Cepsa", code: "CEPSA", taxId: null },
  { name: "Mercadona", code: "MERCADONA", taxId: null },
];
