import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const configTool = defineTool({
  name: 'config',
  description: '查看或修改当前配置项。',
  inputSchema: z.object({
    action: z.enum(['get', 'list']).describe('操作类型'),
    key: z.string().optional().describe('配置键名'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  isDestructive: false,
  permissionLevel: 'auto',
  searchHint: 'config setting view preference',
  async call(input, ctx) {
    const { action, key } = input;
    if (action === 'list') {
      const cfg = (await import('../../config.js')).loadConfig();
      return { data: Object.entries(cfg).filter(([k]) => !k.includes('secret') && !k.includes('key') && !k.includes('token')).map(([k,v]) => '- ' + k + ': ' + v).join('\n') };
    }
    return { data: 'Use /config command for detailed config view' };
  },
});
