/**
 * PrivacySettings Command — 隐私设置
 *
 * 对应斜杠命令:
 *   /privacy_settings [view|set] — 管理隐私设置
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

interface PrivacySetting {
  key: string;
  value: boolean;
  description: string;
}

export function createPrivacySettingsCommand(
  getSettings?: () => PrivacySetting[],
  setSetting?: (key: string, value: boolean) => Promise<void>,
): CommandDef {
  return {
    name: 'privacy_settings',
    aliases: ['privacy', 'privacy-settings', 'data-control'],
    description: '管理隐私设置',
    usage: '/privacy_settings [view|set <key> <on|off>]',
    async execute(args: string[], ctx: CommandContext) {
      const subcommand = args[0]?.toLowerCase();

      if (!subcommand || subcommand === 'view' || subcommand === 'list') {
        const settings = getSettings?.() ?? [
          { key: 'analytics', value: true, description: '收集匿名使用数据' },
          { key: 'history', value: true, description: '保存对话历史' },
          { key: 'crash-reports', value: false, description: '自动发送崩溃报告' },
        ];

        const lines = [
          '🔒 **隐私设置**',
          '---',
          ...settings.map(s =>
            `${s.value ? '🟢' : '⚪'} \`${s.key}\` — ${s.description}`,
          ),
          '---',
          '使用 \`/privacy_settings set <key> on|off\` 更改设置。',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      if (subcommand === 'set') {
        const key = args[1];
        const value = args[2]?.toLowerCase();

        if (!key || !value || (value !== 'on' && value !== 'off')) {
          await ctx.sendMessage('用法: `/privacy_settings set <key> on|off`');
          return;
        }

        const boolValue = value === 'on';
        if (setSetting) {
          try {
            await setSetting(key, boolValue);
            await ctx.sendMessage(`🔒 隐私设置 \`${key}\` 已${boolValue ? '启用' : '禁用'}。`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await ctx.sendMessage(`设置失败: ${msg}`);
          }
        } else {
          await ctx.sendMessage(`🔒 隐私设置 \`${key}\` 已${boolValue ? '启用' : '禁用'}（模拟）。`);
        }
        return;
      }

      await ctx.sendMessage(`未知子命令 "${subcommand}"。可用: view, set`);
    },
  };
}
