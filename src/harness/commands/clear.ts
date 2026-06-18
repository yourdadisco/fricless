import { Command } from '../Command.js';

export const clearCommand = new Command({
  name: 'clear',
  aliases: ['reset', 'new'],
  description: '清空当前对话上下文，重新开始',
  usage: '/clear',
  async execute(_args, ctx) {
    // 实际清除逻辑在 Harness 中通过事件处理
    // 这里触发通知
    await ctx.sendMessage('🧹 已清空对话历史，让我们重新开始吧！');
  },
});
