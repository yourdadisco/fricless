import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { resolvePath } from './path_utils.js';

export const readFileTool = defineTool({
  name: 'readFile',
  description: '读取文件内容。支持 ~/Desktop/file.txt 格式的相对路径。',
  inputSchema: z.object({
    path: z.string().describe('文件路径，支持 ~/Desktop/file.txt 或 C:\\Users\\name\\file.txt'),
    maxLines: z.number().optional().describe('最大行数'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  isDestructive: false,
  permissionLevel: 'auto',
  searchHint: 'file read cat view content open',
  maxResultSizeChars: 10000,
  async call(input, ctx) {
    const { path, maxLines } = input;
    const resolvedPath = resolvePath(path);
    const fs = await import('node:fs');
    try {
      if (!fs.existsSync(resolvedPath)) return { data: `文件不存在: ${resolvedPath}`, isError: true };
      let content = fs.readFileSync(resolvedPath, 'utf-8');
      if (maxLines) {
        const lines = content.split('\n');
        content = lines.slice(0, maxLines).join('\n');
        if (lines.length > maxLines) content += '\n... (' + (lines.length - maxLines) + ' more lines)';
      }
      return { data: content };
    } catch (e: any) { return { data: `读取失败: ${e.message}`, isError: true }; }
  },
});
