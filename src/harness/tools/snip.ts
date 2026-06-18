import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Snip Tool — 代码片段管理
 *
 * 保存、查看、插入代码片段。
 * 使用内存存储，重启后丢失。
 */

// 内存中的代码片段存储
interface Snippet {
  name: string;
  code: string;
  language: string;
  createdAt: string;
}

const snippets: Map<string, Snippet> = new Map();

export const snipTool = defineTool({
  name: 'snip',
  description: '管理代码片段。保存、查看、插入代码片段。',
  inputSchema: z.object({
    action: z.enum(['save', 'list', 'get']).describe('操作类型：save（保存）、list（列出）、get（获取）'),
    name: z.string().optional().describe('代码片段名称'),
    code: z.string().optional().describe('代码内容（save 时必填）'),
    language: z.string().optional().describe('代码语言（save 时可选，默认 text）'),
  }),
  isReadOnly: false,
  searchHint: 'snippet code clip save reuse',
  async call(input) {
    const { action, name, code, language } = input as {
      action: 'save' | 'list' | 'get';
      name?: string;
      code?: string;
      language?: string;
    };

    switch (action) {
      case 'save': {
        if (!name || !code) {
          return { data: '保存片段需要提供 name 和 code 参数', isError: true };
        }
        const snippet: Snippet = {
          name,
          code,
          language: language || 'text',
          createdAt: new Date().toISOString(),
        };
        snippets.set(name, snippet);
        return { data: `代码片段 "${name}" 已保存（${snippet.language}，${code.length} 字符）` };
      }

      case 'list': {
        if (snippets.size === 0) {
          return { data: '暂无保存的代码片段' };
        }
        const list = Array.from(snippets.values()).map((s) => ({
          name: s.name,
          language: s.language,
          length: s.code.length,
          createdAt: s.createdAt,
        }));
        return { data: JSON.stringify(list, null, 2) };
      }

      case 'get': {
        if (!name) {
          return { data: '获取片段需要提供 name 参数', isError: true };
        }
        const snip = snippets.get(name);
        if (!snip) {
          return { data: `未找到代码片段 "${name}"`, isError: true };
        }
        return {
          data: `语言: ${snip.language}\n创建时间: ${snip.createdAt}\n\n${snip.code}`,
        };
      }

      default: {
        return { data: '未知的操作类型', isError: true };
      }
    }
  },
});
