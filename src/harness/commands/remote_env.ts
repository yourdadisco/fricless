/**
 * RemoteEnv Command — 远程环境信息
 *
 * 对应斜杠命令:
 *   /remote_env — 显示远程环境信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createRemoteEnvCommand(
  getRemoteEnv?: () => { connected: boolean; host?: string; region?: string; variables?: Record<string, string> },
): CommandDef {
  return {
    name: 'remote_env',
    aliases: ['remote-env', 'env-remote'],
    description: '显示远程环境信息',
    usage: '/remote_env',
    async execute(_args: string[], ctx: CommandContext) {
      if (getRemoteEnv) {
        const env = getRemoteEnv();
        const icon = env.connected ? '🟢' : '🔴';
        const lines = [
          `${icon} **远程环境**`,
          '---',
          `连接: ${env.connected ? '已连接' : '未连接'}`,
          env.host ? `主机: \`${env.host}\`` : '',
          env.region ? `区域: ${env.region}` : '',
          '---',
          env.variables
            ? Object.entries(env.variables)
                .map(([k, v]) => `  • \`${k}\` = ${v}`)
                .join('\n')
            : '无环境变量',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      } else {
        await ctx.sendMessage(
          '🔴 **远程环境**\n---\n' +
          '未连接到远程环境。\n\n' +
          '使用 /remote_setup 查看配置指南。',
        );
      }
    },
  };
}
