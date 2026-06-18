/**
 * Bash Tool — 执行 shell 命令
 *
 * 在终端模式下通过 child_process 执行 shell 命令。
 * 破坏性操作，需要用户确认。
 */

import { execSync } from 'node:child_process';
import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const bashTool = defineTool({
  name: 'bash',
  description: '执行 shell 命令并返回输出。适用于终端模式下的文件操作、脚本执行等。',
  inputSchema: z.object({
    command: z.string().describe('要执行的 shell 命令'),
    timeout: z.number().optional().describe('超时秒数（默认30）'),
  }),
  isReadOnly: false,
  isConcurrencySafe: false,
  isDestructive: true,
  permissionLevel: 'confirm',
  searchHint: 'bash shell command execute terminal run',
  async call(input) {
    const { command, timeout = 30 } = input as { command: string; timeout?: number };
    try {
      const result = execSync(command, {
        timeout: timeout * 1000,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return { data: result || '(command completed with no output)' };
    } catch (e: any) {
      return {
        data: `Exit code: ${e.status}\n${e.stdout || ''}\n${e.stderr || ''}`.trim(),
        isError: true,
      };
    }
  },
});
