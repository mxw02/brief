import { getSessionUser } from "@/lib/auth";
import { SettingsPageClient } from "@/components/SettingsPageClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  return <SettingsPageClient currentUser={user} />;
}
