import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const grepTool = defineTool({
  name: 'grep',
  description: '在文件中搜索文本内容，支持正则表达式。',
  inputSchema: z.object({
    pattern: z.string().describe('搜索模式（支持正则）'),
    path: z.string().optional().describe('搜索路径（默认当前目录）'),
    glob: z.string().optional().describe('文件过滤模式，如 "*.ts"'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  isDestructive: false,
  permissionLevel: 'auto',
  searchHint: 'grep search find text content regex',
  maxResultSizeChars: 8000,
  async call(input, ctx) {
    const { pattern, path = '.', glob } = input;
    const { execSync } = await import('node:child_process');
    try {
      const globFilter = glob ? '--include="' + glob + '"' : '';
      let cmd;
      if (process.platform === 'win32') {
        cmd = 'findstr /s /n /c:"' + pattern + '" ' + path + '\\*' + (glob ? '.' + glob.split('.').pop() : '.ts');
      } else {
        cmd = 'grep -rn ' + globFilter + ' "' + pattern + '" ' + path + ' 2>/dev/null | head -50';
      }
      const result = execSync(cmd, { timeout: 10000 }).toString().trim();
      const lines = result.split('\n').filter(Boolean).slice(0, 50);
      return { data: lines.length ? lines.join('\n') : 'No matches for: ' + pattern };
    } catch { return { data: 'No matches for: ' + pattern }; }
  },
});
