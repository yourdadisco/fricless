/**
 * Hash Tool — 计算文本哈希值
 *
 * 支持 MD5 和 SHA-256 两种哈希算法。
 * 使用 Node.js crypto.createHash() 实现。
 */

import crypto from 'node:crypto';
import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const hashTool = defineTool({
  name: 'hash',
  description: '计算文本的哈希值，支持 MD5 和 SHA-256 算法',
  searchHint: '哈希 散列 MD5 SHA256 校验 checksum hash digest',
  inputSchema: z.object({
    text: z.string().min(1).describe('需要计算哈希的文本内容'),
    algorithm: z
      .enum(['md5', 'sha256'])
      .optional()
      .default('sha256')
      .describe('哈希算法，可选 md5 或 sha256，默认 sha256'),
  }),
  isReadOnly: true,
  async call(input) {
    const { text, algorithm = 'sha256' } = input as { text: string; algorithm?: 'md5' | 'sha256' };

    try {
      const hash = crypto.createHash(algorithm).update(text, 'utf8').digest('hex');
      const algorithmName = algorithm.toUpperCase();

      const lines = [
        `🔐 **${algorithmName} 哈希值**:`,
        '',
        `\`${hash}\``,
        '',
        '---',
        `算法: ${algorithmName}`,
        `输入长度: ${text.length} 字符`,
        `输出长度: ${hash.length} 字符 (${algorithm === 'sha256' ? '256 bits' : '128 bits'})`,
      ];

      return {
        data: lines.join('\n'),
      };
    } catch (err) {
      return {
        data: `哈希计算失败: ${err instanceof Error ? err.message : '未知错误'}`,
        isError: true,
      };
    }
  },
});
