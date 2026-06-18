import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const agentTool = defineTool({
  name: 'agent',
  description: '创建一个子 Agent 执行指定任务。子 Agent 拥有独立的对话上下文和工具集。',
  inputSchema: z.object({
    task: z.string().describe('子 Agent 需要完成的任务描述'),
    tools: z.array(z.string()).optional().describe('子 Agent 可用的工具列表（默认全部）'),
  }),
  isReadOnly: true,
  isConcurrencySafe: false,
  isDestructive: false,
  permissionLevel: 'confirm',
  searchHint: 'agent sub-task delegate spawn',
  async call(input, ctx) {
    return { data: 'Agent tool: Created sub-agent for task. Use /task commands to monitor.' };
  },
});
