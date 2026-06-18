/**
 * Review Command — 代码审查（存根）
 *
 * 对应斜杠命令:
 *   /review [file] — 对代码进行审查
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface ReviewFinding {
  severity: 'critical' | 'warning' | 'suggestion';
  line?: number;
  message: string;
}

export function createReviewCommand(
  reviewCode?: (filePath?: string) => Promise<ReviewFinding[]>,
): CommandDef {
  return {
    name: 'review',
    aliases: ['code-review', 'review-code'],
    description: '对代码进行审查',
    usage: '/review [文件路径]',
    async execute(args: string[], ctx: CommandContext) {
      const filePath = args.join(' ').trim() || undefined;

      if (reviewCode) {
        try {
          const findings = await reviewCode(filePath);
          if (findings.length === 0) {
            await ctx.sendMessage('✅ 未发现问题，代码质量良好。');
            return;
          }

          const critical = findings.filter(f => f.severity === 'critical');
          const warnings = findings.filter(f => f.severity === 'warning');
          const suggestions = findings.filter(f => f.severity === 'suggestion');

          const lines = [
            '🔍 **代码审查结果**',
            filePath ? `文件: \`${filePath}\`` : '',
            '---',
            `🔴 严重: ${critical.length} | 🟡 警告: ${warnings.length} | 🔵 建议: ${suggestions.length}`,
            '---',
            ...findings.map(f => {
              const icon = f.severity === 'critical' ? '🔴' : f.severity === 'warning' ? '🟡' : '🔵';
              const line = f.line ? ` (行 ${f.line})` : '';
              return `${icon}${line}: ${f.message}`;
            }),
          ];
          await ctx.sendMessage(lines.filter(Boolean).join('\n'));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`审查失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(
          '🔍 **代码审查（模拟）**\n---\n' +
          (filePath ? `审查文件: \`${filePath}\`\n` : '') +
          '审查结果: 良好（模拟审查模式，无实际分析）\n\n' +
          '提示: 配置代码分析插件以获得真实的审查结果。',
        );
      }
    },
  };
}
