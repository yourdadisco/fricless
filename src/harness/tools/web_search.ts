import { z } from 'zod';
import { defineTool } from '../Tool.js';

interface SearchResult { title: string; snippet: string; link: string }

export const webSearchTool = defineTool({
  name: 'web_search',
  description: '搜索互联网获取最新信息。重要：先用datetime获取当前日期，然后在query中包含年月以获取时效性结果。例如搜"2026年6月智能眼镜"。',
  inputSchema: z.object({
    query: z.string().min(2).describe('搜索关键词。必须包含当前年份月份以确保时效性，如"2026年6月 智能眼镜 市场"'),
    count: z.number().min(1).max(20).optional().describe('返回结果数量（默认5）'),
  }),
  validateInput(input: unknown) {
    const q = (input as Record<string, unknown>)?.query;
    if (!q || (typeof q === 'string' && q.trim().length < 2)) return { valid: false, error: '搜索关键词不能为空' };
    return { valid: true };
  },
  isReadOnly: true,
  isConcurrencySafe: true,
  async call(input) {
    const { query, count = 5 } = input as { query: string; count?: number };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const res = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          body: `q=${encodeURIComponent(query)}`,
        });
        if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
        const html = await res.text();
        const results: SearchResult[] = [];

        // DuckDuckGo: <a class="result__a" href="...">title</a> + <a class="result__snippet" href="...">snippet</a>
        const blockRegex = /<div[^>]*class="[^"]*result[^"]*results_links[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
        let m;
        while ((m = blockRegex.exec(html)) !== null && results.length < count) {
          const block = m[1];
          const a = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
          if (!a) continue;
          const title = a[2].replace(/<[^>]+>/g, '').trim();
          if (!title) continue;
          const snip = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
          results.push({ title, snippet: snip ? snip[1].replace(/<[^>]+>/g, '').trim() : '', link: a[1].startsWith('http') ? a[1] : 'https:' + a[1] });
        }

        // Fallback: result__title pattern
        if (results.length === 0) {
          const altRegex = /<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/g;
          let altM;
          while ((altM = altRegex.exec(html)) !== null && results.length < count) {
            const link = altM[1];
            const title = altM[2].replace(/<[^>]+>/g, '').trim();
            if (title) results.push({ title, snippet: '', link: link.startsWith('http') ? link : 'https:' + link });
          }
        }

        if (results.length === 0) return { data: '未找到相关结果。', isError: true };

        const lines = ['', ...results.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? '\n   ' + r.snippet : ''}\n   \`${r.link}\``), ''];
        return { data: lines.join('\n').trim() };
      } finally { clearTimeout(timeout); }
    } catch (err) {
      return { data: `搜索失败: ${err instanceof Error ? err.message : '未知错误'}`, isError: true };
    }
  },
});
