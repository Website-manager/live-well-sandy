import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ---------------------------------------------------------------------------
// CONTENT LAYER (Astro 5) — glob loaders over editable markdown files.
// These schemas MUST stay in lockstep with the field definitions in
// the repo-root `.pages.yml` so Pages CMS edits always produce valid
// frontmatter that Astro can build.
// ---------------------------------------------------------------------------

// Singleton "pages" — home, about, contact. Each is one .md file in
// src/content/pages/. Some have only frontmatter; about has a markdown body.
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/pages' }),
  schema: z.object({
    // --- home.md ---
    hero_image: z.string().optional(),
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    intro: z.string().optional(),
    cta_label: z.string().optional(),
    cta_url: z.string().optional(),
    stat_1_value: z.string().optional(),
    stat_1_label: z.string().optional(),
    stat_2_value: z.string().optional(),
    stat_2_label: z.string().optional(),
    stat_3_value: z.string().optional(),
    stat_3_label: z.string().optional(),
    // --- about.md (body = the story paragraphs) ---
    story_image: z.string().optional(),
    quote: z.string().optional(),
    sign_name: z.string().optional(),
    sign_role: z.string().optional(),
    // --- contact.md ---
    location: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    facebook_label: z.string().optional(),
    facebook_url: z.string().optional(),
  }),
});

// The monthly "This season" features — the one Sandy edits most.
const specials = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/specials' }),
  schema: z.object({
    label: z.string(),
    title: z.string(),
    shop_url: z.string(),
    published: z.boolean().default(true),
    order: z.number().default(1),
  }),
});

export const collections = { pages, specials };
