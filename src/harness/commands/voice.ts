/**
 * Voice Command — 语音模式信息（存根）
 *
 * 对应斜杠命令:
 *   /voice — 显示语音模式信息
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

export function createVoiceCommand(
  getVoiceStatus?: () => { available: boolean; inputDevice?: string; outputDevice?: string },
): CommandDef {
  return {
    name: 'voice',
    aliases: ['voice-mode', 'speech', 'audio'],
    description: '语音模式信息（实验性功能）',
    usage: '/voice',
    async execute(_args: string[], ctx: CommandContext) {
      if (getVoiceStatus) {
        const status = getVoiceStatus();
        const icon = status.available ? '🎙️' : '🔇';
        const lines = [
          `${icon} **语音模式**`,
          '---',
          `可用: ${status.available ? '是' : '否'}`,
          status.inputDevice ? `输入设备: ${status.inputDevice}` : '',
          status.outputDevice ? `输出设备: ${status.outputDevice}` : '',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
      } else {
        await ctx.sendMessage(
          '🎙️ **语音模式**\n---\n' +
          '语音模式是实验性功能，需要额外的语音识别组件。\n\n' +
          '状态: 不可用\n' +
          '请安装语音插件以启用此功能。',
        );
      }
    },
  };
}
