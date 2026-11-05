import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { getPurchaseSettings } from "@/lib/purchases";
import { PURCHASE_FILES_MAX } from "@/lib/purchase-files";
import { purchaseFormOptions } from "@/lib/purchase-options";
import { yuan } from "@/lib/purchase-money";
import PurchaseForm from "../_components/purchase-form";
import { PURCHASE_CABINET_CSS, PURCHASE_CART_CSS } from "../_components/styles";

export const metadata: Metadata = { title: "Хочу купить" };

export default async function NewPurchasePage() {
  const [{ client, mode }, settings] = await Promise.all([getClientCabinetContext(), getPurchaseSettings()]);
  const options = await purchaseFormOptions(client.id);
  const commissionText =
    settings.commissionPercent != null
      ? `${settings.commissionPercent}% от суммы товара${settings.commissionMinCny ? `, не меньше ${yuan(settings.commissionMinCny)}` : ""}`
      : null;
  return (
    <div className="bk">
      <header className="bk-head">
        <Link href="/cabinet/purchases" className="bk-btn bk-btn--ghost bk-btn--small" aria-label="Назад к покупкам">
          <ChevronLeft size={16} />
        </Link>
        <h1 className="bk-title">Хочу купить</h1>
      </header>
      <p className="bk-sub">Купим в Китае, примем на складе, проверим и доставим. Цену назовём по частям — до оплаты.</p>
      <div className="bk-card">
        <PurchaseForm
          customerId={client.id}
          rulesText={settings.rulesText}
          maxFiles={PURCHASE_FILES_MAX}
          options={options}
          allowBuyoutOnly={settings.clientBuyoutOnly || mode === "admin"}
          commissionText={commissionText}
        />
      </div>
      <style>{PURCHASE_CABINET_CSS + PURCHASE_CART_CSS}</style>
    </div>
  );
}
