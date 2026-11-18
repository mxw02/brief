import { canAccessSpace, getSessionUser } from "@/lib/auth";
import { readWorkspaceStore } from "@/lib/server-store";
import { EinstellungPageClient } from "@/components/EinstellungPageClient";

export const dynamic = "force-dynamic";

export default async function EinstellungPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <EinstellungPageClient
        initialUser={null}
        spaces={[]}
        documentCount={0}
      />
    );
  }

  const { spaces, documents } = await readWorkspaceStore();
  const visibleSpaces = spaces.filter((s) => canAccessSpace(user, s.id));
  const visibleSpaceIds = new Set(visibleSpaces.map((s) => s.id));
  const visibleDocCount = documents.filter((d) =>
    visibleSpaceIds.has(d.spaceId)
  ).length;

  return (
    <EinstellungPageClient
      initialUser={user}
      spaces={visibleSpaces}
      documentCount={visibleDocCount}
    />
  );
}
