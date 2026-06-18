/**
 * ReleaseNotes Command — 显示发布说明
 *
 * 对应斜杠命令:
 *   /release_notes [version] — 查看发布说明
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

const RELEASE_NOTES: Record<string, string[]> = {
  '1.0.0': [
    '🎉 初始发布',
    '核心对话功能',
    '斜杠命令系统',
    '文件编辑支持',
  ],
  '1.1.0': [
    '✨ 新增记忆系统',
    '✨ 新增插件架构',
    '🔧 改进错误处理',
    '📝 更新文档',
  ],
  '1.2.0': [
    '✨ 新增 IDE 集成',
    '✨ 新增远程桥接',
    '⚡ 性能优化',
    '🐛 Bug 修复',
  ],
};

export function createReleaseNotesCommand(
  getCurrentVersion?: () => string,
): CommandDef {
  return {
    name: 'release_notes',
    aliases: ['changelog', 'whats-new', 'releases'],
    description: '显示发布说明和更新日志',
    usage: '/release_notes [版本号]',
    async execute(args: string[], ctx: CommandContext) {
      const currentVersion = getCurrentVersion?.() ?? '1.2.0';
      const requestedVersion = args[0] || 'all';

      if (requestedVersion === 'all') {
        const lines = ['📋 **发布说明**', '---'];
        for (const [version, notes] of Object.entries(RELEASE_NOTES).reverse()) {
          lines.push(`**v${version}**${version === currentVersion ? ' ← 当前' : ''}`);
          notes.forEach(n => lines.push(`  • ${n}`));
          lines.push('');
        }
        lines.push('---');
        lines.push('使用 `/release_notes <version>` 查看特定版本。');
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      const notes = RELEASE_NOTES[requestedVersion];
      if (notes) {
        const lines = [
          `📋 **v${requestedVersion} 发布说明**`,
          '---',
          ...notes.map(n => `  • ${n}`),
        ];
        await ctx.sendMessage(lines.join('\n'));
      } else {
        await ctx.sendMessage(`未找到版本 "${requestedVersion}" 的发布说明。当前版本: v${currentVersion}`);
      }
    },
  };
}
