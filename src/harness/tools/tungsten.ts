import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Tungsten Tool — 原生系统操作接口
 *
 * 提供文件系统、进程等底层能力。
 * 当前环境不可用，返回提示信息。
 */
export const tungstenTool = defineTool({
  name: 'tungsten',
  description: '原生系统操作接口。提供文件系统、进程等底层能力。',
  inputSchema: z.object({
    operation: z.string().describe('要执行的原生操作名称'),
    args: z.record(z.string(), z.unknown()).optional().describe('操作参数'),
  }),
  isReadOnly: true,
  searchHint: 'tungsten native system internal',
  async call(_input) {
    return {
      data: 'Tungsten operations not available in this environment',
    };
  },
});
