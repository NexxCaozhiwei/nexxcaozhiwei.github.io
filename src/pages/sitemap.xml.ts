import type { APIRoute } from 'astro';
import { SITE_URL } from '../consts';
import { getCategoryBuckets, getPublishedEntries, getTagBuckets } from '../utils/posts';
import { taxonomyUrl } from '../utils/slug';

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

/** 固定页面（不含会 301 跳转的别名路由，例如 /posts/* 与 /archive）。 */
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/archives', changefreq: 'weekly', priority: '0.8' },
  { path: '/categories', changefreq: 'weekly', priority: '0.6' },
  { path: '/tags', changefreq: 'weekly', priority: '0.6' },
  { path: '/friends', changefreq: 'monthly', priority: '0.5' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toDate(value: Date | undefined): string | undefined {
  if (!value) return undefined;
  return value.toISOString().split('T')[0];
}

export const GET: APIRoute = async () => {
  const [posts, categories, tags] = await Promise.all([
    getPublishedEntries(),
    getCategoryBuckets(),
    getTagBuckets(),
  ]);

  const entries: SitemapEntry[] = [];

  for (const page of STATIC_PAGES) {
    entries.push({
      url: new URL(page.path, SITE_URL).href,
      changefreq: page.changefreq,
      priority: page.priority,
    });
  }

  for (const post of posts) {
    entries.push({
      url: new URL(`/post/${post.id}/`, SITE_URL).href,
      lastmod: toDate(post.data.updated ?? post.data.date),
      changefreq: 'monthly',
      priority: '0.8',
    });
  }

  for (const category of categories) {
    entries.push({
      url: new URL(taxonomyUrl('category', category.slug), SITE_URL).href,
      lastmod: toDate(category.latestDate),
      changefreq: 'weekly',
      priority: '0.5',
    });
  }

  for (const tag of tags) {
    entries.push({
      url: new URL(taxonomyUrl('tag', tag.slug), SITE_URL).href,
      lastmod: toDate(tag.latestDate),
      changefreq: 'weekly',
      priority: '0.4',
    });
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) =>
      [
        '  <url>',
        `    <loc>${escapeXml(entry.url)}</loc>`,
        entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
        entry.priority ? `    <priority>${entry.priority}</priority>` : null,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
