import { z } from 'zod';
import { defineTool } from '../Tool.js';

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

/**
 * 互联网搜索工具
 * 基于 Bing HTML 搜索 + DuckDuckGo 备用，免费稳定，无需 API Key。
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

    // 尝试用 Bing 搜索
    const bingResult = await trySearch(searchWithBing, query, count);
    if (bingResult !== null) return bingResult;

    // Bing 无结果，尝试 DuckDuckGo
    const ddgResult = await trySearch(searchWithDuckDuckGo, query, count);
    if (ddgResult !== null) return ddgResult;

    // 两个引擎都失败，尝试简化查询再试一次
    const simplified = simplifyQuery(query);
    if (simplified !== query) {
      const retryBing = await trySearch(searchWithBing, simplified, count);
      if (retryBing !== null) return retryBing;

      const retryDdg = await trySearch(searchWithDuckDuckGo, simplified, count);
      if (retryDdg !== null) return retryDdg;
    }

    return { data: `搜索失败：所有搜索引擎均未返回结果。请尝试更改关键词。`, isError: true };
  },
});

/** 尝试一次搜索，成功返回 {data}，失败返回 null */
async function trySearch(
  searcher: (query: string, count: number) => Promise<{ data: string }>,
  query: string,
  count: number,
): Promise<{ data: string } | null> {
  try {
    return await searcher(query, count);
  } catch {
    return null;
  }
}

/** 简化查询：去掉引号、特殊字符，只用前几个关键词 */
function simplifyQuery(query: string): string {
  return query
    .replace(/["""''"]/g, '')
    .replace(/[^\w一-鿿 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

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

    // Bing: <li class="b_algo"> ... <h2><a href="..." target="_blank">标题</a></h2><p>摘要</p> ... </li>
    const itemRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(html)) !== null && results.length < count) {
      const item = itemMatch[1];
      const h2a = item.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
      if (h2a) {
        // Extract snippet from <p> tag within this b_algo item
        let snippet = '';
        const pMatch = item.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        if (pMatch) {
          snippet = pMatch[1].replace(/<[^>]+>/g, '').trim();
        }

        results.push({
          title: h2a[2].replace(/<[^>]+>/g, '').trim(),
          snippet,
          link: h2a[1].startsWith('http') ? h2a[1] : 'https://www.bing.com' + h2a[1],
        });
      } else {
        const firstA = item.match(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (firstA) {
          let snippet = '';
          const pMatch = item.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (pMatch) {
            snippet = pMatch[1].replace(/<[^>]+>/g, '').trim();
          }

          results.push({
            title: firstA[2].replace(/<[^>]+>/g, '').trim(),
            snippet,
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

// ── DuckDuckGo HTML 搜索（备用） ─────────────────────

async function searchWithDuckDuckGo(query: string, count: number): Promise<{ data: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);

    const html = await res.text();
    const results: SearchResult[] = [];

    // DuckDuckGo HTML results structure:
    // <div class="result results_links results_links_deep highlight_d">
    //   <a rel="nofollow" class="result__a" href="...">title</a>
    //   <a class="result__snippet" href="...">snippet</a>
    // </div>
    // Also: <h2 class="result__title"> ... <a class="result__a" href="...">title</a></h2>
    //       <a class="result__snippet" data-nosnippet="">snippet</a>

    // Match result blocks
    const blockRegex = /<div[^>]*class="[^"]*result[^"]*results_links[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(html)) !== null && results.length < count) {
      const block = blockMatch[1];

      // Extract link and title from result__a
      const aMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!aMatch) continue;

      const link = aMatch[1].startsWith('http')
        ? aMatch[1]
        : aMatch[1].startsWith('//')
          ? 'https:' + aMatch[1]
          : aMatch[1];
      const title = aMatch[2].replace(/<[^>]+>/g, '').trim();
      if (!title) continue;

      // Extract snippet from result__snippet
      let snippet = '';
      const snippetMatch = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      if (snippetMatch) {
        snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      results.push({ title, snippet, link });
    }

    // Fallback parsing if above regex misses (DDG sometimes changes structure)
    if (results.length === 0) {
      // Simpler approach: find article-like entries
      const altRegex = /<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/g;
      let altMatch;
      while ((altMatch = altRegex.exec(html)) !== null && results.length < count) {
        const link = altMatch[1].startsWith('http') ? altMatch[1] : 'https:' + altMatch[1];
        const title = altMatch[2].replace(/<[^>]+>/g, '').trim();
        if (!title) continue;

        // Try to find nearby snippet
        const after = html.slice(altMatch.index + altMatch[0].length, altMatch.index + altMatch[0].length + 500);
        const snipMatch = after.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        const snippet = snipMatch ? snipMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        results.push({ title, snippet, link });
      }
    }

    if (results.length === 0) throw new Error('DuckDuckGo 未返回可解析的结果');

    const lines = ['--- DuckDuckGo 搜索结果 ---', ''];
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
