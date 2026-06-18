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

// ── DuckDuckGo ────────────────────────────────────────

async function searchWithDuckDuckGo(
  query: string,
  count: number,
): Promise<string> {
  const url = new URL('https://api.duckduckgo.com/');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('no_html', '1');
  url.searchParams.set('skip_disambig', '1');

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
      throw new Error(`DuckDuckGo 返回 HTTP ${res.status}: ${res.statusText}`);
    }

    const body = await res.json();
    const results: SearchResult[] = [];

    // Abstract / Answer
    if (body.AbstractText) {
      results.push({
        title: body.Heading || '摘要',
        snippet: body.AbstractText,
        link: body.AbstractURL || '',
      });
    }

    // RelatedTopics
    const topics: unknown[] = body.RelatedTopics ?? [];
    for (const item of topics) {
      if (results.length >= count) break;
      if (isTopicResult(item)) {
        results.push({
          title: item.Text.split(' - ')[0] || item.Text,
          snippet: item.Text,
          link: item.FirstURL,
        });
      }
    }

    if (results.length === 0) {
      return '未找到相关结果。';
    }

    return formatResults(results, 'DuckDuckGo');
  } finally {
    clearTimeout(timeout);
  }
}

/** DuckDuckGo API 单个结果的结构 */
interface DuckDuckGoTopic {
  FirstURL: string;
  Text: string;
  Result?: string;
}

function isTopicResult(value: unknown): value is DuckDuckGoTopic {
  return (
    typeof value === 'object' &&
    value !== null &&
    'FirstURL' in value &&
    'Text' in value
  );
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
