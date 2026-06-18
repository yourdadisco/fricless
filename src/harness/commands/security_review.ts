/**
 * SecurityReview Command — 安全审查（存根）
 *
 * 对应斜杠命令:
 *   /security_review [file] — 对代码进行安全审查
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface SecurityFinding {
  severity: 'high' | 'medium' | 'low';
  type: string;
  message: string;
  line?: number;
}

export function createSecurityReviewCommand(
  reviewSecurity?: (filePath?: string) => Promise<SecurityFinding[]>,
): CommandDef {
  return {
    name: 'security_review',
    aliases: ['security-review', 'security-audit', 'sec-review'],
    description: '对代码进行安全审查',
    usage: '/security_review [文件路径]',
    async execute(args: string[], ctx: CommandContext) {
      const filePath = args.join(' ').trim() || undefined;

      if (reviewSecurity) {
        try {
          const findings = await reviewSecurity(filePath);
          if (findings.length === 0) {
            await ctx.sendMessage('✅ 未发现安全问题，代码安全。');
            return;
          }

          const high = findings.filter(f => f.severity === 'high');
          const medium = findings.filter(f => f.severity === 'medium');
          const low = findings.filter(f => f.severity === 'low');

          const lines = [
            '🛡️ **安全审查结果**',
            filePath ? `文件: \`${filePath}\`` : '',
            '---',
            `🔴 高危: ${high.length} | 🟡 中危: ${medium.length} | 🔵 低危: ${low.length}`,
            '---',
            ...findings.map(f => {
              const icon = f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟡' : '🔵';
              const line = f.line ? `:${f.line}` : '';
              return `${icon} [${f.type}]${line} ${f.message}`;
            }),
          ];
          await ctx.sendMessage(lines.filter(Boolean).join('\n'));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`安全审查失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage(
          '🛡️ **安全审查（模拟）**\n---\n' +
          '未发现安全问题（模拟审查模式）。\n\n' +
          '配置安全插件以获得真实的审查结果。',
        );
      }
    },
  };
}
