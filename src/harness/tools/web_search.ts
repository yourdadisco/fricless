import { z } from 'zod';
import { defineTool } from '../Tool.js';

// ── 类型 ──────────────────────────────────────────────

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

// ── Tool 定义 ─────────────────────────────────────────

export const webSearchTool = defineTool({
  name: 'web_search',
  description: '搜索互联网获取最新信息。当需要了解当前事件、人物、技术、新闻等内容时使用。',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词'),
    count: z.number().optional().describe('返回结果数量（默认5条）'),
  }),
  isReadOnly: true,
  async call(input) {
    const { query, count = 5 } = input as { query: string; count?: number };

    // Try SerpAPI first, fallback to DuckDuckGo
    const serpApiKey = process.env.SERPAPI_API_KEY;

    try {
      if (serpApiKey) {
        const data = await searchWithSerpApi(query, count, serpApiKey);
        return { data };
      }
      const data = await searchWithDuckDuckGo(query, count);
      return { data };
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      return {
        data: `搜索失败: ${message}`,
        isError: true,
      };
    }
  },
});

// ── SerpAPI ───────────────────────────────────────────

async function searchWithSerpApi(
  query: string,
  count: number,
  apiKey: string,
): Promise<string> {
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
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (compatible; FriclessBot/1.0; +https://fricless.dev)',
      },
    });

    if (!res.ok) {
      throw new Error(`SerpAPI 返回 HTTP ${res.status}: ${res.statusText}`);
    }

    const body = await res.json();

    if (body.error) {
      throw new Error(`SerpAPI 错误: ${body.error}`);
    }

    const results: SearchResult[] = (body.organic_results ?? []).slice(
      0,
      count,
    );

    if (results.length === 0) {
      return '未找到相关结果。';
    }

    return formatResults(results, 'Google (SerpAPI)');
  } finally {
    clearTimeout(timeout);
  }
}

// ── DuckDuckGo (HTML 搜索) ──────────────────────────
// DuckDuckGo 的 JSON API 已废弃（始终返回空结果）。
// 改用 HTML 版搜索页面：https://html.duckduckgo.com/html/

async function searchWithDuckDuckGo(
  query: string,
  count: number,
): Promise<string> {
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

    if (!res.ok) {
      throw new Error(`DuckDuckGo 返回 HTTP ${res.status}`);
    }

    const html = await res.text();
    const results: SearchResult[] = [];

    // 从 HTML 中提取搜索结果（DuckDuckGo HTML 版格式）
    // 每条结果格式: <a rel="nofollow" class="result__a" href="...">标题</a>
    // <a class="result__snippet" ...>摘要</a>
    const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const links: Array<{ href: string; title: string }> = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null && links.length < count) {
      links.push({
        href: m[1].replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, ''),
        title: m[2].replace(/<[^>]+>/g, '').trim(),
      });
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null && snippets.length < count) {
      snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
    }

    for (let i = 0; i < Math.min(links.length, count); i++) {
      results.push({
        title: links[i]?.title || `结果 ${i + 1}`,
        snippet: snippets[i] || '',
        link: links[i]?.href || '',
      });
    }

    if (results.length === 0) {
      return '未找到相关结果。';
    }

    return formatResults(results, 'DuckDuckGo');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `搜索失败: ${msg}`;
  } finally {
    clearTimeout(timeout);
  }
}

// ── 输出格式化 ────────────────────────────────────────

function formatResults(results: SearchResult[], source: string): string {
  const lines: string[] = [
    `--- ${source} 搜索结果 ---`,
    '',
  ];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`${i + 1}. ${r.title}`);
    lines.push(`   ${r.snippet}`);
    if (r.link) {
      lines.push(`   ${'`'}${r.link}${'`'}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
