/**
 * 分类 / 标签的 URL 片段归一化。
 *
 * 历史遗留：中文名称曾被直接当成路径（`/tags/菜谱`，空格会被编码成 `%20`），
 * 可读性和分享体验都不好。现在统一转为小写短横线形式，中文与日文等表意文字保留原样。
 * 旧的 URL 通过各页面 getStaticPaths 生成的别名路由 301 跳转到新地址。
 */
export function slugifySegment(input: string): string {
  const base = input
    .normalize('NFKC')
    .replace(/\//g, '-')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-');

  const trimmed = base.replace(/^-+|-+$/g, '');

  if (!trimmed) {
    // 纯符号名称（理论上不会出现），退回可逆的编码形式，避免产生空路径段。
    return encodeURIComponent(input);
  }

  return trimmed;
}

/**
 * 归一化完整分类名（可能含 `父/子` 层级）：对每一段单独 slug 化，再用 `/` 连接。
 */
export function slugifyTaxonomyName(name: string): string {
  return name.split('/').filter(Boolean).map(slugifySegment).join('/');
}

/** 分类 / 标签页面的标准路径前缀。 */
export const TAXONOMY_BASE = {
  category: '/categories/',
  tag: '/tags/',
} as const;

export type TaxonomyKind = keyof typeof TAXONOMY_BASE;

/** 由归一化后的路由片段构造规范 URL（保留 `/` 层级，其余字符做 URL 编码）。 */
export function taxonomyUrl(kind: TaxonomyKind, routeSegment: string): string {
  const encoded = routeSegment
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${TAXONOMY_BASE[kind]}${encoded}/`;
}

/** 去掉首尾斜杠，便于与 Astro 传入的 params 比较。 */
export function normalizeRouteSegment(segment: string | undefined): string {
  return (segment ?? '').replace(/^\/+|\/+$/g, '');
}
