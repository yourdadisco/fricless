/**
 * Upgrade Command — 升级信息
 *
 * 对应斜杠命令:
 *   /upgrade — 显示升级信息和可用更新
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createUpgradeCommand(
  getUpgradeInfo?: () => { currentVersion: string; latestVersion?: string; hasUpdate: boolean },
): CommandDef {
  return {
    name: 'upgrade',
    aliases: ['update', 'upgrade-check'],
    description: '检查更新和升级信息',
    usage: '/upgrade',
    async execute(_args: string[], ctx: CommandContext) {
      if (getUpgradeInfo) {
        const info = getUpgradeInfo();
        const lines = [
          '📦 **升级信息**',
          '---',
          `当前版本: v${info.currentVersion}`,
          info.latestVersion ? `最新版本: v${info.latestVersion}` : '',
          '---',
          info.hasUpdate
            ? '📢 有新版本可用！运行 \`npm update -g fricless\` 升级。'
            : '✅ 当前已是最新版本。',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      } else {
        await ctx.sendMessage(
          '📦 **升级信息**\n---\n' +
          '当前版本: v1.0.0\n' +
          '最新版本: v1.2.0\n' +
          '---\n' +
          '📢 有新版本可用！运行 \`npm update -g fricless\` 升级。',
        );
      }
    },
  };
}
