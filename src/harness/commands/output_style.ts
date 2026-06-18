/**
 * OutputStyle Command — 更改输出风格
 *
 * 对应斜杠命令:
 *   /output_style <style> — 更改 AI 输出风格
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

const STYLES = ['normal', 'concise', 'detailed', 'technical', 'beginner'] as const;
type OutputStyle = (typeof STYLES)[number];

export function createOutputStyleCommand(
  getStyle?: () => OutputStyle,
  setStyle?: (style: OutputStyle) => void,
): CommandDef {
  return {
    name: 'output_style',
    aliases: ['style', 'response-style', 'response-mode'],
    description: '更改 AI 回复的输出风格',
    usage: '/output_style <normal|concise|detailed|technical|beginner>',
    async execute(args: string[], ctx: CommandContext) {
      const current = getStyle?.() ?? 'normal';

      if (args.length === 0) {
        const lines = [
          '🎨 **输出风格**',
          '---',
          `当前: \`${current}\``,
          '---',
          '可用风格:',
          ...STYLES.map(s => {
            const descriptions: Record<string, string> = {
              normal: '标准回复',
              concise: '简洁回复',
              detailed: '详细回复',
              technical: '技术向回复',
              beginner: '初学者友好',
            };
            return `  • \`${s}\` — ${descriptions[s]}${s === current ? ' ← 当前' : ''}`;
          }),
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const style = args[0].toLowerCase() as OutputStyle;
      if (!STYLES.includes(style)) {
        await ctx.sendMessage(
          `无效风格 "${args[0]}"。可用: ${STYLES.join(', ')}`,
        );
        return;
      }

      setStyle?.(style);
      await ctx.sendMessage(`🎨 输出风格已更改为 \`${style}\`。`);
    },
  };
}
