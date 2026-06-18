import { z } from 'zod';
import { defineTool } from '../Tool.js';

// Simple in-memory skill store
const skillStore: Array<{ name: string; description: string; createdAt: number }> = [];

export const skillTool = defineTool({
  name: 'skill',
  description: '管理技能。可以创建、查看、列出技能。技能是可复用的指令模板。',
  inputSchema: z.object({
    action: z.enum(['create', 'list', 'view']).describe('操作类型'),
    name: z.string().optional().describe('技能名称'),
    description: z.string().optional().describe('技能描述（create时必填）'),
    instructions: z.string().optional().describe('技能指令（create时必填）'),
  }),
  isReadOnly: false,
  searchHint: 'skill template reuse command save',
  async call(input, ctx) {
    const { action, name, description, instructions } = input as {
      action: string;
      name?: string;
      description?: string;
      instructions?: string;
    };
    switch (action) {
      case 'create': {
        if (!name || !instructions)
          return { data: 'Name and instructions required', isError: true };
        skillStore.push({
          name,
          description: description || '',
          createdAt: Date.now(),
        });
        return {
          data: `Skill "${name}" created. Use it anytime by describing the task.`,
        };
      }
      case 'list': {
        if (skillStore.length === 0) return { data: 'No skills saved yet.' };
        return {
          data: skillStore.map(s => `- **${s.name}**: ${s.description}`).join('\n'),
        };
      }
      case 'view': {
        const skill = skillStore.find(s => s.name === name);
        if (!skill)
          return { data: `Skill "${name}" not found.`, isError: true };
        return { data: `**${skill.name}**: ${skill.description}` };
      }
      default:
        return { data: 'Unknown action', isError: true };
    }
  },
});
