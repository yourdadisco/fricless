/**
 * PowerShell Tool — 执行 PowerShell 命令
 *
 * 在 Windows 上通过 child_process 执行 PowerShell 命令。
 * 破坏性操作，需要用户确认。
 */

import { execSync } from 'node:child_process';
import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const powershellTool = defineTool({
  name: 'powershell',
  description: '执行 PowerShell 命令并返回输出。仅在 Windows 上有效。',
  inputSchema: z.object({
    command: z.string().describe('要执行的 PowerShell 命令'),
    timeout: z.number().optional().describe('超时秒数（默认30）'),
  }),
  isReadOnly: false,
  isConcurrencySafe: false,
  isDestructive: true,
  permissionLevel: 'confirm',
  searchHint: 'powershell command execute terminal windows run',
  async call(input) {
    const { command, timeout = 30 } = input as { command: string; timeout?: number };
    try {
      const result = execSync(
        `powershell.exe -NoProfile -Command "${command.replace(/"/g, '\\"')}"`,
        { timeout: timeout * 1000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
      );
      return { data: result || '(command completed with no output)' };
    } catch (e: any) {
      return {
        data: `Exit code: ${e.status}\n${e.stdout || ''}\n${e.stderr || ''}`.trim(),
        isError: true,
      };
    }
  },
});
