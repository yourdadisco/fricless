/**
 * Permissions Command — 管理工具权限
 *
 * 对应斜杠命令:
 *   /permissions [list|grant|revoke] — 管理工具权限
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface Permission {
  name: string;
  allowed: boolean;
  description: string;
}

export function createPermissionsCommand(
  getPermissions?: () => Permission[],
  setPermission?: (name: string, allowed: boolean) => Promise<void>,
): CommandDef {
  return {
    name: 'permissions',
    aliases: ['perms', 'perm', 'allow'],
    description: '管理工具权限',
    usage: '/permissions [list|grant|revoke <name>]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === 'list') {
        const perms = getPermissions?.() ?? [
          { name: 'bash', allowed: true, description: '执行 shell 命令' },
          { name: 'files', allowed: true, description: '读写文件' },
          { name: 'network', allowed: false, description: '网络请求' },
        ];

        const lines = [
          '🔐 **权限管理**',
          '---',
          ...perms.map(p =>
            `${p.allowed ? '✅' : '⛔'} \`${p.name}\` — ${p.description}`,
          ),
          '---',
          '使用 `/permissions grant <name>` 或 `/permissions revoke <name>` 更改权限。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      if (subcommand === 'grant' || subcommand === 'revoke') {
        const name = args.slice(1).join(' ').trim();
        if (!name) {
          await ctx.sendMessage(`请指定权限名称。用法: \`/permissions ${subcommand} <name>\``);
          return;
        }

        const allowed = subcommand === 'grant';
        if (setPermission) {
          try {
            await setPermission(name, allowed);
            await ctx.sendMessage(`🔐 权限 \`${name}\` 已${allowed ? '授予' : '撤销'}。`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await ctx.sendMessage(`操作失败: ${msg}`);
          }
        } else {
          await ctx.sendMessage(`🔐 权限 \`${name}\` 已${allowed ? '授予' : '撤销'}（模拟）。`);
        }
        return;
      }

      await ctx.sendMessage(`未知子命令 "${subcommand}"。可用: list, grant, revoke`);
    },
  };
}
