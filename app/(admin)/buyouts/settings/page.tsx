import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBuyoutSettings } from "@/lib/buyouts";
import Form from "@/components/form/form";
import BuyoutSettingsForm from "@/components/buyouts/buyout-settings-form";
import { BUYOUT_ADMIN_CSS } from "@/components/buyouts/admin-styles";

export const metadata: Metadata = { title: "Настройки выкупа" };

const str = (value: number | null) => (value == null ? "" : String(value));

export default async function BuyoutSettingsPage() {
  const [session, settings] = await Promise.all([auth(), getBuyoutSettings()]);
  const company = settings.companyId ? await prisma.company.findUnique({ where: { id: settings.companyId }, select: { name: true } }) : null;
  return (
    <>
      <Form formKey="buyout-settings" title="Настройки выкупа">
        <BuyoutSettingsForm
          isAdmin={session?.user.role === "ADMIN"}
          companyName={company?.name ?? null}
          initial={{
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
      <style>{BUYOUT_ADMIN_CSS}</style>
    </>
  );
}
