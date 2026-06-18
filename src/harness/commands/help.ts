import { Command } from '../Command.js';
import type { CommandDef } from '../Command.js';

export const helpCommand = (allCommands: CommandDef[]) => new Command({
  name: 'help',
  aliases: ['h', '?'],
  description: '显示帮助信息',
  usage: '/help [command]',
  async execute(args, ctx) {
    if (args.length > 0) {
      const cmdName = args[0].toLowerCase();
      const cmd = allCommands.find(c => c.name === cmdName || c.aliases?.includes(cmdName));
      if (cmd) {
        const lines = [
          `📖 **/${cmd.name}**`,
          `${cmd.description}`,
          cmd.usage ? `用法: \`${cmd.usage}\`` : '',
          cmd.aliases?.length ? `别名: ${cmd.aliases.map(a => `/${a}`).join(', ')}` : '',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
        return;
      }
      await ctx.sendMessage(`未知命令: /${cmdName}。输入 /help 查看所有命令。`);
      return;
    }

    const lines = [
      '🤖 **Fricless 机器人**',
      '---',
      ...allCommands.map(c =>
        `• **/${c.name}**${c.aliases?.length ? ` (${c.aliases.map(a => `/${a}`).join(', ')})` : ''} — ${c.description}`
      ),
      '---',
      '直接发送消息即可与 AI 对话。',
    ];
    await ctx.sendMessage(lines.join('\n'));
  },
});
