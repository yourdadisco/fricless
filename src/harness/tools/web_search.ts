import { z } from 'zod';
import { defineTool } from '../Tool.js';

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

/**
 * 互联网搜索工具
 * 基于 Bing HTML 搜索，免费稳定，无需 API Key。
 */
export const webSearchTool = defineTool({
  name: 'web_search',
  description: '搜索互联网获取最新信息。用于了解当前事件、人物、技术、新闻等内容。',
  inputSchema: z.object({
    query: z.string().min(2).describe('搜索关键词，要求具体精确'),
    count: z.number().min(1).max(20).optional().describe('返回结果数量（默认5）'),
  }),
  validateInput(input: unknown) {
    const q = (input as Record<string, unknown>)?.query;
    if (!q || (typeof q === 'string' && q.trim().length < 2)) {
      return { valid: false, error: '搜索关键词不能为空' };
    }
    return { valid: true };
  },
  isReadOnly: true,
  isConcurrencySafe: true,
  async call(input) {
    const { query, count = 5 } = input as { query: string; count?: number };
    try {
      return await searchWithBing(query, count);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { data: `搜索失败: ${msg}`, isError: true };
    }
  },
});

// ── Bing HTML 搜索 ───────────────────────────────────

async function searchWithBing(query: string, count: number): Promise<{ data: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      },
    );
    if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);

    const html = await res.text();
    const results: SearchResult[] = [];

    // Bing: <li class="b_algo"><h2><a href="..." target="_blank">标题</a></h2><p>摘要</p></li>
    const itemRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(html)) !== null && results.length < count) {
      const item = itemMatch[1];
      const h2a = item.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
      if (h2a) {
        results.push({
          title: h2a[2].replace(/<[^>]+>/g, '').trim(),
          snippet: '',
          link: h2a[1].startsWith('http') ? h2a[1] : 'https://www.bing.com' + h2a[1],
        });
      } else {
        const firstA = item.match(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (firstA) {
          results.push({
            title: firstA[2].replace(/<[^>]+>/g, '').trim(),
            snippet: '',
            link: firstA[1].startsWith('http') ? firstA[1] : 'https://www.bing.com' + firstA[1],
          });
        }
      }
    }
    if (results.length === 0) throw new Error('Bing 未返回可解析的结果');

    const lines = ['--- Bing 搜索结果 ---', ''];
    results.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.title}`);
      if (r.snippet) lines.push(`   ${r.snippet}`);
      if (r.link) lines.push(`   \`${r.link}\``);
      lines.push('');
    });
    return { data: lines.join('\n').trim() };
  } finally {
    clearTimeout(timeout);
  }
}
