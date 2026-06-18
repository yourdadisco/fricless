import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const sleepTool = defineTool({
  name: 'sleep',
  description: '等待指定的秒数。用于需要延迟的场景。',
  inputSchema: z.object({
    seconds: z.number().min(1).max(300).describe('等待秒数（最多300秒）'),
  }),
  isReadOnly: false,
  isConcurrencySafe: false,
  isDestructive: false,
  permissionLevel: 'auto',
  searchHint: 'wait delay pause',
  async call(input, ctx) {
    const { seconds } = input;
    await new Promise(r => setTimeout(r, seconds * 1000));
    return { data: 'Waited ' + seconds + ' seconds.' };
  },
});
