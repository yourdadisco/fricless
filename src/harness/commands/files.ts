/**
 * Files Command — 列出目录中的文件（CLI 模式）
 *
 * 对应斜杠命令:
 *   /files [路径] — 列出指定目录中的文件
 */

import { Command } from '../Command.js';
import type { CommandDef, CommandContext } from '../Command.js';

/**
 * 创建 /files 命令
 *
 * @param listFiles - 列出文件的回调
 */
export function createFilesCommand(
  listFiles?: (dir: string) => Promise<{ name: string; size: number; isDir: boolean; modified: Date }[]>,
): CommandDef {
  return {
    name: 'files',
    aliases: ['ls', 'dir', 'file-list'],
    description: '列出指定目录中的文件（CLI 模式）',
    usage: '/files [路径]',
    async execute(args: string[], ctx: CommandContext) {
      const dir = args[0] ?? '.';

      if (!listFiles) {
        const sample = [
          { name: 'src/', size: 0, isDir: true, modified: new Date() },
          { name: 'package.json', size: 2340, isDir: false, modified: new Date() },
          { name: 'tsconfig.json', size: 580, isDir: false, modified: new Date() },
          { name: 'README.md', size: 1200, isDir: false, modified: new Date() },
        ];
        const lines = [
          `📁 **文件列表: \`${dir}\`**`,
          '---',
          ...sample.map(f => {
            const icon = f.isDir ? '📁' : '📄';
            const sizeStr = f.isDir ? '' : ` (${formatSize(f.size)})`;
            const time = f.modified.toLocaleDateString();
            return `${icon} **${f.name}**${sizeStr} — ${time}`;
          }),
          '---',
          '（当前环境未接入文件系统，以上为示例数据）',
        ];
        await ctx.sendMessage(lines.join('\n'));
        return;
      }

      try {
        const files = await listFiles(dir);
        if (files.length === 0) {
          await ctx.sendMessage(`目录 \`${dir}\` 为空或不存在。`);
          return;
        }

        const dirs = files.filter(f => f.isDir);
        const fileList = files.filter(f => !f.isDir);

        const lines = [
          `📁 **文件列表: \`${dir}\`** (${files.length} 项)`,
          '---',
          ...dirs.map(d => `📁 **${d.name}/**`),
          ...fileList.map(f => `📄 **${f.name}** (${formatSize(f.size)})`),
        ];
        await ctx.sendMessage(lines.join('\n'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.sendMessage(`读取目录失败: ${msg}`);
      }
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
