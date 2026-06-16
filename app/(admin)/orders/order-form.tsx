"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { resolveCustomerFromParsedRecipient } from "@/actions/customers";
import { customerLabel } from "@/lib/customer-label";
import { formatUsd, slugify } from "@/lib/utils";

type FormState = { error?: Record<string, string[]> };
type ActionFn = (formData: FormData) => Promise<FormState | void>;
type CustomerOption = {
  id: string;
  name: string;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  email: string | null;
  phone: string | null;
  code: string | null;
  clientCode: string | null;
  country?: string | null;
  city?: string | null;
  postalCode?: string | null;
  address?: string | null;
};

type Props = {
  action: ActionFn;
  product?: {
    name: string;
    slug: string;
    sku: string;
    customerId: string | null;
    deliveryType: string | null;
    comments: string | null;
    description: string | null;
    price: number;
    stock: number;
    imageUrl: string | null;
    isActive: boolean;
    trackItems?: ProductTrackItemForForm[];
  };
  customers: CustomerOption[];
};

type ProductTrackItemForForm = {
  id: string;
  trackNumber: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productUrl: string | null;
  imageUrl: string | null;
  photoReport: boolean;
  photoReportUrl: string | null;
};

type TrackItemField = {
  id: string;
  trackNumber: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  productUrl: string;
  photoReport: boolean;
  photoReportUrl: string;
};

type TrackItemDraft = Omit<TrackItemField, "id">;

type RecipientDraft = {
  name: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  address: string | null;
};

type DescriptionDraft = {
  trackItems: TrackItemDraft[];
  deliveryType: string | null;
  recipient: RecipientDraft | null;
  comments: string | null;
};

const DELIVERY_TYPE_OPTIONS = [
  "Авиа",
  "Авто",
  "Море",
  "Ж/д",
  "DHL",
  "Экспресс",
];

function numberInputValue(value: number | null | undefined): string {
  return value && Number.isFinite(value) ? String(value) : "";
}

function initialTrackItemFields(product: Props["product"]): TrackItemField[] {
  if (product?.trackItems?.length) {
    return product.trackItems.map((item, index) => ({
      id: item.id || `track-${index}`,
      trackNumber: item.trackNumber,
      itemName: item.name,
      quantity: numberInputValue(item.quantity) || "1",
      unitPrice: numberInputValue(item.unitPrice),
      productUrl: item.productUrl ?? item.imageUrl ?? "",
      photoReport: item.photoReport,
      photoReportUrl: item.photoReportUrl ?? "",
    }));
  }

  const trackNumbers = product?.name
    ?.split(/\r?\n/)
    .map((trackNumber) => trackNumber.trim())
    .filter(Boolean);

  return trackNumbers?.length
    ? trackNumbers.map((trackNumber, index) => ({
        id: `track-${index}`,
        trackNumber,
        itemName: product?.description ?? "",
        quantity: index === 0 ? numberInputValue(product?.stock) || "1" : "1",
        unitPrice: numberInputValue(product?.price),
        productUrl: index === 0 ? product?.imageUrl ?? "" : "",
        photoReport: false,
        photoReportUrl: "",
      }))
    : [
        {
          id: "track-0",
          trackNumber: "",
          itemName: "",
          quantity: "1",
          unitPrice: "",
          productUrl: "",
          photoReport: false,
          photoReportUrl: "",
        },
      ];
}

function numericInputValue(value: string): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function trackItemTotal(item: TrackItemField): number {
  return numericInputValue(item.quantity) * numericInputValue(item.unitPrice);
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanUrl(value: string): string {
  return value.trim().replace(/[),.;]+$/g, "");
}

function firstUrl(value: string): string | null {
  const match = value.match(/\b(?:https?:\/\/|www\.)[^\s,;)\]]+/i);
  return match ? cleanUrl(match[0]) : null;
}

function normalizeHref(value: string): string | null {
  const href = value.trim();

  if (!href) return null;

  return /^https?:\/\//i.test(href) ? href : `https://${href}`;
}

function TrackLinkOpen({ value, label }: { value: string; label: string }) {
  const href = normalizeHref(value);

  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`track-link-open-button ${
        href ? "" : "track-link-open-button--disabled"
      }`}
      aria-disabled={!href}
      aria-label={label}
      title={label}
      tabIndex={href ? 0 : -1}
      onClick={(event) => {
        if (!href) event.preventDefault();
      }}
    >
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

function emptyTrackDraft(): TrackItemDraft {
  return {
    trackNumber: "",
    itemName: "",
    quantity: "1",
    unitPrice: "",
    productUrl: "",
    photoReport: false,
    photoReportUrl: "",
  };
}

function hasTrackDraftData(item: TrackItemDraft): boolean {
  return Boolean(
    item.trackNumber ||
      item.itemName ||
      item.unitPrice ||
      item.productUrl ||
      item.photoReport ||
      item.photoReportUrl
  );
}

