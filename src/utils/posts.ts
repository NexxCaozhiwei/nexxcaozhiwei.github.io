import { getCollection, type CollectionEntry } from 'astro:content';
import { getReadingTime, getWordCount } from './readingTime';
import { slugifyTaxonomyName, normalizeRouteSegment } from './slug';
import { resolveCover } from '../pages/_imageStore';

export type BlogEntry = CollectionEntry<'blog'>;

/**
 * 一篇文章在列表页需要的全部数据。
 *
 * 注意：这里刻意不把 Astro 的 entry 对象继续向外透传，只保留渲染需要的最小字段，
 * 这样在整站多处复用时不会把 collection 的内部结构卷进类型推导。
 */
export interface PostMeta {
  id: string;
  slug: string;
  body: string;
  wordCount: number;
  readingTime: number;
  title: string;
  description?: string;
  date: Date;
  updated?: Date;
  tags: string[];
  category?: string;
  cover?: string;
  pinned: boolean;
}

export interface CategoryBucket {
  name: string;
  /** 所属根分类，`父/子` 结构下与 name 不同 */
  rootName: string;
  slug: string;
  displayName: string;
  count: number;
  latestDate: Date;
}

export interface TagBucket {
  name: string;
  slug: string;
  count: number;
  latestDate: Date;
}

export interface PostStats {
  totalPosts: number;
  totalWords: number;
  totalReadingMinutes: number;
  rootCategoryCount: number;
  tagCount: number;
  /** 最近一篇已发布文章的日期（毫秒时间戳），用于 sitemap 的 lastmod。 */
  latestDate: number;
}

/** 把一篇文章转成列表页所需的元数据（含字数与阅读时间）。 */
export function toPostMeta(entry: BlogEntry): PostMeta {
  const body = entry.body ?? '';

  return {
    id: entry.id,
    slug: entry.id,
    body,
    wordCount: getWordCount(body),
    readingTime: getReadingTime(body),
    title: entry.data.title,
    description: entry.data.description,
    date: entry.data.date,
    updated: entry.data.updated,
    tags: entry.data.tags,
    category: entry.data.category,
    cover: resolveCover('blog', entry.id, entry.data.cover),
    pinned: entry.data.pinned,
  };
}

/**
 * 已发布文章（草稿在任何入口都被过滤掉），按日期倒序。
 *
 * `getCollection` 在每个页面的构建期都会重新读取其内存缓存，所以这里再加一层模块级缓存，
 * 让同一构建进程内的多个页面共享同一份结果；缓存的生命周期不会跨构建，内容变更始终能被感知。
 */
let publishedCache: Promise<BlogEntry[]> | null = null;

export function getPublishedEntries(): Promise<BlogEntry[]> {
  if (!publishedCache) {
    publishedCache = getCollection('blog', ({ data }) => !data.draft).then((entries) =>
      entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime()),
    );
  }

  return publishedCache;
}

export async function getPosts(): Promise<PostMeta[]> {
  return (await getPublishedEntries()).map(toPostMeta);
}

function isPinned(post: PostMeta): boolean {
  return post.pinned;
}

/**
 * 列表页最终展示顺序：置顶文章在前，其余按日期倒序。
 * 列表页与分页共用它，保证置顶文章永远位于第一页、不会被分页切掉。
 */
export function sortForList(posts: PostMeta[]): PostMeta[] {
  const pinned = posts.filter(isPinned);
  const rest = posts.filter((post) => !isPinned(post));
  return [...pinned, ...rest];
}

let statsCache: Promise<PostStats> | null = null;

export function getPostStats(): Promise<PostStats> {
  if (!statsCache) {
    statsCache = getPosts().then((posts) => {
      let totalWords = 0;
      let totalReadingMinutes = 0;
      const rootCategories = new Set<string>();
      const tags = new Set<string>();
      const dates: number[] = [];

      for (const post of posts) {
        totalWords += post.wordCount;
        totalReadingMinutes += post.readingTime;
        dates.push(post.date.getTime());

        if (post.category) {
          const rootName = post.category.split('/')[0];
          if (rootName) rootCategories.add(rootName);
        }

        for (const tag of post.tags) {
          tags.add(tag);
        }
      }

      return {
        totalPosts: posts.length,
        totalWords,
        totalReadingMinutes,
        rootCategoryCount: rootCategories.size,
        tagCount: tags.size,
        latestDate: Math.max(...dates, Date.now()),
      };
    });
  }

  return statsCache;
}

/** 生成分类聚合：`父/子` 分类会同时登记父级，父级计数包含所有子级文章。 */
export async function getCategoryBuckets(): Promise<CategoryBucket[]> {
  const posts = await getPosts();
  const buckets = new Map<string, CategoryBucket>();

  for (const post of posts) {
    const category = post.category;
    if (!category) continue;

    const parts = category.split('/');

    for (let i = 0; i < parts.length; i++) {
      const name = parts.slice(0, i + 1).join('/');
      if (!name) continue;

      let bucket = buckets.get(name);
      if (!bucket) {
        bucket = {
          name,
          rootName: parts[0],
          slug: slugifyTaxonomyName(name),
          displayName: (parts[i] || name).trim(),
          count: 0,
          latestDate: post.date,
        };
        buckets.set(name, bucket);
      }

      bucket.count += 1;
      if (post.date > bucket.latestDate) bucket.latestDate = post.date;
    }
  }

  return [...buckets.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 生成标签聚合，按文章数倒序。 */
export async function getTagBuckets(): Promise<TagBucket[]> {
  const posts = await getPosts();
  const buckets = new Map<string, TagBucket>();

  for (const post of posts) {
    for (const tag of post.tags) {
      let bucket = buckets.get(tag);
      if (!bucket) {
        bucket = { name: tag, slug: slugifyTaxonomyName(tag), count: 0, latestDate: post.date };
        buckets.set(tag, bucket);
      }

      bucket.count += 1;
      if (post.date > bucket.latestDate) bucket.latestDate = post.date;
    }
  }

  return [...buckets.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * 路由别名：规范 slug 之外的旧地址（原文名、历史编码形式），
 * 在构建期生成 301 跳转页，保证迁移前的链接不会失效。
 */
export function collectRouteAliases(
  items: { name: string; slug: string }[],
  canonicalSegment: (item: { name: string; slug: string }) => string = (item) => item.slug,
): Map<string, string> {
  const aliases = new Map<string, string>();
  const taken = new Set(items.map(canonicalSegment));

  for (const item of items) {
    const target = canonicalSegment(item);
    const legacy = normalizeRouteSegment(item.name);

    if (legacy && legacy !== target && !taken.has(legacy)) {
      aliases.set(legacy, target);
    }
  }

  return aliases;
}
