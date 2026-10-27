import type { MetadataRoute } from 'next';
import { getIndex, getMeta, SITE_URL } from '@/lib/data';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const at = new Date(getMeta().exportedAt);
  return [
    { url: `${SITE_URL}/`, lastModified: at, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/events/`, lastModified: at, changeFrequency: 'daily', priority: 0.8 },
    ...getIndex().shops.map((s) => ({ url: `${SITE_URL}/cafes/${s.id}/`, lastModified: at, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ];
}
