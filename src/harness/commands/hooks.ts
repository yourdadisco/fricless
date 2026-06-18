/**
 * Hooks Command — 管理钩子/触发器
 *
 * 对应斜杠命令:
 *   /hooks [list|add|remove] — 管理钩子
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface Hook {
  name: string;
  event: string;
  command: string;
  enabled: boolean;
}

export function createHooksCommand(
  getHooks?: () => Hook[],
  toggleHook?: (name: string, enabled: boolean) => Promise<void>,
): CommandDef {
  return {
    name: 'hooks',
    aliases: ['triggers', 'hook', 'lifecycle'],
    description: '管理钩子/触发器',
    usage: '/hooks [list|toggle <name>]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === 'list') {
        const hooks = getHooks?.() ?? [
          { name: 'pre-commit', event: 'beforeCommit', command: 'npm test', enabled: true },
          { name: 'post-merge', event: 'afterMerge', command: 'npm install', enabled: false },
        ];

        if (hooks.length === 0) {
          await ctx.sendMessage('当前没有配置任何钩子。');
          return;
        }

        const lines = [
          '🪝 **钩子列表**',
          '---',
          ...hooks.map(h =>
            `${h.enabled ? '🟢' : '⚪'} \`${h.name}\` (${h.event}) → \`${h.command}\``
          ),
          '---',
          '使用 `/hooks toggle <name>` 启用/禁用钩子。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      if (subcommand === 'toggle') {
        const name = args.slice(1).join(' ').trim();
        if (!name) {
          await ctx.sendMessage('请指定钩子名称。用法: `/hooks toggle <name>`');
          return;
        }

        const hooks = getHooks?.() ?? [];
        const hook = hooks.find(h => h.name === name);
        if (!hook) {
          await ctx.sendMessage(`未找到钩子 "${name}"。`);
          return;
        }

        const newState = !hook.enabled;
        if (toggleHook) {
          await toggleHook(name, newState);
        }
        await ctx.sendMessage(`🪝 钩子 \`${name}\` 已${newState ? '启用' : '禁用'}。`);
        return;
      }

      await ctx.sendMessage(`未知子命令 "${subcommand}"。可用: list, toggle`);
    },
  };
}
