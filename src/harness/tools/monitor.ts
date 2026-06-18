import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const monitorTool = defineTool({
  name: 'monitor',
  description: '监控某个命令或进程的输出。适用于等待某个条件满足的场景。',
  inputSchema: z.object({
    command: z.string().describe('要执行的监控命令'),
    timeout: z.number().optional().describe('超时秒数（默认30）'),
  }),
  isReadOnly: true,
  isConcurrencySafe: false,
  isDestructive: false,
  permissionLevel: 'confirm',
  searchHint: 'monitor watch wait observe',
  async call(input, ctx) {
    return { data: 'Monitor tool is not available in this environment.' };
  },
});
