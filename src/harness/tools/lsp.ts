import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * LSP Tool — 代码智能分析
 *
 * 提供跳转定义、查找引用、悬停提示等语言服务能力。
 * 在独立模式（非 VS Code 环境）下返回模拟数据。
 */
export const lspTool = defineTool({
  name: 'lsp',
  description: '代码智能分析。提供跳转定义、查找引用、悬停提示等功能。',
  inputSchema: z.object({
    path: z.string().describe('目标文件路径'),
    action: z
      .enum(['definition', 'references', 'hover'])
      .describe('LSP 动作：definition（跳转定义）、references（查找引用）、hover（悬停提示）'),
  }),
  isReadOnly: true,
  searchHint: 'lsp code intelligence navigate references',
  async call(input) {
    const { path, action } = input as { path: string; action: 'definition' | 'references' | 'hover' };

    switch (action) {
      case 'definition': {
        return {
          data: JSON.stringify({
            action: 'definition',
            path,
            definitions: [
              {
                file: path,
                line: 1,
                column: 1,
                label: '符号定义位置（模拟数据）',
              },
            ],
          }),
        };
      }

      case 'references': {
        return {
          data: JSON.stringify({
            action: 'references',
            path,
            references: [
              { file: path, line: 10, column: 5, label: '引用位置 1（模拟数据）' },
              { file: path, line: 42, column: 12, label: '引用位置 2（模拟数据）' },
            ],
          }),
        };
      }

      case 'hover': {
        return {
          data: JSON.stringify({
            action: 'hover',
            path,
            contents: ['符号类型: Variable', '文档: 这是一个示例符号（模拟数据）'],
          }),
        };
      }

      default: {
        return { data: '未知的 LSP 动作', isError: true };
      }
    }
  },
});
