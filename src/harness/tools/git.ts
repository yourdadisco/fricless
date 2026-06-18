import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { execSync } from 'node:child_process';

export const gitTool = defineTool({
  name: 'git',
  description: '执行 Git 操作：提交、分支、日志、状态、推送等。',
  searchHint: 'git commit branch push pull log status version control',
  inputSchema: z.object({
    action: z.enum([
      'status', 'log', 'diff', 'branch', 'commit',
      'push', 'pull', 'add', 'checkout', 'merge',
    ]).describe('Git 操作类型'),
    args: z.array(z.string()).optional().describe('附加参数'),
    message: z.string().optional().describe('提交信息（commit 时必填）'),
    branch: z.string().optional().describe('分支名（branch/checkout 时使用）'),
    path: z.string().optional().describe('操作路径（默认当前目录）'),
  }),
  isReadOnly: false,
  isDestructive: true,
  permissionLevel: 'confirm',
  async call(input) {
    const { action, args = [], message, branch, path = '.' } = input as {
      action: string; args?: string[]; message?: string; branch?: string; path?: string;
    };

    try {
      let cmd = `git -C "${path}"`;

      switch (action) {
        case 'status':
          cmd += ' status --short';
          break;
        case 'log':
          cmd += ` log --oneline --graph -20 ${args.join(' ')}`;
          break;
        case 'diff':
          cmd += ` diff ${args.join(' ')}`;
          break;
        case 'branch':
          cmd += ` branch ${args.join(' ')}`;
          if (branch) cmd += ` ${branch}`;
          break;
        case 'commit':
          if (!message) return { data: '请提供提交信息（message 参数）', isError: true };
          cmd += ` commit -m "${message.replace(/"/g, '\\"')}"`;
          break;
        case 'add':
          cmd += ` add ${args.join(' ') || '.'}`;
          break;
        case 'push':
          cmd += ` push ${args.join(' ')}`;
          break;
        case 'pull':
          cmd += ` pull ${args.join(' ')}`;
          break;
        case 'checkout':
          if (branch) cmd += ` checkout ${branch}`;
          else if (args.length > 0) cmd += ` checkout ${args.join(' ')}`;
          else return { data: '请指定分支名', isError: true };
          break;
        case 'merge':
          if (branch) cmd += ` merge ${branch}`;
          else return { data: '请指定要合并的分支', isError: true };
          break;
        default:
          return { data: `不支持的 Git 操作: ${action}`, isError: true };
      }

      const result = execSync(cmd, { encoding: 'utf-8', timeout: 30000, cwd: path });
      return { data: result || '(无输出)' };
    } catch (e: any) {
      const msg = e.stderr || e.stdout || e.message || String(e);
      return { data: msg.trim(), isError: true };
    }
  },
});
