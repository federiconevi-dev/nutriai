import {
  Clapperboard,
  ShoppingBag,
  Type,
  ImageIcon,
  UserCircle,
  Mic,
  LayoutTemplate,
  Captions,
  SlidersHorizontal,
} from "lucide-react";

const features = [
  { icon: Clapperboard, title: "AI Video Generator", description: "Describe your idea and get a full video: script, scenes, voice and music." },
  { icon: ShoppingBag, title: "Product Ads", description: "Upload product photos and turn them into scroll-stopping ad creatives." },
  { icon: Type, title: "Text to Video", description: "Go from a plain text prompt to a finished, ready-to-post video." },
  { icon: ImageIcon, title: "Image to Video", description: "Animate your product or lifestyle photos into dynamic scenes." },
  { icon: UserCircle, title: "AI Avatar", description: "Add a talking AI presenter to narrate your product or offer." },
  { icon: Mic, title: "AI Voice", description: "Natural voiceovers in multiple languages, tones and speeds." },
  { icon: LayoutTemplate, title: "Templates", description: "Start from proven templates for TikTok, Reels, YouTube and more." },
  { icon: Captions, title: "Auto Captions", description: "Studio-quality animated captions generated automatically." },
  { icon: SlidersHorizontal, title: "Video Editor", description: "Fine-tune every scene, transition, caption and track before export." },
];

export function FeaturesGrid() {
  return (
    <section id="product" className="border-t border-white/5 py-24">
      <div className="container">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to ship video</h2>
          <p className="mt-4 text-muted-foreground">
            One workspace to script, generate, edit and export professional videos — no crew, no editing software.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-900/10"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 transition-colors group-hover:bg-brand-500/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
