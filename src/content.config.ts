import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    anchors: z.array(z.string()).default([]),
    toc: z.array(z.object({ level: z.number(), text: z.string(), id: z.string() })).default([]),
  }),
});

export const collections = { docs };
