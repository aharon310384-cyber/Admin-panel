import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPurchaseSettings } from "@/lib/purchases";
import Form from "@/components/form/form";
import PurchaseSettingsForm from "@/components/purchases/purchase-settings-form";
import { PURCHASE_ADMIN_CSS } from "@/components/purchases/admin-styles";

export const metadata: Metadata = { title: "Настройки покупки" };

const str = (value: number | null) => (value == null ? "" : String(value));

export default async function PurchaseSettingsPage() {
  const [session, settings] = await Promise.all([auth(), getPurchaseSettings()]);
  const company = settings.companyId ? await prisma.company.findUnique({ where: { id: settings.companyId }, select: { name: true } }) : null;
  return (
    <>
      <Form formKey="purchase-settings" title="Настройки покупки">
        <PurchaseSettingsForm
          isAdmin={session?.user.role === "ADMIN"}
          companyName={company?.name ?? null}
          initial={{
            clientBuyoutOnly: settings.clientBuyoutOnly,
            commissionPercent: str(settings.commissionPercent),
            commissionMinCny: str(settings.commissionMinCny),
            numberPrefix: settings.numberPrefix ?? "",
            rejectReasons: settings.rejectReasons.join("\n"),
            rulesText: settings.rulesText ?? "",
            topUpMethods: settings.topUpMethods.join("\n"),
            topUpInstructions: settings.topUpInstructions ?? "",
            topUpConfirmAboveCny: str(settings.topUpConfirmAboveCny),
          }}
        />
      </Form>
      <style>{PURCHASE_ADMIN_CSS}</style>
    </>
  );
}
