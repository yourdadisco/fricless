import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const verifyPlanTool = defineTool({
  name: 'verify_plan',
  description: '验证计划的执行结果。检查目标是否达成，步骤是否完成。',
  inputSchema: z.object({
    plan: z.string().describe('要验证的原始计划'),
    result: z.string().describe('实际执行结果'),
    expectedOutcomes: z
      .array(z.string())
      .optional()
      .describe('预期达成目标列表'),
  }),
  isReadOnly: true,
  searchHint: 'verify plan validate check confirm',
  async call(input) {
    const { plan, result, expectedOutcomes } = input as {
      plan: string;
      result: string;
      expectedOutcomes?: string[];
    };
    const lines = [
      '📋 **Plan Verification**',
      '',
      `**Plan:** ${plan.slice(0, 200)}`,
      `**Result:** ${result.slice(0, 200)}`,
    ];
    if (expectedOutcomes) {
      lines.push('', '**Expected Outcomes:**');
      expectedOutcomes.forEach((o, i) =>
        lines.push(`${result.includes(o) ? '✅' : '❌'} ${o}`),
      );
    }
    return { data: lines.join('\n') };
  },
});
