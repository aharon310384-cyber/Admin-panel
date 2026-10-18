// Начальные данные компаний: PostmanFox и ShuTai. Запускается при деплое (npm run db:upgrade) и вручную:
//   npm run db:upgrade:companies
//
// Бренды (решение владельца 2026-10-18, docs/product/будущее.md, раздел 6):
// админка (склад) — ShuTai, кабинет клиента и Telegram — PostmanFox.
// Компания создаётся, только если её ещё нет: то, что поменяли в «Администрирование → Компании», не трогается.
// Отметка бренда ставится, только если её нет у другой компании. Повторный запуск ничего не меняет.
import { readFile } from "fs/promises";
import path from "path";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Seed = Omit<Prisma.CompanyCreateInput, "logo" | "icon"> & { logoFile?: string; iconFile?: string };

const COMPANIES: Seed[] = [
  {
    code: "SHUTAI",
    name: "ShuTai",
    legalName: "Guangzhou ShuTai Trading Co., Ltd.",
    adminBrand: true,
  },
  {
    code: "POSTMANFOX",
    name: "PostmanFox",
    tagline: "посылки из Китая",
    siteUrl: "https://postmanfox.com/",
    trackingUrl: "https://postmanfox.com/ru/treking-posylok/",
    telegramGreeting: "Здравствуйте! 🦊 Это кабинет PostmanFox.",
    logoFile: "public/brand/logo.png",
    iconFile: "public/brand/favicon.png",
    cabinetBrand: true,
  },
];

async function image(file: string | undefined) {
  if (!file) return {};
  try {
    return { bytes: new Uint8Array(await readFile(path.join(process.cwd(), file))), type: "image/png" };
  } catch {
    console.warn(`  нет файла ${file} — без картинки, её можно загрузить в карточке компании`);
    return {};
  }
}

async function main() {
  for (const { logoFile, iconFile, ...seed } of COMPANIES) {
    if (await prisma.company.findUnique({ where: { code: seed.code }, select: { id: true } })) continue;

    const adminTaken = seed.adminBrand && (await prisma.company.count({ where: { adminBrand: true } })) > 0;
    const cabinetTaken = seed.cabinetBrand && (await prisma.company.count({ where: { cabinetBrand: true } })) > 0;
    const logo = await image(logoFile);
    const icon = await image(iconFile);

    await prisma.company.create({
      data: {
        ...seed,
        adminBrand: Boolean(seed.adminBrand) && !adminTaken,
        cabinetBrand: Boolean(seed.cabinetBrand) && !cabinetTaken,
        logo: logo.bytes,
        logoType: logo.type,
        icon: icon.bytes,
        iconType: icon.type,
      },
    });
    console.log(`Компания ${seed.name} создана`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
