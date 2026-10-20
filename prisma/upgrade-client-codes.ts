// Коды клиентов — только заглавные латинские буквы (KC, SM, ABC): начало номера строки Excel и номера задачи.
// Исправляет коды, набранные маленькими или русскими буквами («кс», «КС», «kc» → KC), если такой код ещё свободен.
// Запускается при деплое (npm run db:upgrade) и вручную: npm run db:upgrade:client-codes. Повторный запуск ничего не меняет.
// В журнал — только количество, без кодов и имён клиентов (журнал выкладки открыт).
import { PrismaClient } from "@prisma/client";
import { latinCode } from "../lib/excel-check";

const prisma = new PrismaClient();
const VALID = /^[A-Z]{2,4}$/;

async function main() {
  const customers = await prisma.customer.findMany({ where: { code: { not: null } }, select: { id: true, code: true } });
  const taken = new Set(customers.map((c) => c.code));
  let fixed = 0;
  let left = 0;
  for (const customer of customers) {
    if (!customer.code || VALID.test(customer.code)) continue;
    const code = latinCode(customer.code);
    if (!VALID.test(code) || taken.has(code)) {
      left++;
      continue;
    }
    await prisma.customer.update({ where: { id: customer.id }, data: { code } });
    taken.delete(customer.code);
    taken.add(code);
    fixed++;
  }
  console.log(`Коды клиентов: исправлено ${fixed}, не исправлено (занято или не буквы) ${left}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
