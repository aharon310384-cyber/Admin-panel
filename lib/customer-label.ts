export type CustomerLabelInput = {
  name: string;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  postalCode?: string | null;
  address?: string | null;
  phone?: string | null;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cleanAddressLine(
  address: string | null | undefined,
  parts: Array<string | null | undefined>
): string {
  if (!address) return "";
  let result = address;
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    result = result.replace(new RegExp(escapeRegex(trimmed), "gi"), "");
  }
  return result
    .replace(/[ \t]+/g, " ")
    .replace(/\s*,\s*,+\s*/g, ", ")
    .replace(/^[\s,;:]+|[\s,;:]+$/g, "")
    .trim();
}

export function customerLabel(customer: CustomerLabelInput): string {
  const street = cleanAddressLine(customer.address, [
    customer.country,
    customer.countryCode,
    customer.city,
    customer.postalCode,
  ]);
  const details = [
    customer.country,
    customer.city,
    customer.postalCode,
    street,
    customer.phone,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  return details ? `${customer.name} (${details})` : customer.name;
}
