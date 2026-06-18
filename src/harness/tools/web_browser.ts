/**
 * Web Browser Tool — 获取网页内容
 *
 * 通过 fetch + 基础 HTML 解析获取网页的可读内容。
 * 只读操作，并发安全。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const webBrowserTool = defineTool({
  name: 'web_browser',
  description: '获取网页内容并返回可读格式。访问指定 URL 并提取页面内容。',
  inputSchema: z.object({
    url: z.string().url().describe('要访问的网页 URL'),
    selector: z.string().optional().describe('CSS 选择器（可选，提取特定区域）'),
    maxChars: z.number().optional().describe('最大返回字符数（默认15000）'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  searchHint: 'web browser page fetch render html',
  async call(input) {
    const { url, maxChars = 15000 } = input as { url: string; maxChars?: number };
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fricless/1.0)' },
        signal: AbortSignal.timeout(30000),
      });
      const html = await response.text();

      // 简单文本提取
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || 'No title';
      const content = text.slice(0, maxChars);

      return {
        data: `# ${title}\n\nSource: ${url}\n\n${content}${
          text.length > maxChars ? '\n\n...(truncated)' : ''
        }`,
      };
    } catch (e: any) {
      return { data: `Failed to fetch ${url}: ${e.message}`, isError: true };
    }
  },
});
