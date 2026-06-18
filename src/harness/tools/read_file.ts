import { z } from 'zod';
import path from 'node:path';
import { defineTool } from '../Tool.js';
import { resolvePath } from './path_utils.js';

// Claude Code pattern: append CWD to file not found errors
const CWD_NOTE = process.cwd();

export const readFileTool = defineTool({
  name: 'readFile',
  description: '读取文件内容。参数 file_path 必须是绝对路径。',
  inputSchema: z.object({
    file_path: z.string().describe('文件的绝对路径'),
    offset: z.number().optional().describe('起始行号'),
    limit: z.number().optional().describe('读取行数'),
  }),
  // Claude Code pattern: expand paths BEFORE validation/permission checks
  backfillObservableInput(input) {
    // 兼容 AI 发送的 path 和 file_path 两种参数名
    const fp = (input.file_path || input.path || '') as string;
    if (fp) {
      const resolved = resolvePath(fp);
      input.file_path = resolved;
      input.path = resolved;
    }
  },
  isReadOnly: true,
  isConcurrencySafe: true,
  searchHint: 'read files images pdfs notebooks',
  maxResultSizeChars: 10000,
  async call(input, ctx) {
    const { file_path, offset, limit } = input as { file_path: string; offset?: number; limit?: number };
    const fs = await import('node:fs');
    try {
      if (!fs.existsSync(file_path)) {
        return { data: `文件不存在: ${file_path}。当前工作目录: ${CWD_NOTE}`, isError: true };
      }
      let content = fs.readFileSync(file_path, 'utf-8');
      if (offset !== undefined || limit !== undefined) {
        const lines = content.split('\n');
        const start = offset ?? 0;
        const end = limit ? start + limit : lines.length;
        content = lines.slice(start, end).join('\n');
        if (lines.length > end) content += `\n... (共 ${lines.length} 行，显示 ${start}-${end})`;
      }
      // 直接输出到用户屏幕，防止 AI 忽略结果
      await ctx.sendMessage(content);
      return { data: content };
    } catch (e: any) {
      return { data: `读取失败 [${file_path}]: ${e.message}`, isError: true };
    }
  },
});
