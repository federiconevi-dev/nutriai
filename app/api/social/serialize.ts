import type { SocialItem as Row } from "@prisma/client";
import type { SocialItem } from "@/lib/social/types";

export function serializeItem(row: Row): SocialItem {
  return {
    id: row.id,
    kind: row.kind as SocialItem["kind"],
    data: JSON.parse(row.data),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
