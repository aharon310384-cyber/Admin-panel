import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ProductNameSeed = {
  sourceRow: number;
  code: string;
  nameRu: string;
  nameEn: string;
  nameCn: string;
};

const PRODUCT_NAMES: ProductNameSeed[] = [
  {
    sourceRow: 2,
    code: "PF-010000",
    nameRu: "Авто, Мото, Инструмент",
    nameEn: "Auto, Moto, Tool",
    nameCn: "汽車、摩托車、工具",
  },
  {
    sourceRow: 3,
    code: "PF-020000",
    nameRu: "Бизнес",
    nameEn: "Business",
    nameCn: "商業",
  },
  {
    sourceRow: 4,
    code: "PF-030000",
    nameRu: "Бытовая техника",
    nameEn: "Appliances",
    nameCn: "家電",
  },
  {
    sourceRow: 5,
    code: "PF-040000",
    nameRu: "Зоотовары",
    nameEn: "Pet supplies",
    nameCn: "寵物用品",
  },
  {
    sourceRow: 6,
    code: "PF-050000",
    nameRu: "Красота и здоровье",
    nameEn: "Health and beauty",
    nameCn: "健康和美麗",
  },
  {
    sourceRow: 7,
    code: "PF-060000",
    nameRu: "Ноутбуки, ПК, оргтехника",
    nameEn: "Laptops, PCs, office equipment",
    nameCn: "筆記本電腦、個人電腦、辦公設備",
  },
  {
    sourceRow: 8,
    code: "PF-070000",
    nameRu: "Одежда",
    nameEn: "Clothing",
    nameCn: "衣服",
  },
  {
    sourceRow: 9,
    code: "PF-080000",
    nameRu: "Продукты питания, напитки, БАДы",
    nameEn: "Food, drinks, dietary supplements",
    nameCn: "食品、飲料、膳食補充劑",
  },
  {
    sourceRow: 10,
    code: "PF-090000",
    nameRu: "Сетевое оборудование",
    nameEn: "Network hardware",
    nameCn: "網絡硬件",
  },
  {
    sourceRow: 11,
    code: "PF-100000",
    nameRu: "Спорт, увлечения, хобби",
    nameEn: "Sports, hobbies, hobbies",
    nameCn: "運動、愛好、愛好",
  },
  {
    sourceRow: 12,
    code: "PF-110000",
    nameRu: "Сумки, обувь, аксессуары",
    nameEn: "Bags, shoes, accessories",
    nameCn: "包包、鞋子、配飾",
  },
  {
    sourceRow: 13,
    code: "PF-120000",
    nameRu: "Товары для детей",
    nameEn: "Goods for kids",
    nameCn: "兒童用品",
  },
  {
    sourceRow: 14,
    code: "PF-130000",
    nameRu: "Товары для дома",
    nameEn: "Household products",
    nameCn: "家庭用品",
  },
  {
    sourceRow: 15,
    code: "PF-140000",
    nameRu: "Фото и видеотехника",
    nameEn: "Photo and video equipment",
    nameCn: "照片和視頻設備",
  },
  {
    sourceRow: 16,
    code: "PF-150000",
    nameRu: "Электроника",
    nameEn: "Electronics",
    nameCn: "電子產品",
  },
];

async function main() {
  for (const item of PRODUCT_NAMES) {
    await prisma.productName.upsert({
      where: { code: item.code },
      update: {
        nameRu: item.nameRu,
        nameEn: item.nameEn,
        nameCn: item.nameCn,
        sourceRow: item.sourceRow,
        deletedAt: null,
      },
      create: item,
    });
  }

  console.log(`Imported product names: ${PRODUCT_NAMES.length}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