function splitLabelValue(line: string): { label: string; value: string } | null {
  const match = line.match(/^\s*([^:=：-]{2,48})\s*[:=：-]\s*(.+?)\s*$/);

  if (!match) return null;

  return {
    label: match[1].toLowerCase().trim(),
    value: match[2].trim(),
  };
}

const TRACK_CANDIDATE_PATTERN = /[+-]?(?:[A-Z]{1,4}\d[A-Z0-9-]{7,36}|\d{10,36})/i;

function cleanTrackNumber(value: string): string {
  return value.replace(/^[+-]+/, "").trim();
}

function extractTrackNumber(value: string): string | null {
  const labelMatch = value.match(
    /(?:трек(?:\s*номер)?|track(?:ing)?(?:\s*number)?)\s*[:=：-]?\s*([+-]?[a-z0-9-]{8,40})/i
  );
  if (labelMatch?.[1]) return cleanTrackNumber(labelMatch[1]);

  const standaloneMatch = value.match(TRACK_CANDIDATE_PATTERN);
  return standaloneMatch ? cleanTrackNumber(standaloneMatch[0]) : null;
}

function parsePositiveNumber(value: string): string | null {
  const match = value.replace(/\s+/g, "").match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;

  const normalized = match[0].replace(",", ".");
  return Number.isFinite(Number(normalized)) ? normalized : null;
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.toLowerCase().trim();

  if (/^(да|есть|true|yes|1|\+)$/.test(normalized)) return true;
  if (/^(нет|false|no|0|-)$/.test(normalized)) return false;

  return null;
}

