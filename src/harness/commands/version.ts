/**
 * Version Command — 显示版本信息
 *
 * 对应斜杠命令:
 *   /version — 显示当前系统版本
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /version 命令
 *
 * @param versionInfo - 版本信息对象（可选）
 */
export function createVersionCommand(
  versionInfo?: { version: string; buildDate?: string; commit?: string; platform?: string },
): CommandDef {
  return {
    name: 'version',
    aliases: ['ver', 'v', 'version-info'],
    description: '显示当前系统版本',
    usage: '/version',
    async execute(_args: string[], ctx: CommandContext) {
      const info = versionInfo ?? {
        version: '1.0.0',
        buildDate: new Date().toISOString().split('T')[0],
        commit: 'abc1234',
        platform: 'node-v20.11.0',
      };

      const lines = [
        '📦 **版本信息**',
        '---',
        `版本: **v${info.version}**`,
        info.buildDate ? `构建日期: ${info.buildDate}` : '',
        info.commit ? `Commit: \`${info.commit}\`` : '',
        info.platform ? `运行环境: ${info.platform}` : '',
        '---',
        '基于 Claude Code 斜杠命令系统设计',
      ];
      await ctx.sendMessage(lines.filter(Boolean).join('\n'));
    },
  };
}
