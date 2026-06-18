/**
 * Passes Command — 显示测试通过/结果
 *
 * 对应斜杠命令:
 *   /passes — 显示最新的测试结果
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface TestResult {
  name: string;
  passed: boolean;
  duration?: number;
}

export function createPassesCommand(
  getTestResults?: () => { total: number; passed: number; failed: number; results: TestResult[] },
): CommandDef {
  return {
    name: 'passes',
    aliases: ['tests', 'test-results', 'checks'],
    description: '显示测试通过/结果',
    usage: '/passes',
    async execute(_args: string[], ctx: CommandContext) {
      if (getTestResults) {
        const results = getTestResults();
        const passRate = results.total > 0
          ? ((results.passed / results.total) * 100).toFixed(1)
          : '0';

        const lines = [
          '🧪 **测试结果**',
          '---',
          `总计: ${results.total} | ✅ 通过: ${results.passed} | ❌ 失败: ${results.failed}`,
          `通过率: ${passRate}%`,
          '---',
          ...results.results.map(r =>
            `${r.passed ? '✅' : '❌'} \`${r.name}\`${r.duration ? ` (${r.duration}ms)` : ''}`,
          ),
        ];
        await ctx.sendMessage(lines.join('\n'));
      } else {
        await ctx.sendMessage(
          '🧪 **测试结果**\n---\n' +
          '暂无测试结果。运行测试后将在此显示。',
        );
      }
    },
  };
}