function normalizeDelivery(value: string): string | null {
  const normalized = value.toLowerCase();

  if (normalized.includes("dhl")) return "DHL";
  if (normalized.includes("экспресс") || normalized.includes("express")) return "Экспресс";
  if (normalized.includes("авиа") || normalized.includes("air")) return "Авиа";
  if (normalized.includes("авто") || normalized.includes("auto")) return "Авто";
  if (normalized.includes("море") || normalized.includes("sea")) return "Море";
  if (normalized.includes("ж/д") || normalized.includes("жд") || normalized.includes("rail")) {
    return "Ж/д";
  }

  return null;
}

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`\u2019]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function normalizePostalCode(value: string | null | undefined): string {
  return normalizeIdentity(value).replace(/[\s-]/g, "");
}

function textTokens(value: string | null | undefined): string[] {
  return normalizeIdentity(value)
    .split(/[^a-zа-яё0-9]+/i)
    .filter((token) => token.length > 1);
}

function tokenOverlapScore(source: string | null, candidate: string | null, weight: number): number {
  const sourceTokens = textTokens(source);
  if (sourceTokens.length === 0) return 0;

  const candidateTokens = new Set(textTokens(candidate));
  if (candidateTokens.size === 0) return 0;

  const matched = sourceTokens.filter((token) => candidateTokens.has(token)).length;
  return Math.round((matched / sourceTokens.length) * weight);
}

function customerNameText(customer: CustomerOption): string {
  return [customer.name, customer.lastName, customer.firstName, customer.middleName]
    .filter(Boolean)
    .join(" ");
}

function customerAddressText(customer: CustomerOption): string {
  return [customer.address, customer.city, customer.postalCode, customer.country]
    .filter(Boolean)
    .join(" ");
}

function scoreCustomerOption(recipient: RecipientDraft, customer: CustomerOption): number {
  let score = 0;
  const recipientPhone = normalizePhone(recipient.phone);
  const customerPhone = normalizePhone(customer.phone);

  if (recipientPhone && customerPhone) {
    if (recipientPhone === customerPhone) {
      score += 120;
    } else if (recipientPhone.includes(customerPhone) || customerPhone.includes(recipientPhone)) {
      score += 90;
    }
  }

  score += tokenOverlapScore(recipient.name, customerNameText(customer), 35);

  if (
    recipient.postalCode &&
    customer.postalCode &&
    normalizePostalCode(recipient.postalCode) === normalizePostalCode(customer.postalCode)
  ) {
    score += 24;
  }

  if (
    recipient.city &&
    customer.city &&
    normalizeIdentity(recipient.city) === normalizeIdentity(customer.city)
  ) {
    score += 18;
  }

  if (
    recipient.country &&
    customer.country &&
    normalizeIdentity(recipient.country) === normalizeIdentity(customer.country)
  ) {
    score += 12;
  }

  score += tokenOverlapScore(recipient.address, customerAddressText(customer), 22);

  return score;
}

function findCustomerOption(
  recipient: RecipientDraft,
  customers: CustomerOption[]
): CustomerOption | null {
  const threshold = normalizePhone(recipient.phone) ? 80 : 45;
  const best = customers
    .map((customer) => ({ customer, score: scoreCustomerOption(recipient, customer) }))
    .sort((left, right) => right.score - left.score)[0];

  return best && best.score >= threshold ? best.customer : null;
}

function emptyRecipientDraft(): RecipientDraft {
  return {
    name: null,
    phone: null,
    country: null,
    city: null,
    postalCode: null,
    address: null,
  };
}

function hasRecipientData(recipient: RecipientDraft | null): recipient is RecipientDraft {
  return Boolean(recipient && Object.values(recipient).some(Boolean));
}

function mergeRecipientDraft(
  recipient: RecipientDraft,
  patch: Partial<RecipientDraft>
): RecipientDraft {
  return {
    name: recipient.name ?? patch.name ?? null,
    phone: recipient.phone ?? patch.phone ?? null,
    country: recipient.country ?? patch.country ?? null,
    city: recipient.city ?? patch.city ?? null,
    postalCode: recipient.postalCode ?? patch.postalCode ?? null,
    address: recipient.address ?? patch.address ?? null,
  };
}

function extractPhone(value: string): string | null {
  const match = value.match(/\+?\d[\d\s().-]{7,}\d/);
  if (!match) return null;

  const phone = cleanText(match[0]);
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? phone : null;
}

function extractPostalCode(value: string): string | null {
  const labelled = value.match(/\b(?:post(?:al)?\s*code|zip|индекс)\s*[:=]?\s*([^,;]+)/i);
  if (labelled?.[1]) return cleanText(labelled[1]);

  const generic = value.match(/\b\d{2}-\d{3}\b/);
  return generic ? generic[0] : null;
}

function extractCity(value: string): string | null {
  const match = value.match(/\b(?:city|город)\s*[:=]?\s*([^,;]+)/i);
  return match?.[1] ? cleanText(match[1]) : null;
}

function extractCountry(value: string): string | null {
  const normalized = value.toLowerCase();

  if (/\b(?:poland|polska|польша)\b/i.test(normalized)) return "Poland";
  if (/\b(?:germany|deutschland|германия)\b/i.test(normalized)) return "Germany";
  if (/\b(?:ukraine|украина|україна)\b/i.test(normalized)) return "Ukraine";
  if (/\b(?:china|китай)\b/i.test(normalized)) return "China";

  return null;
}

function isAddressLike(value: string): boolean {
  return /\b(?:street|st\.|apt|apartment|post\s*code|postal|zip|city|country|address|ул\.?|улица|адрес|дом|кв|индекс)\b/i.test(
    value
  ) || Boolean(extractCountry(value));
}

function recipientFromAddress(value: string): Partial<RecipientDraft> {
  const address = cleanText(value);

  return {
    address: address || null,
    city: extractCity(value),
    postalCode: extractPostalCode(value),
    country: extractCountry(value),
  };
}

function recipientFromNameAndPhone(value: string): Partial<RecipientDraft> {
  const phone = extractPhone(value);
  const withoutPhone = phone ? cleanText(value.replace(phone, "")) : cleanText(value);
  const name = withoutPhone && !isAddressLike(withoutPhone) ? withoutPhone : null;

  return { name, phone };
}

function stripListMarker(value: string): string {
  return value.replace(/^\s*\d+[\s.,):;-]+/, "").trim();
}

function descriptionLogicalLines(source: string): string[] {
  const compact = source.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  if (!compact) return [];

  const trackPattern = TRACK_CANDIDATE_PATTERN.source;
  return compact
    .replace(new RegExp(`\\s+(?=\\d+[\\s.,):;-]+${trackPattern})`, "gi"), "\n")
    .replace(/\s+(?=(?:вид\s*достав(?:ки)?|доставка|delivery)\s*[:=：-])/gi, "\n")
    .replace(
      /\s+(?=(?:получател|клиент|recipient|customer|телефон|phone|mobile|tel|адрес|address|коммент|comment)\s*[:=：-])/gi,
      "\n"
    )
    .replace(/\s+(?=(?:street|st\.|address)\b)/gi, "\n")
    .replace(
      /\s+(?=[A-Za-zА-Яа-яЁё'’.-]+\s+[A-Za-zА-Яа-яЁё'’.-]+\s+\+?\d[\d\s().-]{7,}\d\b)/g,
      "\n"
    )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePriceFromTrackRest(value: string): string | null {
  const normalizedValue = value.replace(/[).]+$/g, "").trim();
  const currencyMatch = normalizedValue.match(/(\d+(?:[.,]\d+)?)\s*(?:\$|usd|дол(?:лар)?|€)\s*$/i);
  const separatorMatch = normalizedValue.match(/[,;]\s*(\d+(?:[.,]\d+)?)\s*$/);
  const rawPrice = currencyMatch?.[1] ?? separatorMatch?.[1];

  if (!rawPrice) return null;

  const normalized = rawPrice.replace(",", ".");
  return Number.isFinite(Number(normalized)) ? normalized : null;
}

function stripTrackPrice(value: string): string {
  return value
    .replace(/\s*,?\s*\d+(?:[.,]\d+)?\s*(?:\$|usd|дол(?:лар)?|€)\s*[).]*$/i, "")
    .replace(/[,;]\s*\d+(?:[.,]\d+)?\s*[).]*$/, "")
    .trim();
}

function parseQuantityFromTrackName(value: string): string {
  const matches = [
    ...value.matchAll(
      /\b(\d+)\s*(?:шт\.?|штук|ед\.?|пар|pcs?|кофт\w*|куртк\w*|штан\w*|брюк\w*|кошел\w*|нос\w*)/gi
    ),
  ];
  const quantity = matches.reduce((sum, match) => sum + Number(match[1]), 0);

  if (quantity > 0) return String(quantity);

  const leading = value.match(/^\s*(\d+)\b/);
  return leading?.[1] ?? "1";
}

function isTrackLabel(label: string): boolean {
  return /трек|track|tracking/.test(label);
}

function isNameLabel(label: string): boolean {
  return /наимен|назван|товар|item|product/.test(label);
}

function isQuantityLabel(label: string): boolean {
  return /колич|кол-во|qty|quantity/.test(label);
}

function isUnitPriceLabel(label: string): boolean {
  return /стоим.*единиц|цена|unit\s*price|price/.test(label) && !/итого|total/.test(label);
}

function isProductUrlLabel(label: string): boolean {
  return /ссыл|link|url|товар.*ссыл|product.*url|item.*url/.test(label);
}

function isPhotoReportUrlLabel(label: string): boolean {
  return /ссыл.*фотоотч|фотоотч.*ссыл|photo.*report.*url/.test(label);
}

function isPhotoReportLabel(label: string): boolean {
  return /фотоотч|photo\s*report/.test(label);
}

function parseDelimitedTrackLine(line: string): TrackItemDraft | null {
  if (!/[|;]/.test(line)) return null;

  const parts = line
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const trackIndex = parts.findIndex((part) => Boolean(extractTrackNumber(part)));

  if (trackIndex < 0) return null;

  const trackNumber = extractTrackNumber(parts[trackIndex]) ?? "";
  const productUrl = parts.find((part) => firstUrl(part)) ?? "";
  const numericParts = parts
    .slice(trackIndex + 1)
    .map((part) => parsePositiveNumber(part))
    .filter((part): part is string => Boolean(part));

  return {
    ...emptyTrackDraft(),
    trackNumber,
    itemName:
      parts[trackIndex + 1] && !parsePositiveNumber(parts[trackIndex + 1])
        ? parts[trackIndex + 1]
        : "",
    quantity: numericParts[0] ?? "1",
    unitPrice: numericParts[1] ?? "",
    productUrl: productUrl ? firstUrl(productUrl) ?? productUrl : "",
  };
}

function parseNaturalTrackLine(line: string): TrackItemDraft | null {
  const normalizedLine = stripListMarker(line);
  const trackMatch = normalizedLine.match(new RegExp(`^${TRACK_CANDIDATE_PATTERN.source}`, "i"));

  if (!trackMatch?.[0]) return null;

  const rest = normalizedLine
    .slice(trackMatch[0].length)
    .replace(/^[\s:=-]+/, "")
    .trim();
  const itemName = stripTrackPrice(rest);
  const productUrl = firstUrl(line) ?? "";

  return {
    ...emptyTrackDraft(),
    trackNumber: cleanTrackNumber(trackMatch[0]),
    itemName,
    quantity: itemName ? parseQuantityFromTrackName(itemName) : "1",
    unitPrice: parsePriceFromTrackRest(rest) ?? "",
    productUrl,
  };
}

function parseDescriptionDraft(source: string): DescriptionDraft {
  const lines = descriptionLogicalLines(source);
  const trackItems: TrackItemDraft[] = [];
  let currentTrack = emptyTrackDraft();
  let deliveryType: string | null = null;
  let recipient = emptyRecipientDraft();
  let comments: string | null = null;

  const pushCurrentTrack = () => {
    if (hasTrackDraftData(currentTrack)) {
      currentTrack.photoReport = currentTrack.photoReport || Boolean(currentTrack.photoReportUrl);
      trackItems.push(currentTrack);
      currentTrack = emptyTrackDraft();
    }
  };

  for (const line of lines) {
    const labelled = splitLabelValue(line);
    const label = labelled?.label ?? "";
    const value = labelled?.value ?? "";
    const delimitedTrack = parseDelimitedTrackLine(line);
    const naturalTrack = parseNaturalTrackLine(line);

    if (delimitedTrack) {
      pushCurrentTrack();
      trackItems.push(delimitedTrack);
      continue;
    }

    if (naturalTrack) {
      pushCurrentTrack();
      trackItems.push(naturalTrack);
      continue;
    }

    if (labelled && /вид\s*достав|доставка|delivery/.test(label)) {
      deliveryType = normalizeDelivery(value) ?? deliveryType;
      continue;
    }

    if (labelled && /получател|клиент|recipient|customer/.test(label)) {
      recipient = mergeRecipientDraft(recipient, recipientFromNameAndPhone(value));
      continue;
    }

    if (labelled && /коммент|comment/.test(label)) {
      comments = value;
      continue;
    }

    if (labelled && /телефон|phone|mobile|tel/.test(label)) {
      recipient = mergeRecipientDraft(recipient, { phone: extractPhone(value) ?? value });
      continue;
    }

    if (labelled && /адрес|address|street/.test(label)) {
      recipient = mergeRecipientDraft(recipient, recipientFromAddress(value));
      continue;
    }

    if (labelled && /город|city/.test(label)) {
      recipient = mergeRecipientDraft(recipient, { city: value });
      continue;
    }

    if (labelled && /индекс|postal|post\s*code|zip/.test(label)) {
      recipient = mergeRecipientDraft(recipient, { postalCode: value });
      continue;
    }

    if (labelled && /страна|country/.test(label)) {
      recipient = mergeRecipientDraft(recipient, { country: extractCountry(value) ?? value });
      continue;
    }

    if (labelled && isPhotoReportUrlLabel(label)) {
      currentTrack.photoReportUrl = firstUrl(value) ?? value;
      currentTrack.photoReport = true;
      continue;
    }

    if (labelled && isProductUrlLabel(label)) {
      currentTrack.productUrl = firstUrl(value) ?? value;
      continue;
    }

    if (labelled && isPhotoReportLabel(label)) {
      currentTrack.photoReport = parseBoolean(value) ?? true;
      continue;
    }

    if (labelled && isTrackLabel(label)) {
      pushCurrentTrack();
      currentTrack.trackNumber = extractTrackNumber(value) ?? value;
      continue;
    }

    if (labelled && isNameLabel(label)) {
      currentTrack.itemName = value;
      continue;
    }

    if (labelled && isQuantityLabel(label)) {
      currentTrack.quantity = parsePositiveNumber(value) ?? currentTrack.quantity;
      continue;
    }

    if (labelled && isUnitPriceLabel(label)) {
      currentTrack.unitPrice = parsePositiveNumber(value) ?? currentTrack.unitPrice;
      continue;
    }

    deliveryType = deliveryType ?? normalizeDelivery(line);

    if (isAddressLike(line)) {
      recipient = mergeRecipientDraft(recipient, recipientFromAddress(line));
      continue;
    }

    if (extractPhone(line)) {
      recipient = mergeRecipientDraft(recipient, recipientFromNameAndPhone(line));
      continue;
    }

    const trackNumber = extractTrackNumber(line);
    if (trackNumber) {
      pushCurrentTrack();
      currentTrack.trackNumber = trackNumber;
    }
  }

  pushCurrentTrack();

  return {
    trackItems,
    deliveryType,
    recipient: hasRecipientData(recipient) ? recipient : null,
    comments,
  };
}

export default function OrderForm({ action, product, customers }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_state, formData) => (await action(formData)) ?? {},
    {}
  );
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>(customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState(product?.customerId ?? "");
  const [trackItems, setTrackItems] = useState<TrackItemField[]>(() =>
    initialTrackItemFields(product)
  );
  const [slugValue, setSlugValue] = useState(product?.slug ?? "");
  const [deliveryType, setDeliveryType] = useState(product?.deliveryType ?? "");
  const [comments, setComments] = useState(product?.comments ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [descriptionParseMessage, setDescriptionParseMessage] = useState("");
  const [isParsingDescription, setIsParsingDescription] = useState(false);
  const preserveSlug = !!product;
  const nextTrackId = useRef(trackItems.length);

  const trackNumbers = trackItems
    .map((item) => item.trackNumber.trim())
    .filter(Boolean)
    .join("\n");
  const serializedTrackItems = JSON.stringify(
    trackItems.map((item) => ({
      trackNumber: item.trackNumber,
      name: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      productUrl: item.productUrl,
      photoReport: item.photoReport,
      photoReportUrl: item.photoReportUrl,
    }))
  );

  useEffect(() => {
    if (!preserveSlug && trackNumbers) {
      setSlugValue(slugify(trackNumbers));
    }
  }, [trackNumbers, preserveSlug]);

  useEffect(() => {
    setCustomerOptions(customers);
  }, [customers]);

  const addTrackItem = () => {
    setTrackItems((current) => [
      ...current,
      {
        id: `track-${nextTrackId.current++}`,
        trackNumber: "",
        itemName: "",
        quantity: "1",
        unitPrice: "",
        productUrl: "",
        photoReport: false,
        photoReportUrl: "",
      },
    ]);
  };

  const updateTrackItem = <K extends keyof Omit<TrackItemField, "id">>(
    id: string,
    field: K,
    value: TrackItemField[K]
  ) => {
    setTrackItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeTrackItem = (id: string) => {
    setTrackItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id)
    );
  };

  const applyDescriptionDraft = async () => {
    const source = description;

    if (!source.trim()) {
      setDescriptionParseMessage("Добавьте текст в описание, чтобы обработать его.");
      return;
    }

    setIsParsingDescription(true);

    const draft = parseDescriptionDraft(source);
    const filledParts: string[] = [];
    const failedParts: string[] = [];

    try {
      if (draft.trackItems.length > 0) {
        const nextItems = draft.trackItems.map((item) => ({
          id: `track-${nextTrackId.current++}`,
          ...item,
        }));
        setTrackItems(nextItems);
        filledParts.push(`строк треков: ${nextItems.length}`);
      }

      if (draft.deliveryType) {
        setDeliveryType(draft.deliveryType);
        filledParts.push("вид доставки");
      }

      if (draft.recipient) {
        const localCustomer = findCustomerOption(draft.recipient, customerOptions);

        if (localCustomer) {
          setSelectedCustomerId(localCustomer.id);
          filledParts.push("получатель выбран из списка");
        } else {
          try {
            const result = await resolveCustomerFromParsedRecipient(draft.recipient);
            setCustomerOptions((current) => {
              const exists = current.some((customer) => customer.id === result.customer.id);
              if (exists) {
                return current.map((customer) =>
                  customer.id === result.customer.id ? result.customer : customer
                );
              }

              return [...current, result.customer].sort((left, right) =>
                left.name.localeCompare(right.name, "ru")
              );
            });
            setSelectedCustomerId(result.customer.id);
            filledParts.push(
              result.created ? "получатель создан" : `получатель выбран (${result.matchedBy})`
            );
          } catch (error) {
            failedParts.push(error instanceof Error ? error.message : "получатель не выбран");
          }
        }
      }

      if (draft.comments) {
        setComments(draft.comments);
        filledParts.push("комментарии");
      }

      const successMessage = filledParts.length
        ? `Заполнено: ${filledParts.join(", ")}. Проверьте результат перед сохранением.`
        : "Пока не удалось распознать поля. Добавьте подписи вроде «Трек номер:», «Количество:», «Получатель:».";
      setDescriptionParseMessage(
        failedParts.length ? `${successMessage} Ошибка: ${failedParts.join("; ")}.` : successMessage
      );
    } finally {
      setIsParsingDescription(false);
    }
  };

  const errors = state?.error;

  return (
    <form action={formAction} className="product-form">
      <input type="hidden" name="trackItems" value={serializedTrackItems} />
      <input type="hidden" name="slug" value={slugValue} />
      <input type="hidden" name="sku" value={product?.sku ?? ""} />
      {product && <input type="hidden" name="isActive" value={product.isActive ? "on" : ""} />}
      <div className="card">
        <h2 className="section-title">Основная информация</h2>

        <div className="info-blocks">
          <section className="info-block">
            <div className="field track-number-field">
              {!product && (
                <div className="track-actions">
                  <button
                    type="button"
                    className="track-add-button"
                    onClick={addTrackItem}
                    aria-label="Добавить строку трек номера"
                    title="Добавить строку трек номера"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="track-items-wrap">
                <div className="track-items-table">
                  <div className="track-items-header">
                    <span>№</span>
                    <span>Трек номер</span>
                    <span>Наименование</span>
                    <span>Количество</span>
                    <span>Стоимость за единицу</span>
                    <span>Итого сумма</span>
                    <span>Ссылка на товар</span>
                    <span>Фотоотчёт</span>
                    <span>Ссылка на фотоотчёт</span>
                    <span></span>
                  </div>
                  {trackItems.map((item, index) => (
                    <div key={item.id} className="track-item-row">
                    <span className="track-item-index">{index + 1}</span>
                    <input
                      type="text"
                      value={item.trackNumber}
                      onChange={(event) =>
                        updateTrackItem(item.id, "trackNumber", event.target.value)
                      }
                      className={`field-input mono ${
                        errors?.trackItems ? "field-input--error" : ""
                      }`}
                      placeholder={index === 0 ? "LC000000000MG" : "Трек номер"}
                    />
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(event) => updateTrackItem(item.id, "itemName", event.target.value)}
                      className={`field-input ${errors?.trackItems ? "field-input--error" : ""}`}
                      placeholder="Кепки, бижутерия, футболка"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      min="1"
                      step="1"
                      onChange={(event) => updateTrackItem(item.id, "quantity", event.target.value)}
                      className={`field-input ${errors?.trackItems ? "field-input--error" : ""}`}
                    />
                    <input
                      type="number"
                      value={item.unitPrice}
                      min="0"
                      step="0.01"
                      onChange={(event) => updateTrackItem(item.id, "unitPrice", event.target.value)}
                      className={`field-input ${errors?.trackItems ? "field-input--error" : ""}`}
                      placeholder="99.00"
                    />
                    <output className="track-item-total">{formatUsd(trackItemTotal(item))}</output>
                    <div className="track-link-field">
                      <input
                        type="text"
                        inputMode="url"
                        value={item.productUrl}
                        onChange={(event) =>
                          updateTrackItem(item.id, "productUrl", event.target.value)
                        }
                        className="field-input track-url-input"
                        placeholder="https://..."
                      />
                      <TrackLinkOpen value={item.productUrl} label="Открыть ссылку на товар" />
                    </div>
                    <label className="track-switch">
                      <input
                        type="checkbox"
                        checked={item.photoReport}
                        onChange={(event) =>
                          updateTrackItem(item.id, "photoReport", event.target.checked)
                        }
                        className="track-switch-input"
                        aria-label="Фотоотчёт"
                      />
                      <span className="track-switch-control" aria-hidden="true" />
                    </label>
                    <div className="track-link-field">
                      <input
                        type="text"
                        inputMode="url"
                        value={item.photoReportUrl}
                        onChange={(event) =>
                          updateTrackItem(item.id, "photoReportUrl", event.target.value)
                        }
                        className="field-input track-url-input"
                        placeholder="https://..."
                      />
                      <TrackLinkOpen
                        value={item.photoReportUrl}
                        label="Открыть ссылку на фотоотчёт"
                      />
                    </div>
                    <button
                      type="button"
                      className="track-remove-button"
                      onClick={() => removeTrackItem(item.id)}
                      disabled={trackItems.length === 1}
                      aria-label="Удалить строку"
                      title="Удалить строку"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              </div>
              {errors?.trackItems && <p className="field-error">{errors.trackItems[0]}</p>}
            </div>
          </section>

          <section className="info-block">
            <div className="field">
              <label htmlFor="deliveryType" className="field-label">
                Вид доставки <span className="required">*</span>
              </label>
              <select
                id="deliveryType"
                name="deliveryType"
                value={deliveryType}
                required
                aria-invalid={Boolean(errors?.deliveryType)}
                aria-describedby={errors?.deliveryType ? "delivery-type-error" : undefined}
                onInvalid={(event) =>
                  event.currentTarget.setCustomValidity("Выберите вид доставки")
                }
                onChange={(event) => {
                  event.currentTarget.setCustomValidity("");
                  setDeliveryType(event.target.value);
                }}
                className={`field-input ${errors?.deliveryType ? "field-input--error" : ""}`}
              >
                <option value="">— Выберите вид доставки —</option>
                {DELIVERY_TYPE_OPTIONS.map((deliveryType) => (
                  <option key={deliveryType} value={deliveryType}>
                    {deliveryType}
                  </option>
                ))}
              </select>
              {errors?.deliveryType && (
                <p id="delivery-type-error" className="field-error">
                  {errors.deliveryType[0]}
                </p>
              )}
            </div>
          </section>

          <section className="info-block">
            <div className="field">
              <label className="field-label">
                Получатель <span className="required">*</span>
              </label>
              <select
                name="customerId"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
                className={`field-input ${errors?.customerId ? "field-input--error" : ""}`}
                disabled={customerOptions.length === 0}
              >
                <option value="">— Выберите получателя —</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customerLabel(customer)}
                  </option>
                ))}
              </select>
              {errors?.customerId && <p className="field-error">{errors.customerId[0]}</p>}
            </div>
          </section>

          <section className="info-block">
            <div className="field">
              <label className="field-label">Комментарии</label>
              <textarea
                name="comments"
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                className="field-input field-textarea"
                placeholder="Комментарий..."
                rows={3}
              />
            </div>
          </section>

          <section className="info-block">
            <div className="field">
              <div className="field-label-row">
                <label className="field-label">Описание</label>
                <button
                  type="button"
                  className="description-parse-button"
                  onClick={applyDescriptionDraft}
                  disabled={isParsingDescription || isPending}
                >
                  {isParsingDescription ? (
                    <>
                      <Loader2 size={13} className="spin" />
                      Обработка...
                    </>
                  ) : (
                    "Обработать описание"
                  )}
                </button>
              </div>
              <textarea
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="field-input field-textarea"
                placeholder="Краткое описание..."
                rows={3}
              />
              {descriptionParseMessage && (
                <p className="field-hint">{descriptionParseMessage}</p>
              )}
            </div>
          </section>
        </div>

        {errors?.sku && <p className="field-error">{errors.sku[0]}</p>}
      </div>

      <div className="form-actions">
        <Link href="/orders" className="btn-secondary">
          Отмена
        </Link>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? (
            <>
              <Loader2 size={15} className="spin" />
              Сохранение...
            </>
          ) : (
            product ? "Сохранить изменения" : "Создать заказ"
          )}
        </button>
      </div>

      <style>{`
        .product-form { display: flex; flex-direction: column; gap: 20px; }

        .card { background: var(--color-surface); backdrop-filter: blur(16px) saturate(1.4); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-card); }

        .section-title { font-size: 15px; font-weight: 600; margin: 0 0 20px; color: var(--color-text); }

        .info-blocks { display: flex; flex-direction: column; margin-bottom: 20px; }
        .info-block { display: block; padding: 16px 0; border-top: 1px solid var(--color-border); }
        .info-block:first-child { padding-top: 0; border-top: none; }
        .info-block:last-child { padding-bottom: 20px; border-bottom: 1px solid var(--color-border); }

        .field { display: flex; flex-direction: column; gap: 6px; }
        .field--full { grid-column: 1 / -1; }
        .field-label-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .field-label { font-size: 13px; font-weight: 500; color: var(--color-text); }
        .required { color: var(--color-danger); }
        .description-parse-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; color: var(--color-accent); font-family: var(--font-sans); font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; }
        .description-parse-button:hover { background: oklch(52% 0.14 42 / 0.08); border-color: var(--color-accent); }
        .description-parse-button:disabled { opacity: 0.6; cursor: not-allowed; }

        .field-input { padding: 10px 14px; background: oklch(99% 0.008 65 / 0.6); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); font-family: var(--font-sans); outline: none; transition: border-color 0.15s; }
        .field-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.1); }
        .field-input:disabled { opacity: 0.65; cursor: not-allowed; }
        .field-input--error { border-color: var(--color-danger); }
        .field-textarea { resize: vertical; min-height: 80px; font-family: var(--font-sans); line-height: 1.5; }
        .mono { font-family: var(--font-mono); }

        .field-error { font-size: 12px; color: var(--color-danger); }
        .field-hint { font-size: 11px; color: var(--color-muted); }

        .weight-field { max-width: 260px; }
        .weight-input { font-variant-numeric: tabular-nums; }

        .track-number-field { min-width: 0; }
        .track-actions { display: flex; justify-content: flex-end; margin-bottom: 8px; }
        .track-items-wrap { overflow-x: auto; padding-bottom: 2px; }
        .track-items-table { min-width: 1560px; display: flex; flex-direction: column; gap: 8px; }
        .track-items-header,
        .track-item-row { display: grid; grid-template-columns: 40px minmax(150px, 1fr) minmax(170px, 1.15fr) 96px 150px 140px 220px 96px 220px 36px; gap: 8px; align-items: center; }
        .track-items-header { padding: 0 0 2px; font-size: 11px; font-weight: 600; line-height: 1.3; color: var(--color-muted); text-transform: uppercase; }
        .track-item-row .field-input { width: 100%; min-width: 0; }
        .track-item-index { display: flex; align-items: center; justify-content: center; min-height: 42px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-muted-bg); color: var(--color-muted); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .track-link-field { display: grid; grid-template-columns: minmax(0, 1fr) 42px; gap: 6px; align-items: center; min-width: 0; }
        .track-url-input { font-size: 12px; }
        .track-link-open-button { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; color: var(--color-text); text-decoration: none; cursor: pointer; transition: background 0.15s, color 0.15s; }
        .track-link-open-button:hover:not(.track-link-open-button--disabled) { background: var(--color-muted-bg); color: var(--color-accent); }
        .track-link-open-button--disabled { opacity: 0.35; cursor: not-allowed; }
        .track-switch { display: inline-flex; align-items: center; justify-content: center; width: 96px; min-height: 42px; }
        .track-switch-input { position: absolute; opacity: 0; pointer-events: none; }
        .track-switch-control { position: relative; width: 44px; height: 24px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-muted-bg); cursor: pointer; transition: background 0.15s, border-color 0.15s; }
        .track-switch-control::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 999px; background: var(--color-surface); box-shadow: 0 1px 3px rgba(0,0,0,0.18); transition: transform 0.15s; }
        .track-switch-input:checked + .track-switch-control { border-color: var(--color-accent); background: var(--color-accent); }
        .track-switch-input:checked + .track-switch-control::after { transform: translateX(20px); }
        .track-switch-input:focus-visible + .track-switch-control { box-shadow: 0 0 0 3px oklch(52% 0.14 42 / 0.16); }
        .track-item-total { display: flex; align-items: center; min-height: 42px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-muted-bg); color: var(--color-text); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .track-add-button,
        .track-remove-button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text); cursor: pointer; transition: background 0.15s, color 0.15s; flex-shrink: 0; }
        .track-remove-button { width: 36px; height: 42px; }
        .track-add-button:hover,
        .track-remove-button:hover:not(:disabled) { background: var(--color-muted-bg); }
        .track-remove-button { color: var(--color-danger); }
        .track-remove-button:disabled { opacity: 0.35; cursor: not-allowed; }

        .form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }

        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--color-accent); color: var(--color-accent-fg); border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s; }
        .btn-primary:hover { background: var(--color-accent-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-secondary { display: inline-flex; align-items: center; padding: 10px 20px; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; color: var(--color-text); text-decoration: none; transition: background 0.15s; }
        .btn-secondary:hover { background: var(--color-muted-bg); }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .track-actions { justify-content: flex-start; }
          .field-label-row { align-items: flex-start; flex-direction: column; }
        }
      `}</style>
    </form>
  );
}
