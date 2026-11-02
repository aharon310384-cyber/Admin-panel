import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getClientCabinetContext } from "@/lib/client-cabinet";
import { getBuyoutSettings } from "@/lib/buyouts";
import { BUYOUT_FILES_MAX } from "@/lib/buyout-files";
import BuyoutForm from "../_components/buyout-form";
import { BUYOUT_CABINET_CSS } from "../_components/styles";

export const metadata: Metadata = { title: "Новая заявка на выкуп" };

export default async function NewBuyoutPage() {
  const [{ client }, settings] = await Promise.all([getClientCabinetContext(), getBuyoutSettings()]);
  return (
    <div className="bk">
      <header className="bk-head">
        <Link href="/cabinet/buyouts" className="bk-btn bk-btn--ghost bk-btn--small" aria-label="Назад к выкупам">
          <ChevronLeft size={16} />
        </Link>
        <h1 className="bk-title">Новая заявка</h1>
      </header>
      <div className="bk-card">
        <BuyoutForm customerId={client.id} rulesText={settings.rulesText} maxFiles={BUYOUT_FILES_MAX} />
      </div>
      <style>{BUYOUT_CABINET_CSS}</style>
    </div>
  );
}
