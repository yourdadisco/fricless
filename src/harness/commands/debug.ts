/**
 * Debug Command — 切换调试模式
 *
 * 对应斜杠命令:
 *   /debug [on|off] — 查看或切换调试模式
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /debug 命令
 *
 * @param isDebug - 获取当前调试状态
 * @param setDebug - 设置调试状态
 */
export function createDebugCommand(
  isDebug?: () => boolean,
  setDebug?: (enabled: boolean) => void,
): CommandDef {
  return {
    name: 'debug',
    aliases: ['debug-mode', 'toggle-debug'],
    description: '查看或切换调试模式',
    usage: '/debug [on|off]',
    async execute(args: string[], ctx: CommandContext) {
      const current = isDebug?.() ?? false;

      if (args.length === 0) {
        const status = current ? '🟢 已开启' : '🔴 已关闭';
        const lines = [
          '🐛 **调试模式**',
          '---',
          `状态: ${status}`,
          '',
          '用法:',
          '  • `/debug on` — 开启调试模式',
          '  • `/debug off` — 关闭调试模式',
          '',
          '调试模式下会显示详细的日志、API 调用和错误堆栈信息。',
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

      if (!setDebug) {
        await ctx.sendMessage('当前环境不支持切换调试模式。');
        return;
      }

      setDebug(newState);
      const status = newState ? '已开启' : '已关闭';
      await ctx.sendMessage(`✅ 调试模式 ${status}。`);
    },
  };
}
