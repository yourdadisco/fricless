/**
 * UUID Generator Tool — 生成 UUID
 *
 * 使用 crypto.randomUUID() 生成符合 RFC 4122 版本 4 的 UUID。
 * 支持一次性生成多个 UUID。
 */

import crypto from 'node:crypto';
import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const uuidGenTool = defineTool({
  name: 'uuid_gen',
  description: '生成 UUID（通用唯一标识符），支持批量生成',
  searchHint: 'UUID 随机ID 标识符 生成ID uuid unique id generator',
  inputSchema: z.object({
    count: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(1)
      .describe('生成 UUID 的数量，范围 1-100，默认 1'),
  }),
  isReadOnly: true,
  async call(input) {
    const { count = 1 } = input as { count?: number };

    try {
      const uuids: string[] = [];
      for (let i = 0; i < count; i++) {
        uuids.push(crypto.randomUUID());
      }

      if (count === 1) {
        return {
          data: uuids[0],
        };
      }

      return {
        data: [
          `生成了 ${count} 个 UUID:`,
          '',
          ...uuids.map((uuid, i) => `${i + 1}. \`${uuid}\``),
        ].join('\n'),
      };
    } catch (err) {
      return {
        data: `UUID 生成失败: ${err instanceof Error ? err.message : '未知错误'}`,
        isError: true,
      };
    }
  },
});
