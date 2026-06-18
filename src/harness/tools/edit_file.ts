import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const editFileTool = defineTool({
  name: 'editFile',
  description: '编辑文件内容：替换指定文本。包含验证和预览。',
  inputSchema: z.object({
    path: z.string().describe('文件路径'),
    oldString: z.string().describe('要替换的原始文本（必须完全匹配）'),
    newString: z.string().describe('替换后的新文本'),
  }),
  isReadOnly: true,
  isConcurrencySafe: false,
  isDestructive: true,
  permissionLevel: 'confirm',
  searchHint: 'edit replace modify update change',
  maxResultSizeChars: 1000,
  async call(input, ctx) {
    const { path, oldString, newString } = input;
    const fs = await import('node:fs');
    try {
      if (!fs.existsSync(path)) return { data: 'File not found: ' + path, isError: true };
      let content = fs.readFileSync(path, 'utf-8');
      if (content.includes(oldString)) {
        content = content.replace(oldString, newString);
        fs.writeFileSync(path, content, 'utf-8');
        return { data: 'File updated: ' + path };
      }
      return { data: 'oldString not found in file', isError: true };
    } catch (e: any) { return { data: 'Edit failed: ' + e.message, isError: true }; }
  },
});
