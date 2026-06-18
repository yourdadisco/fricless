import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Overflow Test Tool — 溢出测试工具
 *
 * 生成大量文本用于测试 AI 模型的大数据处理能力。
 * small: ~1KB, medium: ~10KB, large: ~100KB
 */
export const overflowTestTool = defineTool({
  name: 'overflow_test',
  description: '测试大量数据处理能力。生成大量文本用于性能测试。',
  inputSchema: z.object({
    size: z
      .enum(['small', 'medium', 'large'])
      .describe('测试数据规模：small（约 1KB）、medium（约 10KB）、large（约 100KB）'),
  }),
  isReadOnly: true,
  searchHint: 'overflow test benchmark performance',
  async call(input) {
    const { size } = input as { size: 'small' | 'medium' | 'large' };

    const lines: string[] = [];

    switch (size) {
      case 'small': {
        // ~1KB of text
        for (let i = 0; i < 20; i++) {
          lines.push(`[SMALL] 这是第 ${i + 1} 行测试数据。用于验证模型处理短文本的能力。`);
        }
        break;
      }

      case 'medium': {
        // ~10KB of text
        for (let i = 0; i < 200; i++) {
          lines.push(
            `[MEDIUM] 测试行 #${i + 1}: 这是一行中等规模测试数据，用于评估模型在中等负载下的表现和稳定性。`,
          );
        }
        break;
      }

      case 'large': {
        // ~100KB of text
        for (let block = 0; block < 20; block++) {
          lines.push(`[LARGE] === 数据块 #${block + 1} ===`);
          for (let i = 0; i < 100; i++) {
            const idx = block * 100 + i + 1;
            lines.push(
              `[LARGE] 行 #${idx}: 大规模测试数据，用于评估模型处理大量上下文时的性能表现、token 使用情况和响应稳定性。这是一段较长的文本以确保测试覆盖面。`,
            );
          }
        }
        break;
      }

      default: {
        return { data: '无效的 size 参数，请使用 small、medium 或 large', isError: true };
      }
    }

    return { data: lines.join('\n') };
  },
});
