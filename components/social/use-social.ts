"use client";

import useSWR from "swr";
import { toast } from "sonner";
import type { ProfileData, SocialDataByKind, SocialItem, SocialKind } from "@/lib/social/types";

const KEY = "/api/social";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo cargar tu contenido");
  return (await res.json()) as { items: SocialItem[] };
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Algo salió mal");
  return json as T;
}

const DEFAULT_PROFILE: ProfileData = { handle: "tumarca", followers: { instagram: 0, tiktok: 0 } };

/** Single source of truth for the social hub: every kind comes from one request. */
export function useSocial() {
  const { data, error, isLoading, mutate } = useSWR(KEY, fetcher, { revalidateOnFocus: false });
  const items = data?.items ?? [];

  const ofKind = <K extends SocialKind>(kind: K) => items.filter((i) => i.kind === kind) as SocialItem<K>[];
  const profileItem = ofKind("PROFILE")[0];

  async function create<K extends SocialKind>(kind: K, payload: SocialDataByKind[K]) {
    try {
      const { item } = await send<{ item: SocialItem<K> }>(KEY, "POST", { kind, data: payload });
      await mutate((cur) => ({ items: [item, ...(cur?.items ?? [])] }), { revalidate: false });
      return item;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    }
  }

  async function update<K extends SocialKind>(id: string, payload: SocialDataByKind[K]) {
    const prev = data;
    await mutate(
      (cur) => ({ items: (cur?.items ?? []).map((i) => (i.id === id ? { ...i, data: payload } : i)) }),
      { revalidate: false }
    );
    try {
      const { item } = await send<{ item: SocialItem<K> }>(`${KEY}/${id}`, "PATCH", { data: payload });
      await mutate((cur) => ({ items: (cur?.items ?? []).map((i) => (i.id === id ? item : i)) }), { revalidate: false });
      return item;
    } catch (e) {
      await mutate(prev, { revalidate: false });
      toast.error((e as Error).message);
      return null;
    }
  }

  async function remove(id: string) {
    const prev = data;
    await mutate((cur) => ({ items: (cur?.items ?? []).filter((i) => i.id !== id) }), { revalidate: false });
    try {
      await send(`${KEY}/${id}`, "DELETE");
      return true;
    } catch (e) {
      await mutate(prev, { revalidate: false });
      toast.error((e as Error).message);
      return false;
    }
  }

  return {
    isLoading,
    error,
    posts: ofKind("POST"),
    ideas: ofKind("IDEA"),
    scripts: ofKind("SCRIPT"),
    carousels: ofKind("CAROUSEL"),
    profile: profileItem?.data ?? DEFAULT_PROFILE,
    profileId: profileItem?.id,
    create,
    update,
    remove,
    mutateAll: () => mutate(),
    /** Replace one item in the cache (e.g. after publishing). */
    replaceItem: (item: SocialItem) =>
      mutate((cur) => ({ items: (cur?.items ?? []).map((i) => (i.id === item.id ? item : i)) }), { revalidate: false }),
  };
}

export async function postJSON<T>(url: string, body: unknown) {
  return send<T>(url, "POST", body);
}
