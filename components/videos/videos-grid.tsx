"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, MoreVertical, Download, Copy, Pencil, Trash2, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate, aspectRatioToClass } from "@/lib/utils";
import { pickDemoThumbnail } from "@/lib/demo/media";
import { Clapperboard } from "lucide-react";

interface Item {
  id: string;
  title: string;
  status: string;
  duration: number;
  aspectRatio: string;
  updatedAt: string;
  thumbnail: string | null;
  videoId: string | null;
  videoUrl: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  DRAFT: "secondary",
  GENERATING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
};

export function VideosGrid({ items: initialItems }: { items: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [renameTarget, setRenameTarget] = useState<Item | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = status === "ALL" || item.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [items, search, status]);

  function openItem(item: Item) {
    if (item.videoId) router.push(`/editor/${item.videoId}`);
    else router.push(`/projects/${item.id}`);
  }

  async function handleDuplicate(item: Item) {
    const res = await fetch(`/api/projects/${item.id}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not duplicate.");
      return;
    }
    toast.success("Project duplicated");
    setItems((prev) => [
      {
        id: data.project.id,
        title: data.project.title,
        status: data.project.status,
        duration: data.project.duration,
        aspectRatio: data.project.aspectRatio,
        updatedAt: data.project.updatedAt,
        thumbnail: data.project.thumbnail,
        videoId: null,
        videoUrl: null,
      },
      ...prev,
    ]);
  }

  async function handleRename() {
    if (!renameTarget) return;
    const res = await fetch(`/api/projects/${renameTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameValue }),
    });
    if (!res.ok) {
      toast.error("Could not rename project.");
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === renameTarget.id ? { ...i, title: renameValue } : i)));
    setRenameTarget(null);
    toast.success("Renamed");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete project.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Project deleted");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search videos…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="GENERATING">Generating</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={items.length === 0 ? "No videos yet" : "No results"}
          description={items.length === 0 ? "Create your first AI video to see it here." : "Try a different search or filter."}
          action={
            items.length === 0 ? (
              <Link href="/create" className="text-sm font-medium text-brand-400 hover:underline">
                Create your first video →
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <Card key={item.id} className="group overflow-hidden">
              <button onClick={() => openItem(item)} className={`relative block w-full overflow-hidden bg-secondary ${aspectRatioToClass(item.aspectRatio)}`}>
                <Image
                  src={item.thumbnail || pickDemoThumbnail(item.id)}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                />
              </button>
              <div className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openItem(item)}>
                        <FolderOpen className="h-4 w-4" /> Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                        <Copy className="h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameTarget(item);
                          setRenameValue(item.title);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      {item.videoUrl && (
                        <DropdownMenuItem asChild>
                          <a href={item.videoUrl} target="_blank" rel="noreferrer" download>
                            <Download className="h-4 w-4" /> Download
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setDeleteTarget(item)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</span>
                  <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button variant="gradient" onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.title}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
