import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Synthetic Output Tool — 合成数据生成器
 *
 * 生成各种类型的模拟数据用于测试。
 * 支持 JSON、CSV、纯文本格式。
 */
export const syntheticOutputTool = defineTool({
  name: 'synthetic_output',
  description: '生成合成数据用于测试。支持各种数据类型。',
  inputSchema: z.object({
    type: z.enum(['json', 'csv', 'text']).describe('输出格式：json、csv 或 text'),
    rows: z
      .number()
      .optional()
      .default(5)
      .describe('生成行数（默认 5，最大 100）'),
    schema: z.string().optional().describe('数据模式描述，如 "user"、"product"、"log"（默认 generic）'),
  }),
  isReadOnly: true,
  searchHint: 'synthetic test data generate mock',
  async call(input) {
    const { type, rows = 5, schema = 'generic' } = input as {
      type: 'json' | 'csv' | 'text';
      rows?: number;
      schema?: string;
    };

    const clampedRows = Math.min(Math.max(1, rows), 100);
    const timestamp = new Date().toISOString();

    switch (type) {
      case 'json': {
        const data = [];
        for (let i = 0; i < clampedRows; i++) {
          data.push({
            id: i + 1,
            schema,
            label: `条目 ${i + 1}`,
            value: Math.round(Math.random() * 1000),
            active: i % 2 === 0,
            createdAt: timestamp,
          });
        }
        return { data: JSON.stringify(data, null, 2) };
      }

      case 'csv': {
        const lines: string[] = ['id,schema,label,value,active,createdAt'];
        for (let i = 0; i < clampedRows; i++) {
          lines.push(
            `${i + 1},${schema},条目 ${i + 1},${Math.round(Math.random() * 1000)},${i % 2 === 0},${timestamp}`,
          );
        }
        return { data: lines.join('\n') };
      }

      case 'text': {
        const lines: string[] = [
          `合成数据报告 (${schema})`,
          `生成时间: ${timestamp}`,
          `行数: ${clampedRows}`,
          '---',
        ];
        for (let i = 0; i < clampedRows; i++) {
          lines.push(
            `[${String(i + 1).padStart(3, '0')}] ${schema} 条目 — 值: ${Math.round(Math.random() * 1000)}`,
          );
        }
        return { data: lines.join('\n') };
      }

      default: {
        return { data: '无效的 type 参数，请使用 json、csv 或 text', isError: true };
      }
    }
  },
});
