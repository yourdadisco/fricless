/**
 * Chrome Command — 浏览器集成
 *
 * 对应斜杠命令:
 *   /chrome [action] — 打开/控制 Chrome 浏览器集成
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createChromeCommand(
  chromeIntegration?: {
    open?: (url?: string) => Promise<void>;
    close?: () => Promise<void>;
    status?: () => { running: boolean; tabs: number };
  },
): CommandDef {
  return {
    name: 'chrome',
    aliases: ['browser', 'web'],
    description: '浏览器集成管理',
    usage: '/chrome [open|close|status] [url]',
    async execute(args: string[], ctx: CommandContext) {
      const action = args[0]?.toLowerCase();

      if (!action || action === 'status') {
        if (chromeIntegration?.status) {
          const s = chromeIntegration.status();
          const icon = s.running ? '🟢' : '🔴';
          await ctx.sendMessage(
            `${icon} **浏览器状态**\n---\n` +
            `运行中: ${s.running ? '是' : '否'}\n` +
            `标签页: ${s.tabs}`,
          );
        } else {
          await ctx.sendMessage(
            '🌐 **浏览器集成**\n---\n' +
            '状态: 未连接\n\n' +
            '可用操作:\n' +
            '  • \`/chrome open [url]\` — 打开浏览器\n' +
            '  • \`/chrome close\` — 关闭浏览器\n' +
            '  • \`/chrome status\` — 查看状态',
          );
        }
        return;
      }

      if (action === 'open') {
        const url = args.slice(1).join(' ');
        if (chromeIntegration?.open) {
          await chromeIntegration.open(url || undefined);
          await ctx.sendMessage(url ? `🌐 已打开 \`${url}\`` : '🌐 已打开浏览器。');
        } else {
          await ctx.sendMessage(url ? `🌐 已在浏览器中打开 \`${url}\`（模拟）。` : '🌐 已打开浏览器（模拟）。');
        }
        return;
      }

      if (action === 'close') {
        if (chromeIntegration?.close) {
          await chromeIntegration.close();
          await ctx.sendMessage('🌐 浏览器已关闭。');
        } else {
          await ctx.sendMessage('🌐 浏览器已关闭（模拟）。');
        }
        return;
      }

      await ctx.sendMessage(`未知操作 "${action}"。可用: open, close, status`);
    },
  };
}
