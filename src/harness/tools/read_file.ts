import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const readFileTool = defineTool({
  name: 'readFile',
  description: '读取文件内容。支持文本文件，可限制行数。',
  inputSchema: z.object({
    path: z.string().describe('文件路径'),
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
    const fs = await import('node:fs');
    try {
      if (!fs.existsSync(path)) return { data: 'File not found: ' + path, isError: true };
      let content = fs.readFileSync(path, 'utf-8');
      if (maxLines) {
        const lines = content.split('\n');
        content = lines.slice(0, maxLines).join('\n');
        if (lines.length > maxLines) content += '\n... (' + (lines.length - maxLines) + ' more lines)';
      }
      return { data: content };
    } catch (e: any) { return { data: 'Read failed: ' + e.message, isError: true }; }
  },
});
