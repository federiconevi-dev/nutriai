"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, FileText, GalleryHorizontalEnd, Lightbulb, Pin, PinOff, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/social/dates";
import { NETWORKS, NETWORK_META, type IdeaData, type Network, type SocialItem } from "@/lib/social/types";
import { NetworkBadge, NetworkIcon } from "./icons";
import { PageHeader } from "./ui";
import { useSocial } from "./use-social";

const TAGS = ["Reel", "Carrusel", "Tutorial", "Serie", "Tendencia", "Comunidad", "Collab"];

export function IdeasView() {
  const { ideas, create, update, remove } = useSocial();
  const [text, setText] = useState("");
  const [network, setNetwork] = useState<Network | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas
      .filter((i) => !q || i.data.text.toLowerCase().includes(q) || i.data.tag?.toLowerCase().includes(q))
      .sort((a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [ideas, query]);

  async function add() {
    if (!text.trim()) return;
    setSaving(true);
    const ok = await create("IDEA", { text: text.trim(), network, tag });
    setSaving(false);
    if (ok) {
      setText("");
      setTag(undefined);
      toast.success("Idea guardada");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Banco de ideas"
        title="Ideas"
        description="Anotá ideas al vuelo. Después convertilas en un post, un guion o un carrusel con un toque."
      />

      {/* Quick capture */}
      <div className="surface mb-8 p-4 motion-safe:animate-rise-in sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 sm:flex">
            <Lightbulb className="h-4 w-4" />
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            rows={2}
            placeholder="Escribí una idea rápida y apretá Enter…"
            className="min-h-[56px] flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-[15px]"
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {NETWORKS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(network === n ? undefined : n)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all",
                  network === n ? "text-white ring-transparent" : "text-muted-foreground ring-white/10 hover:text-foreground"
                )}
                style={network === n ? { background: NETWORK_META[n].color } : undefined}
              >
                <NetworkIcon network={n} className="h-3.5 w-3.5" />
                {NETWORK_META[n].label}
              </button>
            ))}
            <span className="mx-1 w-px shrink-0 bg-white/10" />
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? undefined : t)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all",
                  tag === t ? "bg-white/15 text-foreground ring-white/20" : "text-muted-foreground ring-white/10 hover:text-foreground"
                )}
              >
                #{t}
              </button>
            ))}
          </div>
          <Button variant="gradient" size="sm" className="h-9 shrink-0 px-4" onClick={add} disabled={saving || !text.trim()}>
            Guardar idea
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{ideas.length} ideas guardadas</p>
        <label className="flex h-9 w-full max-w-[240px] items-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/[0.07]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
        </label>
      </div>

      {list.length === 0 ? (
        <div className="surface px-6 py-16 text-center">
          <Lightbulb className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium">{ideas.length ? "Ninguna idea coincide" : "Tu banco de ideas está vacío"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Las mejores ideas aparecen cuando menos lo esperás. Anotalas acá.</p>
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          {list.map((idea, i) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              index={i}
              onTogglePin={() => update<"IDEA">(idea.id, { ...idea.data, pinned: !idea.data.pinned })}
              onDelete={async () => (await remove(idea.id)) && toast.success("Idea eliminada")}
              onToPost={async () => {
                const when = addDays(new Date(), 1);
                when.setHours(18, 0, 0, 0);
                const ok = await create("POST", {
                  title: idea.data.text.slice(0, 120),
                  network: idea.data.network ?? "instagram",
                  status: "draft",
                  scheduledAt: when.toISOString(),
                  caption: "",
                });
                if (ok) toast.success("Borrador creado para mañana", { description: "Lo encontrás en el calendario." });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  index,
  onTogglePin,
  onDelete,
  onToPost,
}: {
  idea: SocialItem<"IDEA">;
  index: number;
  onTogglePin: () => void;
  onDelete: () => void;
  onToPost: () => void;
}) {
  const d: IdeaData = idea.data;
  const topic = encodeURIComponent(d.text.slice(0, 300));
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className={cn(
        "surface surface-hover group mb-4 break-inside-avoid p-5 motion-safe:animate-rise-in",
        d.pinned && "border-amber-300/25 from-amber-300/[0.07]"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {d.network && <NetworkBadge network={d.network} size="sm" />}
        {d.tag && <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">#{d.tag}</span>}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {new Date(idea.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
        </span>
        <button
          onClick={onTogglePin}
          aria-label={d.pinned ? "Desfijar" : "Fijar"}
          className={cn("rounded-lg p-1 transition-colors hover:bg-white/10", d.pinned ? "text-amber-300" : "text-muted-foreground")}
        >
          {d.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{d.text}</p>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
        <ActionButton onClick={onToPost} icon={CalendarPlus}>Post</ActionButton>
        <ActionButton href={`/social/guiones?tema=${topic}`} icon={FileText}>Guion</ActionButton>
        <ActionButton href={`/social/carruseles?tema=${topic}`} icon={GalleryHorizontalEnd}>Carrusel</ActionButton>
        <button onClick={onDelete} aria-label="Eliminar idea" className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  icon: Icon,
  onClick,
  href,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
}) {
  const cls = "flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.08] hover:text-foreground";
  if (href)
    return (
      <Link href={href} className={cls}>
        <Icon className="h-3.5 w-3.5" /> {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}
