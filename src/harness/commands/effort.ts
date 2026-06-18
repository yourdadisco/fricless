/**
 * Effort Command — 设置 AI 推理努力级别
 *
 * 对应斜杠命令:
 *   /effort <level> — 设置推理努力级别
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

const EFFORT_LEVELS = ['auto', 'low', 'medium', 'high', 'max'] as const;
type EffortLevel = (typeof EFFORT_LEVELS)[number];

export function createEffortCommand(
  getEffort?: () => EffortLevel,
  setEffort?: (level: EffortLevel) => void,
): CommandDef {
  return {
    name: 'effort',
    aliases: ['reasoning-effort', 'thinking'],
    description: '设置 AI 推理努力级别 (auto/low/medium/high/max)',
    usage: '/effort <auto|low|medium|high|max>',
    async execute(args: string[], ctx: CommandContext) {
      const current = getEffort?.() ?? 'auto';

      if (args.length === 0) {
        const lines = [
          '🧠 **推理努力级别**',
          '---',
          `当前: \`${current}\``,
          '---',
          '可用级别:',
          ...EFFORT_LEVELS.map(l => `  • \`${l}\`${l === current ? ' ← 当前' : ''}`),
          '---',
          '更高级别需要更多计算资源，但可能产生更好的结果。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const level = args[0].toLowerCase() as EffortLevel;
      if (!EFFORT_LEVELS.includes(level)) {
        await ctx.sendMessage(
          `无效级别 "${args[0]}"。可用级别: ${EFFORT_LEVELS.join(', ')}`,
        );
        return;
      }

      setEffort?.(level);
      await ctx.sendMessage(`🧠 推理努力级别已设置为 \`${level}\`。`);
    },
  };
}
