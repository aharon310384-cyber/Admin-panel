export type ParsedOrderRoute = {
  routePrefix: string;
  routeNumber: string;
  routeCountry: string;
};

const ORDER_ROUTE_PATTERN = /^([A-Z]{1,6}?)(\d+)([A-Z]{2,4})(?=$|[^A-Z0-9])/i;

export function parseOrderRoute(orderNumber: string | null | undefined): ParsedOrderRoute | null {
  const normalized = orderNumber?.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(ORDER_ROUTE_PATTERN);
  if (!match) {
    return null;
  }

  return {
    routePrefix: match[1],
    routeNumber: match[2],
    routeCountry: match[3],
  };
}
