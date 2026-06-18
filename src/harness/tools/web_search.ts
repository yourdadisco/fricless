import { z } from 'zod';
import { defineTool } from '../Tool.js';

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

/**
 * 互联网搜索工具
 *
 * 使用 SerpAPI (推荐，需配置 SERPAPI_API_KEY) 作为主力搜索后端。
 * SerpAPI 提供每月100次免费查询额度 (https://serpapi.com)。
 *
 * 未配置 SerpAPI 时尝试免费后端:
 *   1. DuckDuckGo HTML 搜索 (可能不稳定)
 *   2. Bing HTML 搜索 (备选)
 */
export const webSearchTool = defineTool({
  name: 'web_search',
  description: '搜索互联网获取最新信息。用于了解当前事件、人物、技术、新闻等内容。',
  inputSchema: z.object({
    query: z.string().min(2).describe('搜索关键词，要求具体精确，如"2025年AI智能硬件市场规模趋势"'),
    count: z.number().min(1).max(20).optional().describe('返回结果数量（默认5）'),
  }),
  validateInput(input: unknown) {
    const q = (input as Record<string, unknown>)?.query;
    if (!q || (typeof q === 'string' && q.trim().length < 2)) {
      return { valid: false, error: '搜索关键词不能为空，请提供具体的关键词' };
    }
    return { valid: true };
  },
  isReadOnly: true,
  isConcurrencySafe: true,
  searchHint: 'search web internet news information google bing',
  async call(input) {
    const { query, count = 5 } = input as { query: string; count?: number };

    // 多后端依次尝试：Brave → SerpAPI → DuckDuckGo → Bing
    const backends: Array<() => Promise<{ data: string }>> = [];

    // Brave Search API: 每月2000次免费 (https://brave.com/search/api/)
    const braveKey = process.env.BRAVE_API_KEY;
    if (braveKey) {
      backends.push(() => searchWithBrave(query, count, braveKey));
    }

    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (serpApiKey) {
      backends.push(() => searchWithSerpApi(query, count, serpApiKey));
    }
    backends.push(() => searchWithDuckDuckGo(query, count));
    backends.push(() => searchWithBing(query, count));

    let lastError = '所有搜索引擎均不可用';
    for (let i = 0; i < backends.length; i++) {
      try {
        const result = await backends[i]();
        if (result.data.includes('未找到相关结果') && i < backends.length - 1) {
          lastError = 'empty results';
          continue;
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (i < backends.length - 1) continue;
      }
    }

    return {
      data: '搜索失败。要获得稳定的搜索能力，在 .env 中添加任一 API Key:\n  BRAVE_API_KEY=你的key (推荐，每月2000次免费, https://brave.com/search/api/)\n  SERPAPI_API_KEY=你的key (每月100次免费, https://serpapi.com)',
      isError: true,
    };
  },
});

// ── Brave Search API ──────────────────────────────────
// Free tier: 2,000 queries/month, no credit card needed
// Sign up: https://brave.com/search/api/

async function searchWithBrave(query: string, count: number, apiKey: string): Promise<{ data: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(count, 10)}`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      },
    );

    if (!res.ok) throw new Error(`Brave API HTTP ${res.status}`);
    const body = await res.json();
    const web = body?.web?.results ?? [];
    if (web.length === 0) throw new Error('Brave 未返回结果');

    const lines = ['--- Brave Search 结果 ---', ''];
    web.slice(0, count).forEach((r: any, i: number) => {
      lines.push(`${i + 1}. ${r.title || '(无标题)'}`);
      if (r.description) lines.push(`   ${r.description}`);
      if (r.url) lines.push(`   \`${r.url}\``);
      lines.push('');
    });
    return { data: lines.join('\n').trim() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Brave 搜索失败: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }
}

// ── SerpAPI ───────────────────────────────────────────

async function searchWithSerpApi(query: string, count: number, apiKey: string): Promise<{ data: string }> {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('num', String(Math.min(count, 10)));
  url.searchParams.set('engine', 'google');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'FriclessBot/1.0' },
    });
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(`SerpAPI: ${body.error}`);

    const results: SearchResult[] = (body.organic_results ?? []).slice(0, count);
    if (results.length === 0) return { data: '未找到相关结果。' };

    const lines = ['--- Google (SerpAPI) 搜索结果 ---', ''];
    results.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.title}`);
      lines.push(`   ${r.snippet}`);
      if (r.link) lines.push(`   \`${r.link}\``);
      lines.push('');
    });
    return { data: lines.join('\n').trim() };
  } finally {
    clearTimeout(timeout);
  }
}

// ── DuckDuckGo HTML ───────────────────────────────────

async function searchWithDuckDuckGo(query: string, count: number): Promise<{ data: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      body: new URLSearchParams({ q: query }),
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);

    const html = await res.text();
    const results: SearchResult[] = [];

    // DuckDuckGo HTML 搜索结果格式
    const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const links: Array<{ href: string; title: string }> = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null && links.length < count) {
      links.push({ href: m[1], title: m[2].replace(/<[^>]+>/g, '').trim() });
    }
    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < count) {
      snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
    }
    for (let i = 0; i < Math.min(links.length, count); i++) {
      results.push({ title: links[i]?.title || '', snippet: snippets[i] || '', link: links[i]?.href || '' });
    }

    if (results.length === 0) {
      // DuckDuckGo 可能返回验证页面，抛异常让调用方尝试下一后端
      throw new Error('DuckDuckGo 未返回结果（可能触发安全验证）');
    }
    return { data: formatResults(results, 'DuckDuckGo') };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Bing HTML ────────────────────────────────────────

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

    // Bing 搜索结果格式
    const itemRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(html)) !== null && results.length < count) {
      const item = itemMatch[1];
      const h = item.match(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      const p = item.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (h) {
        results.push({
          title: h[2].replace(/<[^>]+>/g, '').trim(),
          snippet: p ? p[1].replace(/<[^>]+>/g, '').trim() : '',
          link: h[1],
        });
      }
    }
    if (results.length === 0) throw new Error('Bing 未返回可解析的结果');
    return { data: formatResults(results, 'Bing') };
  } finally {
    clearTimeout(timeout);
  }
}

// ── 格式化 ────────────────────────────────────────────

function formatResults(results: SearchResult[], source: string): string {
  const lines: string[] = [`--- ${source} 搜索结果 ---`, ''];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`);
    if (r.snippet) lines.push(`   ${r.snippet}`);
    if (r.link) lines.push(`   \`${r.link}\``);
    lines.push('');
  });
  return lines.join('\n').trim();
}
