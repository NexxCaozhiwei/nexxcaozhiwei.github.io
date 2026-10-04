import type { APIRoute } from 'astro';
import { SITE_URL } from '../consts';

/**
 * GitHub Pages 是纯静态托管，不读取 public/_headers，所以原 Netlify 风格的安全响应头配置没有实际作用。
 * 这里显式输出 robots.txt，并把 sitemap 的位置告诉爬虫；真正需要的安全头交给域名前端的 CDN 配置。
 */
export const GET: APIRoute = () => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${new URL('/sitemap.xml', SITE_URL).href}`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
