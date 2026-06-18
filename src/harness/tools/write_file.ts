import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const writeFileTool = defineTool({
  name: 'writeFile',
  description: '写入文件内容。注意：此操作会覆盖已有文件。',
  inputSchema: z.object({
    path: z.string().describe('文件路径'),
    content: z.string().describe('写入内容'),
  }),
  isReadOnly: true,
  isConcurrencySafe: false,
  isDestructive: true,
  permissionLevel: 'confirm',
  searchHint: 'file write save create',
  maxResultSizeChars: 500,
  async call(input, ctx) {
    const { path, content } = input;
    const fs = await import('node:fs');
    try { fs.writeFileSync(path, content, 'utf-8'); return { data: 'File written: ' + path }; }
    catch (e: any) { return { data: 'Write failed: ' + e.message, isError: true }; }
  },
});
