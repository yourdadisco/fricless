/**
 * RemoteSetup Command — 远程设置指南
 *
 * 对应斜杠命令:
 *   /remote_setup — 显示远程环境设置指南
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createRemoteSetupCommand(): CommandDef {
  return {
    name: 'remote_setup',
    aliases: ['remote-setup', 'remote-config', 'connect-remote'],
    description: '显示远程环境设置指南',
    usage: '/remote_setup',
    async execute(_args: string[], ctx: CommandContext) {
      const lines = [
        '🌐 **远程环境设置指南**',
        '---',
        '**步骤 1: 安装远程代理**',
        '```bash',
        'npm install -g fricless-remote-agent',
        '```',
        '',
        '**步骤 2: 启动代理**',
        '```bash',
        'fricless-remote-agent start --token YOUR_TOKEN',
        '```',
        '',
        '**步骤 3: 验证连接**',
        '```',
        '/bridge  # 查看连接状态',
        '/remote_env  # 查看远程环境',
        '```',
        '',
        '**环境要求:**',
        '  • Node.js >= 18',
        '  • 稳定的网络连接',
        '  • 认证令牌',
        '---',
        '更多信息: https://fricless.dev/docs/remote',
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };
}
