import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { builtinTools } from './index.js';

export const discoverSkillsTool = defineTool({
  name: 'discover_skills',
  description: '发现当前可用的所有能力和工具。按类别分组展示。',
  inputSchema: z.object({
    category: z.string().optional().describe('按类别筛选（如 file, web, task, utility）'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  searchHint: 'discover skills capabilities explore tools',
  async call(input, ctx) {
    const { category } = input as { category?: string };
    const tools = builtinTools;
    const filtered = category
      ? tools.filter(
          t =>
            t.name.includes(category) ||
            (t.searchHint || '').includes(category),
        )
      : tools;
    return {
      data:
        filtered
          .map(
            t =>
              `- **${t.name}**: ${t.description}${
                t.searchHint ? ` [${t.searchHint}]` : ''
              }${t.isDestructive ? ' ⚠️' : ''}${
                t.isReadOnly ? '' : ' ✏️'
              }`,
          )
          .join('\n') || 'No tools found.',
    };
  },
});
