import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Echo Tool — 回声工具
 *
 * 简单的测试工具，返回用户输入的内容。
 * 用于验证 Tool 调用链路是否正常工作。
 */
export const echoTool = defineTool({
  name: 'echo',
  description: '回声工具 — 返回你输入的内容',
  inputSchema: z.object({
    message: z.string().describe('要回显的消息内容'),
  }),
  isReadOnly: true,
  async call(input) {
    const { message } = input as { message: string };
    return { data: message };
  },
});
