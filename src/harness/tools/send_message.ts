import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const sendMessageTool = defineTool({
  name: 'sendMessage',
  description: '发送一条消息到当前对话。用于 AI 主动向用户发送信息的场景。',
  inputSchema: z.object({
    message: z.string().describe('要发送的消息内容'),
  }),
  isReadOnly: false,
  isConcurrencySafe: false,
  isDestructive: false,
  permissionLevel: 'auto',
  searchHint: 'send message notify inform',
  async call(input, ctx) {
    const { message } = input;
    await ctx.sendMessage(message);
    return { data: 'Message sent.' };
  },
});
