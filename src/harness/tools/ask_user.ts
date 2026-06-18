import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const askUserTool = defineTool({
  name: 'askUser',
  description: '向用户提问并等待回答。用于需要用户确认信息或提供额外输入的场景。',
  inputSchema: z.object({
    question: z.string().describe('向用户提出的问题'),
  }),
  isReadOnly: true,
  isConcurrencySafe: false,
  isDestructive: false,
  permissionLevel: 'confirm',
  searchHint: 'ask question confirm user input',
  async call(input, ctx) {
    const { question } = input;
    await ctx.sendMessage('❓ **' + question + '**\n(请回复以提供信息)');
    return { data: 'Question sent to user. Waiting for their response...' };
  },
});
