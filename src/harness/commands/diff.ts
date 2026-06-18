/**
 * Diff Command — 比较两段文本的差异
 *
 * 对应斜杠命令:
 *   /diff <文本1> | <文本2> — 显示两段文本之间的差异
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /diff 命令
 *
 * @param computeDiff - 自定义 diff 函数（可选）
 */
export function createDiffCommand(
  computeDiff?: (a: string, b: string) => { type: 'add' | 'remove' | 'same'; value: string }[],
): CommandDef {
  return {
    name: 'diff',
    aliases: ['compare', 'difference'],
    description: '比较两段文本的差异',
    usage: '/diff <文本1> | <文本2>',
    async execute(args: string[], ctx: CommandContext) {
      const input = args.join(' ');
      const separator = input.includes(' | ') ? ' | ' : input.includes('|') ? '|' : null;

      if (!separator) {
        await ctx.sendMessage('请使用 `|` 分隔两段文本。用法: `/diff <文本1> | <文本2>`');
        return;
      }

      const parts = input.split(separator).map(s => s.trim());
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        await ctx.sendMessage('两段文本都不能为空。用法: `/diff <文本1> | <文本2>`');
        return;
      }

      const [textA, textB] = parts;
      const linesA = textA.split('\n');
      const linesB = textB.split('\n');

      // 简单的逐行比较
      const maxLines = Math.max(linesA.length, linesB.length);
      const result: string[] = [
        '📊 **文本差异比较**',
        '---',
      ];

      let changes = 0;
      for (let i = 0; i < maxLines; i++) {
        const lineA = linesA[i] ?? '';
        const lineB = linesB[i] ?? '';
        const lineNum = i + 1;

        if (lineA === lineB) {
          if (result.length < 20) {
            result.push(`  ${lineNum}. ${lineA}`);
          }
        } else {
          changes++;
          if (result.length < 30) {
            if (lineA) result.push(`- ${lineNum}. ${lineA}`);
            if (lineB) result.push(`+ ${lineNum}. ${lineB}`);
          }
        }
      }

      if (changes === 0) {
        result.push('两段文本完全相同。');
      } else {
        result.push('---');
        result.push(`共 ${changes} 处差异。`);
        if (result.length >= 30) {
          result.push('... (输出截断)');
        }
      }

      await ctx.sendMessage(result.join('\n'));
    },
  };
}
