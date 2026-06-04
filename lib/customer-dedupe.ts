export type CustomerDedupeInput = {
  id: string;
  code: string | null;
  clientCode: string | null;
  name: string;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  country?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone: string | null;
  address?: string | null;
  informationDate?: Date | null;
  sourceRow?: number | null;
};

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['`\u2019]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePostalCode(value: string | null | undefined): string {
  return normalizeIdentity(value).replace(/[\s-]/g, "");
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function duplicateKey(customer: CustomerDedupeInput): string {
  const fallbackName = customer.lastName || customer.name;

  return [
    normalizeIdentity(customer.clientCode ?? customer.code),
    normalizeIdentity(fallbackName),
    normalizeIdentity(customer.firstName),
    normalizeIdentity(customer.middleName),
    normalizeIdentity(customer.country),
    normalizeIdentity(customer.city),
    normalizePostalCode(customer.postalCode),
    normalizePhone(customer.phone),
  ].join("|");
}

function rowScore(customer: CustomerDedupeInput): number {
  const informationTime = customer.informationDate?.getTime() ?? 0;
  const sourceRow = customer.sourceRow ?? 0;
  const completeness = [
    customer.address,
    customer.phone,
    customer.postalCode,
    customer.country,
    customer.city,
  ].filter(Boolean).length;

  return informationTime * 100000 + sourceRow * 10 + completeness;
}

export function dedupeCustomers<T extends CustomerDedupeInput>(
  customers: T[],
  options: { preferredId?: string | null } = {}
): T[] {
  const byKey = new Map<string, T>();

  for (const customer of customers) {
    const key = duplicateKey(customer);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, customer);
      continue;
    }

    if (customer.id === options.preferredId) {
      byKey.set(key, customer);
      continue;
    }

    if (existing.id === options.preferredId) {
      continue;
    }

    byKey.set(key, rowScore(customer) > rowScore(existing) ? customer : existing);
  }

  return [...byKey.values()];
}
