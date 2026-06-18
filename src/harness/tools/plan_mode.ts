/**
 * Plan Mode Tool — 计划模式
 *
 * 进入或退出计划模式。计划模式下 AI 先制定方案，确认后再执行。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const planModeTool = defineTool({
  name: 'plan_mode',
  description: '进入或退出计划模式。计划模式下，AI 会先制定方案，确认后再执行。',
  inputSchema: z.object({
    action: z.enum(['enter', 'exit']).describe('enter 进入计划模式，exit 退出'),
    goal: z.string().optional().describe('计划目标（进入时必填）'),
  }),
  isReadOnly: false,
  searchHint: 'plan strategy approach design blueprint',
  async call(input, ctx) {
    const { action, goal } = input as { action: string; goal?: string };
    if (action === 'enter') {
      await ctx.sendMessage(
        `📋 **Planning mode activated**\nGoal: ${goal}\nI'll first create a plan, then execute it step by step.`,
      );
      return { data: `Planning mode entered. Goal: ${goal}` };
    }
    return { data: 'Planning mode exited.' };
  },
});
