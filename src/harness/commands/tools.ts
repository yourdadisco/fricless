/**
 * Tools Command — 列出所有可用工具 / 搜索工具
 *
 * 对应斜杠命令:
 *   /tools — 列出所有可用工具
 *   /tool_search <query> — 按名称/描述/关键词搜索工具
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';
import type { AnyTool } from '../Tool.js';

/**
 * 创建 /tools 和 /tool_search 命令
 *
 * @param getTools - 获取当前可用工具列表的回调函数
 */
export function createToolsCommand(getTools: () => AnyTool[]): CommandDef[] {
  const toolsCommand: CommandDef = {
    name: 'tools',
    aliases: ['tool-list'],
    description: '显示所有可用的工具列表',
    usage: '/tools',
    async execute(_args: string[], ctx: CommandContext) {
      const tools = getTools();
      if (tools.length === 0) {
        await ctx.sendMessage('当前没有可用的工具。');
        return;
      }

      const lines = [
        '🛠️ **可用工具列表**',
        '---',
        ...tools.map(t => {
          const badges = [];
          if (t.isReadOnly) badges.push('🔍 只读');
          if (t.isDestructive) badges.push('⚠️ 破坏性');
          if (t.permissionLevel === 'confirm') badges.push('🔐 需确认');
          const badgeStr = badges.length > 0 ? ` (${badges.join(', ')})` : '';
          const hint = t.searchHint ? ` — ${t.searchHint}` : '';
          return `• **${t.name}**${badgeStr}: ${t.description}${hint}`;
        }),
        '---',
        `共 ${tools.length} 个工具。使用 \`/tool_search <关键词>\` 搜索工具。`,
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };

  const toolSearchCommand: CommandDef = {
    name: 'tool_search',
    aliases: ['tool-search', 'toolfind'],
    description: '搜索可用工具',
    usage: '/tool_search <关键词>',
    async execute(args: string[], ctx: CommandContext) {
      const query = args.join(' ').toLowerCase().trim();
      if (!query) {
        await ctx.sendMessage('请提供搜索关键词。用法: `/tool_search <关键词>`');
        return;
      }

      const tools = getTools();
      const matches = tools.filter(t => {
        const searchText = [
          t.name,
          t.description,
          t.searchHint ?? '',
          ...(t.aliases ?? []),
        ].join(' ').toLowerCase();
        return searchText.includes(query);
      });

      if (matches.length === 0) {
        await ctx.sendMessage(`没有找到匹配 "${query}" 的工具。`);
        return;
      }

      const lines = [
        `🔍 **工具搜索结果: "${query}"** (${matches.length} 个)`,
        '---',
        ...matches.map(t => {
          const hint = t.searchHint ? ` — ${t.searchHint}` : '';
          return `• **${t.name}**: ${t.description}${hint}`;
        }),
      ];
      await ctx.sendMessage(lines.join('\n'));
    },
  };

  return [toolsCommand, toolSearchCommand];
}
