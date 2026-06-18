import { z } from 'zod';
import TurndownService from 'turndown';
import { defineTool } from '../Tool.js';

// ── Turndown 实例（单例） ─────────────────────────────

let _turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (!_turndown) {
    _turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-',
      linkStyle: 'inlined',
    });

    // 保留 <img> 标签（默认 turndown 会丢弃图片）
    _turndown.addRule('images', {
      filter: 'img',
      replacement(content, node) {
        const img = node as HTMLImageElement;
        const alt = img.getAttribute('alt') || '';
        const src = img.getAttribute('src') || '';
        const title = img.getAttribute('title') || '';
        if (!src) return '';
        const titlePart = title ? ` "${title}"` : '';
        return `![${alt}](${src}${titlePart})`;
      },
    });

    // 保留 <a> 链接的原始文本，同时输出 URL
    _turndown.addRule('links', {
      filter: 'a',
      replacement(content, node) {
        const a = node as HTMLAnchorElement;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#')) return content;
        return `${content} (${href})`;
      },
    });

    // 处理 <pre><code> 代码块
    _turndown.addRule('codeBlocks', {
      filter: ['pre'],
      replacement(content, node) {
        const code = node.querySelector('code');
        const lang = code?.getAttribute('class')?.replace(/^language-/, '') || '';
        const codeText = code?.textContent || content;
        return '```' + lang + '\n' + codeText + '\n```\n';
      },
    });
  }
  return _turndown;
}

// ── Tool 定义 ─────────────────────────────────────────

export const webFetchTool = defineTool({
  name: 'web_fetch',
  description: '获取指定 URL 的内容并转换为可读的 Markdown 格式。用于阅读文章、文档或网页。',
  inputSchema: z.object({
    url: z.string().url().describe('要获取的网页 URL（需以 http:// 或 https:// 开头）'),
    maxChars: z.number().optional().describe('返回的最大字符数（默认8000）'),
  }),
  isReadOnly: true,
  async call(input) {
    const { url, maxChars = 8000 } = input as { url: string; maxChars?: number };

    try {
      return await fetchUrl(url, maxChars);
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      return {
        data: `获取页面失败 [${url}]: ${message}`,
        isError: true,
      };
    }
  },
});

// ── 核心逻辑 ──────────────────────────────────────────

async function fetchUrl(
  url: string,
  maxChars: number,
): Promise<{ data: string }> {
  // 请求超时
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';

    // 非 HTML 内容直接返回文本预览
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      const text = await res.text();
      return {
        data: truncate(text, maxChars),
      };
    }

    // HTML → Markdown
    const html = await res.text();
    const turndown = getTurndown();
    let markdown = turndown.turndown(html);

    // 清理：去除多余空行
    markdown = markdown.replace(/\n{4,}/g, '\n\n\n').trim();

    // 提取标题信息
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const header = title ? `# ${title}\n\n> 来源: ${url}\n\n---\n\n` : `> 来源: ${url}\n\n---\n\n`;

    const content = header + markdown;

    if (content.length > maxChars) {
      return {
        data: truncate(content, maxChars) + '\n\n*...（内容已截断，全文超过字符限制）*',
      };
    }

    return { data: content };
  } finally {
    clearTimeout(timeout);
  }
}

// ── 工具 ──────────────────────────────────────────────

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // 尽量在换行处截断
  const truncated = text.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf('\n');

  if (lastNewline > maxChars * 0.8) {
    return truncated.slice(0, lastNewline);
  }

  return truncated;
}
