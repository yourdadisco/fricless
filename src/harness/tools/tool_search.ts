import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const toolSearchTool = defineTool({
  name: 'toolSearch',
  description: '搜索可用的工具。按关键词匹配工具的名称、描述和 searchHint。',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  isDestructive: false,
  permissionLevel: 'auto',
  searchHint: 'tool search find discover lookup',
  async call(input, ctx) {
    const { query } = input;
    const q = query.toLowerCase();
    const allTools = (await import('./index.js')).builtinTools;
    const matched = allTools.filter(t =>
      t.name.includes(q) || t.description.toLowerCase().includes(q) || (t.searchHint || '').includes(q)
    );
    if (matched.length === 0) return { data: 'No tools match: ' + query };
    return { data: matched.map(t => '- **' + t.name + '**: ' + t.description + (t.searchHint ? ' [' + t.searchHint + ']' : '')).join('\n') };
  },
});
