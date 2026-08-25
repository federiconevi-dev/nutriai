import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { AssetsGrid } from "@/components/assets/assets-grid";

export default async function AssetsPage() {
  const user = await requireUser();
  const assets = await db.asset.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Product photos, logos and images used across your projects.</p>
      </div>
      <AssetsGrid
        initialAssets={assets.map((a) => ({ id: a.id, url: a.url, filename: a.filename }))}
      />
    </div>
  );
}
