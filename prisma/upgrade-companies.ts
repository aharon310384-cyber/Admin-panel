// Начальные данные компаний: PostmanFox и ShuTai. Запускается при деплое (npm run db:upgrade) и вручную:
//   npm run db:upgrade:companies
//
// Бренды (решение владельца 2026-10-18, docs/product/будущее.md, раздел 6):
// админка (склад) — ShuTai, кабинет клиента и Telegram — PostmanFox.
// Компания создаётся, только если её ещё нет: то, что поменяли в «Администрирование → Компании», не трогается.
// Отметка бренда ставится, только если её нет у другой компании. Повторный запуск ничего не меняет.
// Логотип и знак PostmanFox — файлы в prisma/seed-data/postmanfox/: программа берёт их только из карточки компании.
// Цвета компаний не задаются: админка и кабинет в стандартных цветах, пока их не впишут в карточке
// (решение владельца 2026-10-26). Цвета ShuTai, поставленные первой версией шага 4, убираются.
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
    logoFile: "prisma/seed-data/postmanfox/logo.png",
    iconFile: "prisma/seed-data/postmanfox/icon.png",
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
  await clearFirstColors();
}

// Первая версия шага 4 ставила ShuTai цвета #183E42 / #D7663D. Убираем только эту пару:
// цвета, выбранные в карточке, не трогаются.
async function clearFirstColors() {
  const cleared = await prisma.company.updateMany({
    where: { code: "SHUTAI", primaryColor: "#183E42", accentColor: "#D7663D" },
    data: { primaryColor: null, accentColor: null },
  });
  if (cleared.count) console.log("Компания ShuTai: цвета убраны — админка в стандартных цветах");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
