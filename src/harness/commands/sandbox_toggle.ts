/**
 * SandboxToggle Command — 切换沙盒模式
 *
 * 对应斜杠命令:
 *   /sandbox_toggle [on|off] — 切换沙盒安全模式
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createSandboxToggleCommand(
  isSandboxed?: () => boolean,
  setSandboxed?: (enabled: boolean) => void,
): CommandDef {
  return {
    name: 'sandbox_toggle',
    aliases: ['sandbox', 'sandbox-mode', 'toggle-sandbox'],
    description: '切换沙盒安全模式',
    usage: '/sandbox_toggle [on|off]',
    async execute(args: string[], ctx: CommandContext) {
      const current = isSandboxed?.() ?? false;
      const arg = args[0]?.toLowerCase();

      let newState: boolean;
      if (arg === 'on' || arg === 'true' || arg === '1') {
        newState = true;
      } else if (arg === 'off' || arg === 'false' || arg === '0') {
        newState = false;
      } else if (arg === 'toggle' || !arg) {
        newState = !current;
      } else {
        await ctx.sendMessage(`无效参数 "${arg}"。使用 on, off 或 toggle。`);
        return;
      }

      setSandboxed?.(newState);
      const icon = newState ? '🛡️' : '⚠️';
      await ctx.sendMessage(
        `${icon} 沙盒模式已${newState ? '启用' : '禁用'}。` +
        (newState ? '命令将在受限环境中执行。' : '命令将正常执行。'),
      );
    },
  };
}
