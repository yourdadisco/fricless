import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const globTool = defineTool({
  name: 'glob',
  description: '使用通配符模式搜索文件路径。支持 **/*.ts 等模式。',
  inputSchema: z.object({
    pattern: z.string().describe('通配符模式，如 "**/*.ts"'),
    path: z.string().optional().describe('搜索目录（默认当前目录）'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  isDestructive: false,
  permissionLevel: 'auto',
  searchHint: 'glob find search file pattern wildcard',
  maxResultSizeChars: 5000,
  async call(input, ctx) {
    const { pattern, path = '.' } = input;
    const { execSync } = await import('node:child_process');
    try {
      const cmd = process.platform === 'win32'
        ? 'cmd /c "dir /s /b ' + path.replace(/\//g,'\\') + ' 2>nul | findstr /i ' + pattern.replace(/\*/g,'.')
        : 'find ' + path + ' -name "' + pattern + '" 2>/dev/null | head -100';
      const result = execSync(cmd, { timeout: 5000 }).toString().trim();
      const files = result.split('\n').filter(Boolean).slice(0, 100);
      return { data: files.length ? files.join('\n') : 'No matches for: ' + pattern };
    } catch { return { data: 'No matches for: ' + pattern }; }
  },
});
