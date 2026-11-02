export type SortDirection = "asc" | "desc";

export function parsePageParam(raw: string | undefined): number {
  const page = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(page) ? Math.max(1, page) : 1;
}

export function parseSortParam<F extends string>(
  raw: string | undefined,
  allowedFields: readonly F[],
  defaultField: F,
  defaultDirection: SortDirection = "desc"
): [F, SortDirection] {
  const [field, direction] = (raw ?? `${defaultField}_${defaultDirection}`).split("_");
  const isAllowed = (allowedFields as readonly string[]).includes(field);
  return [
    isAllowed ? (field as F) : defaultField,
    direction === "asc" ? "asc" : "desc",
  ];
}

export function buildListHref(
  pathname: string,
  values: Record<string, string | undefined>,
  overrides: Record<string, string | null | undefined> = {}
): string {
  const query = new URLSearchParams();
  const merged = { ...values, ...overrides };

  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      query.set(key, value);
    }
  }

  const params = query.toString();
  return params ? `${pathname}?${params}` : pathname;
}

/**
 * Журнал документов по дате от старых к новым, как в 1С: если строк больше предела, видны последние —
 * новые внизу, а не первые. Запрос идёт от новых к старым (queryDir), строки потом переворачиваются (tail).
 */
export function journalOrder(field: string, direction: SortDirection) {
  const tail = field === "createdAt" && direction === "asc";
  return { tail, queryDir: tail ? ("desc" as const) : direction };
}
