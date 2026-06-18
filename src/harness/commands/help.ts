import { Command } from '../Command.js';
import type { CommandDef } from '../Command.js';

// 命令分类
const CATEGORIES: Record<string, string[]> = {
  '基础': ['ping', 'help', 'clear', 'exit', 'debug', 'mode', 'config', 'env', 'version'],
  'AI 模型': ['model', 'effort', 'fast', 'token', 'cost', 'usage'],
  '会话': ['session', 'sessions', 'history', 'context', 'status', 'resume', 'rename'],
  '数据': ['export', 'import', 'save', 'load', 'copy', 'share'],
  '工具': ['tools', 'tool_search', 'files', 'search', 'skills', 'plugins'],
  '开发': ['init', 'doctor', 'diff', 'review', 'security_review', 'plan', 'task'],
  '系统': ['system', 'memory', 'notebook', 'tag', 'hooks', 'keybindings'],
  '其他': ['advisor', 'brief', 'branch', 'bridge', 'chrome', 'color', 'compact', 'ctx_viz',
           'desktop', 'extra_usage', 'feedback', 'good_claude', 'ide', 'insights', 'issue',
           'login', 'logout', 'mobile', 'mock_limits', 'oauth_refresh', 'onboarding',
           'output_style', 'passes', 'perf_issue', 'permissions', 'plugin', 'pr_comments',
           'privacy_settings', 'rate_limit_options', 'release_notes', 'reload_plugins',
           'remote_env', 'remote_setup', 'reset_limits', 'retry', 'rewind',
           'sandbox_toggle', 'stickers', 'summary', 'teleport', 'terminal_setup',
           'thinkback', 'upgrade', 'vim', 'voice'],
};

/** 获取命令所属分类 */
function getCategory(name: string): string {
  for (const [cat, cmds] of Object.entries(CATEGORIES)) {
    if (cmds.includes(name)) return cat;
  }
  return '其他';
}

export const helpCommand = (allCommands: CommandDef[]) => new Command({
  name: 'help',
  aliases: ['h', '?'],
  description: '显示帮助信息。使用 /help <命令名> 查看具体用法。',
  usage: '/help [command]',
  async execute(args, ctx) {
    // 查看具体命令的帮助
    if (args.length > 0) {
      const cmdName = args[0].toLowerCase();
      const cmd = allCommands.find(c => c.name === cmdName || c.aliases?.includes(cmdName));
      if (cmd) {
        const lines = [
          `**/${cmd.name}**`,
          `${cmd.description}`,
          cmd.usage ? `\`${cmd.usage}\`` : '',
          cmd.aliases?.length ? `别: ${cmd.aliases.map(a => `/${a}`).join(' ')}` : '',
        ];
        await ctx.sendMessage(lines.filter(Boolean).join('\n'));
        return;
      }
      await ctx.sendMessage(`未知命令: /${cmdName}。输入 /help 查看所有命令。`);
      return;
    }

    // 按分类展示
    const cmdMap = new Map(allCommands.map(c => [c.name, c]));

    // 先发简短提示
    await ctx.sendMessage('**Fricless 命令列表**  (/help <命令名> 查看详情)');

    // 按分类发送，每类一条消息
    for (const [category, cmdNames] of Object.entries(CATEGORIES)) {
      const available = cmdNames.filter(n => cmdMap.has(n));
      if (available.length === 0) continue;
      const lines = available.map(n => {
        const cmd = cmdMap.get(n)!;
        return `\`/${n.padEnd(14)}\` ${cmd.description}`;
      });
      await ctx.sendMessage(`**${category}**\n${lines.join('\n')}`);
    }

    await ctx.sendMessage('直接发送消息即可与 AI 对话。');
  },
});
