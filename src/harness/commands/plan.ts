/**
 * Plan Command — 进入计划模式
 *
 * 对应斜杠命令:
 *   /plan — 进入或退出计划模式
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /plan 命令
 *
 * @param isPlanMode - 检查是否在计划模式
 * @param setPlanMode - 切换计划模式
 */
export function createPlanCommand(
  isPlanMode?: () => boolean,
  setPlanMode?: (enabled: boolean) => void,
): CommandDef {
  return {
    name: 'plan',
    aliases: ['plan-mode', 'design'],
    description: '进入或退出计划模式',
    usage: '/plan [on|off]',
    async execute(args: string[], ctx: CommandContext) {
      const current = isPlanMode?.() ?? false;

      if (args.length === 0) {
        const status = current ? '🟢 已开启' : '🔴 已关闭';
        const lines = [
          '📐 **计划模式**',
          '---',
          `状态: ${status}`,
          '',
          '计划模式下，AI 会先输出执行计划，确认后再执行操作。',
          '',
          '用法:',
          '  • `/plan on` — 开启计划模式',
          '  • `/plan off` — 关闭计划模式',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const arg = args[0].toLowerCase();
      let newState: boolean;

      if (arg === 'on' || arg === 'true' || arg === '1' || arg === 'enable') {
        newState = true;
      } else if (arg === 'off' || arg === 'false' || arg === '0' || arg === 'disable') {
        newState = false;
      } else {
        await ctx.sendMessage(`无效参数 "${arg}"。请使用 \`on\` 或 \`off\`。`);
        return;
      }

      if (!setPlanMode) {
        await ctx.sendMessage('当前环境不支持切换计划模式。');
        return;
      }

      setPlanMode(newState);
      await ctx.sendMessage(`✅ 计划模式已${newState ? '开启' : '关闭'}。`);
    },
  };
}
