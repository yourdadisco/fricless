import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Notebook Tool — Jupyter 笔记本操作
 *
 * 提供创建和列出 Jupyter 笔记本的功能。
 * 支持代码单元格和 Markdown 单元格。
 */
export const notebookTool = defineTool({
  name: 'notebook',
  description: '创建和编辑 Jupyter 笔记本。支持代码单元格和 Markdown。',
  inputSchema: z.object({
    action: z.enum(['create', 'list']).describe('操作类型：create（创建笔记本）、list（列出笔记本）'),
    name: z.string().optional().describe('笔记本名称（创建时必填）'),
  }),
  isReadOnly: false,
  searchHint: 'notebook jupyter ipynb cells',
  async call(input) {
    const { action, name } = input as { action: 'create' | 'list'; name?: string };

    switch (action) {
      case 'create': {
        if (!name) {
          return { data: '创建笔记本需要提供 name 参数', isError: true };
        }
        return {
          data: `笔记本 "${name}" 已创建（模拟）。包含一个空的代码单元格。`,
        };
      }

      case 'list': {
        return {
          data: JSON.stringify([
            { name: '示例笔记本.ipynb', cells: 3, created: '2026-06-17T10:00:00Z' },
          ]),
        };
      }

      default: {
        return { data: '未知的操作类型', isError: true };
      }
    }
  },
});
