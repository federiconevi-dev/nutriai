import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO_VIDEO_CLIPS = [
  "/demo/videos/demo-1.mp4",
  "/demo/videos/demo-2.mp4",
  "/demo/videos/demo-3.mp4",
  "/demo/videos/demo-4.mp4",
  "/demo/videos/demo-5.mp4",
];
const DEMO_THUMBS = ["/demo/thumb-1.svg", "/demo/thumb-2.svg", "/demo/thumb-3.svg", "/demo/thumb-4.svg", "/demo/thumb-5.svg"];

function clip(i: number) {
  return DEMO_VIDEO_CLIPS[i % DEMO_VIDEO_CLIPS.length];
}
function thumb(i: number) {
  return DEMO_THUMBS[i % DEMO_THUMBS.length];
}

async function main() {
  console.log("Seeding Videora AI demo data...");

  // --- Users -----------------------------------------------------------
  const adminPassword = await bcrypt.hash("admin1234", 12);
  const admin = await db.user.upsert({
    where: { email: "admin@videora.ai" },
    update: {},
    create: {
      email: "admin@videora.ai",
      name: "Videora Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
      plan: "PRO",
      creditBalance: { create: { balance: 5000 } },
    },
  });

  const demoPassword = await bcrypt.hash("demo1234", 12);
  const demo = await db.user.upsert({
    where: { email: "demo@videora.ai" },
    update: {},
    create: {
      email: "demo@videora.ai",
      name: "Federico",
      passwordHash: demoPassword,
      role: "USER",
      plan: "CREATOR",
      creditBalance: { create: { balance: 640 } },
    },
  });

  const existingTx = await db.creditTransaction.count({ where: { userId: demo.id } });
  if (existingTx === 0)
  await db.creditTransaction.createMany({
    data: [
      { userId: demo.id, amount: 1000, reason: "SIGNUP_BONUS", note: "Welcome to Videora AI" },
      { userId: demo.id, amount: -40, reason: "VIDEO_GENERATION", note: "Hydroponic Product Ad" },
      { userId: demo.id, amount: -40, reason: "VIDEO_GENERATION", note: "Luxury Watch Advertisement" },
      { userId: demo.id, amount: -40, reason: "VIDEO_GENERATION", note: "Coffee Brand TikTok" },
      { userId: demo.id, amount: -5, reason: "SCRIPT_GENERATION", note: "Fitness Product UGC" },
      { userId: demo.id, amount: 40, reason: "REFUND", note: "Refund for failed generation" },
    ],
  });

  await db.brandKit.upsert({
    where: { id: `${demo.id}-brandkit` },
    update: {},
    create: {
      id: `${demo.id}-brandkit`,
      userId: demo.id,
      name: "Federico's Brand",
      companyName: "Videora Demo Co.",
      website: "https://videora.ai",
      instagram: "@videora.ai",
      primaryColor: "#7C4DFF",
      secondaryColor: "#101014",
      fontFamily: "Inter",
    },
  });

  // --- Demo projects -----------------------------------------------------
  const projectsSeed = [
    {
      title: "Hydroponic Product Ad",
      prompt: "Create a premium advertisement for a hydroponic gardening kit, cinematic style, for Instagram Reels.",
      videoType: "PRODUCT_AD" as const,
      style: "CINEMATIC" as const,
      status: "COMPLETED" as const,
    },
    {
      title: "Luxury Watch Advertisement",
      prompt: "A luxury advertisement for a premium watch brand, elegant and minimal, for YouTube.",
      videoType: "CINEMATIC" as const,
      style: "LUXURY" as const,
      status: "COMPLETED" as const,
    },
    {
      title: "Coffee Brand TikTok",
      prompt: "A fast-paced TikTok ad for a specialty coffee brand targeting young professionals.",
      videoType: "TIKTOK" as const,
      style: "FAST_PACED" as const,
      status: "COMPLETED" as const,
    },
    {
      title: "Fitness Product UGC",
      prompt: "Authentic UGC-style testimonial video for a home fitness resistance band set.",
      videoType: "UGC" as const,
      style: "UGC" as const,
      status: "GENERATING" as const,
    },
    {
      title: "Modern Real Estate Ad",
      prompt: "A modern real estate listing walkthrough ad for a downtown loft apartment.",
      videoType: "YOUTUBE_SHORT" as const,
      style: "DOCUMENTARY" as const,
      status: "FAILED" as const,
    },
  ];

  for (let i = 0; i < projectsSeed.length; i++) {
    const p = projectsSeed[i];
    const existing = await db.project.findFirst({ where: { userId: demo.id, title: p.title } });
    if (existing) continue;

    const project = await db.project.create({
      data: {
        userId: demo.id,
        title: p.title,
        prompt: p.prompt,
        videoType: p.videoType,
        style: p.style,
        aspectRatio: i % 3 === 0 ? "RATIO_9_16" : i % 3 === 1 ? "RATIO_16_9" : "RATIO_1_1",
        duration: [15, 20, 30][i % 3],
        language: "en",
        status: p.status,
        thumbnail: thumb(i),
        script: JSON.stringify({
          title: p.title,
          description: p.prompt,
          scenes: [1, 2, 3].map((n) => ({
            order: n,
            startSec: (n - 1) * 6,
            endSec: n * 6,
            visual: `Scene ${n} visual for ${p.title}`,
            voice: `Voice line ${n} for ${p.title}`,
            prompt: `${p.title} scene ${n}, ${p.style.toLowerCase()} style`,
          })),
        }),
      },
    });

    await db.videoScene.createMany({
      data: [1, 2, 3].map((n) => ({
        projectId: project.id,
        order: n,
        startSec: (n - 1) * 6,
        endSec: n * 6,
        visualText: `Scene ${n} visual for ${p.title}`,
        voiceText: `Voice line ${n} for ${p.title}`,
        prompt: `${p.title} scene ${n}, ${p.style.toLowerCase()} style`,
        imageUrl: thumb(i + n),
        videoUrl: p.status === "COMPLETED" ? clip(i + n) : null,
      })),
    });

    if (p.status === "COMPLETED") {
      await db.video.create({
        data: {
          projectId: project.id,
          userId: demo.id,
          title: p.title,
          status: "COMPLETED",
          duration: [15, 20, 30][i % 3],
          aspectRatio: project.aspectRatio,
          thumbnail: thumb(i),
          videoUrl: clip(i),
        },
      });
      await db.generation.create({
        data: {
          projectId: project.id,
          stage: "COMPLETED",
          progress: 100,
          provider: "mock",
          creditsCost: 40,
          resultUrl: clip(i),
          finishedAt: new Date(),
        },
      });
    } else if (p.status === "GENERATING") {
      await db.generation.create({
        data: {
          projectId: project.id,
          stage: "GENERATING_SCENES",
          progress: 55,
          provider: "mock",
          creditsCost: 40,
          logs: JSON.stringify([
            { step: "ANALYZING_PROMPT", message: "Analyzing your prompt…", at: new Date().toISOString() },
            { step: "CREATING_SCRIPT", message: "Writing the script…", at: new Date().toISOString() },
            { step: "GENERATING_SCENES", message: "Generating video scenes…", at: new Date().toISOString() },
          ]),
        },
      });
    } else if (p.status === "FAILED") {
      await db.generation.create({
        data: {
          projectId: project.id,
          stage: "FAILED",
          progress: 40,
          provider: "mock",
          creditsCost: 40,
          errorMessage: "Something went wrong while generating your video. Please try again.",
          finishedAt: new Date(),
        },
      });
    }
  }

  // --- Templates -----------------------------------------------------------
  const templates = [
    { name: "TikTok Product Launch", category: "TikTok Ads", description: "Fast-paced product reveal built for the TikTok feed.", videoType: "TIKTOK", style: "FAST_PACED", aspectRatio: "RATIO_9_16", duration: 15, featured: true },
    { name: "Clean Product Showcase", category: "Product Ads", description: "Minimal, premium showcase for any physical product.", videoType: "PRODUCT_AD", style: "MINIMAL", aspectRatio: "RATIO_9_16", duration: 20, featured: true },
    { name: "Instagram Reel Story", category: "Instagram", description: "Lifestyle-driven story format for Instagram Reels.", videoType: "INSTAGRAM_REEL", style: "SOCIAL_MEDIA", aspectRatio: "RATIO_9_16", duration: 15, featured: false },
    { name: "YouTube Explainer", category: "YouTube", description: "Educational explainer format for longer-form YouTube.", videoType: "YOUTUBE", style: "CORPORATE", aspectRatio: "RATIO_16_9", duration: 60, featured: false },
    { name: "Authentic UGC Testimonial", category: "UGC", description: "Handheld, authentic creator-style testimonial.", videoType: "UGC", style: "UGC", aspectRatio: "RATIO_9_16", duration: 30, featured: true },
    { name: "E-commerce Flash Sale", category: "E-commerce", description: "High-energy promo for a limited-time sale.", videoType: "PRODUCT_AD", style: "FAST_PACED", aspectRatio: "RATIO_1_1", duration: 15, featured: false },
    { name: "Real Estate Walkthrough", category: "Real Estate", description: "Cinematic property walkthrough for listings.", videoType: "YOUTUBE_SHORT", style: "DOCUMENTARY", aspectRatio: "RATIO_16_9", duration: 30, featured: false },
    { name: "Restaurant Menu Highlight", category: "Food", description: "Appetizing highlight reel for a restaurant menu.", videoType: "INSTAGRAM_REEL", style: "REALISTIC", aspectRatio: "RATIO_9_16", duration: 20, featured: false },
    { name: "Fitness Challenge Promo", category: "Fitness", description: "High-energy promo for a fitness program or gym.", videoType: "TIKTOK", style: "FAST_PACED", aspectRatio: "RATIO_9_16", duration: 20, featured: false },
    { name: "SaaS Product Demo", category: "Technology", description: "Clean, corporate walkthrough for a software product.", videoType: "EDUCATIONAL", style: "CORPORATE", aspectRatio: "RATIO_16_9", duration: 30, featured: false },
  ] as const;

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const existing = await db.template.findFirst({ where: { name: t.name } });
    if (existing) continue;
    await db.template.create({
      data: {
        name: t.name,
        description: t.description,
        category: t.category,
        previewUrl: thumb(i),
        videoType: t.videoType,
        style: t.style,
        aspectRatio: t.aspectRatio,
        duration: t.duration,
        featured: t.featured,
        promptSeed: `${t.description} Make it feel professional and on-brand.`,
      },
    });
  }

  console.log("Seed complete.");
  console.log("  Admin login: admin@videora.ai / admin1234");
  console.log("  Demo login:  demo@videora.ai / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
