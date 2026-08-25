import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { BrandKitForm } from "@/components/brand-kit/brand-kit-form";

export default async function BrandKitPage() {
  const user = await requireUser();
  const brandKit = await db.brandKit.findFirst({ where: { userId: user.id } });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Brand Kit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save your logo, colors and details once — the AI and editor will use them across every video.
        </p>
      </div>
      <BrandKitForm
        initial={
          brandKit
            ? {
                name: brandKit.name,
                logoUrl: brandKit.logoUrl,
                primaryColor: brandKit.primaryColor,
                secondaryColor: brandKit.secondaryColor,
                fontFamily: brandKit.fontFamily,
                companyName: brandKit.companyName,
                website: brandKit.website,
                instagram: brandKit.instagram,
                tiktok: brandKit.tiktok,
                youtube: brandKit.youtube,
              }
            : null
        }
      />
    </div>
  );
}
