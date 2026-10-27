import type { MetadataRoute } from 'next';
import { getIndex, getMeta } from '@/lib/data';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const meta = await getMeta();
  const idx = await getIndex();
  const at = new Date(meta.exportedAt);
  return [
    { url: `${SITE_URL}/`, lastModified: at, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/events/`, lastModified: at, changeFrequency: 'daily', priority: 0.8 },
    ...idx.shops.map((s) => ({ url: `${SITE_URL}/cafes/${s.id}/`, lastModified: at, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ];
}
