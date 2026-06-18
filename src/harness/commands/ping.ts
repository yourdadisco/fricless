import { Command } from '../Command.js';

export const pingCommand = new Command({
  name: 'ping',
  aliases: ['p'],
  description: '健康检查 — 测试机器人是否在线',
  usage: '/ping',
  async execute(_args, ctx) {
    await ctx.sendMessage('🏓 pong！机器人运行正常。');
  },
});
