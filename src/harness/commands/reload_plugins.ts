/**
 * ReloadPlugins Command — 重新加载所有插件
 *
 * 对应斜杠命令:
 *   /reload_plugins — 重新加载所有插件
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createReloadPluginsCommand(
  reloadPlugins?: () => Promise<{ success: boolean; count: number; errors: string[] }>,
): CommandDef {
  return {
    name: 'reload_plugins',
    aliases: ['plugins-reload', 'reload-plugins', 'refresh-plugins'],
    description: '重新加载所有插件',
    usage: '/reload_plugins',
    async execute(_args: string[], ctx: CommandContext) {
      if (reloadPlugins) {
        try {
          const result = await reloadPlugins();
          if (result.success) {
            await ctx.sendMessage(
              `🔄 已重新加载 ${result.count} 个插件。` +
              (result.errors.length > 0
                ? `\n⚠️ ${result.errors.length} 个插件加载失败。`
                : ''),
            );
          } else {
            await ctx.sendMessage(
              `❌ 插件重新加载失败。\n${result.errors.join('\n')}`,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await ctx.sendMessage(`重新加载插件失败: ${msg}`);
        }
      } else {
        await ctx.sendMessage('🔄 已重新加载所有插件（模拟）。');
      }
    },
  };
}
