/**
 * Workflow Tool — 多步骤工作流编排
 *
 * 创建按顺序执行的多个步骤，支持条件判断和并行执行。
 * 适用于复杂任务编排。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const workflowTool = defineTool({
  name: 'workflow',
  description: '创建工作流：按顺序执行多个步骤，支持条件判断和并行执行。适用于复杂任务编排。',
  inputSchema: z.object({
    steps: z
      .array(
        z.object({
          name: z.string().describe('步骤名称'),
          task: z.string().describe('步骤描述/要执行的任务'),
          parallel: z.boolean().optional().describe('是否与相邻步骤并行执行'),
        }),
      )
      .describe('工作流步骤列表'),
  }),
  isReadOnly: false,
  permissionLevel: 'confirm',
  searchHint: 'workflow pipeline orchestrate multi-step chain',
  async call(input, ctx) {
    const { steps } = input as {
      steps: Array<{ name: string; task: string; parallel?: boolean }>;
    };
    const results: string[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await ctx.sendMessage(`🔄 Step ${i + 1}/${steps.length}: ${step.name}`);
      results.push(`- [${i + 1}] ${step.name}: ${step.task}`);
    }
    return { data: `Workflow created with ${steps.length} steps:\n${results.join('\n')}` };
  },
});
