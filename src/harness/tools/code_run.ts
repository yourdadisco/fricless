/**
 * Code Run Tool — 运行代码
 *
 * 支持在沙箱中运行 JavaScript/TypeScript 代码（使用 Node.js vm 模块）。
 * 其他语言返回暂不支持的消息。
 *
 * 注意: 这是一个基础实现，生产环境应使用更安全的沙箱方案（如 Docker、vm2）。
 */

import vm from 'node:vm';
import { z } from 'zod';
import { defineTool } from '../Tool.js';

/** 支持的语言列表 */
const SUPPORTED_LANGUAGES = ['javascript', 'js', 'typescript', 'ts'];

/** 创建沙箱上下文 */
function createSandbox(): Record<string, unknown> {
  return {
    console: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      info: (...args: unknown[]) => logs.push(`[INFO] ${args.map(String).join(' ')}`),
      warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
      error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Math: Math,
    JSON: JSON,
    Date: Date,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    RegExp: RegExp,
    Map: Map,
    Set: Set,
    Promise: Promise,
  };
}

// 收集日志的全局变量（每次执行前重置）
let logs: string[] = [];

export const codeRunTool = defineTool({
  name: 'code_run',
  description: '运行 JavaScript/TypeScript 代码（沙箱环境），其他语言暂不支持',
  searchHint: '运行代码 执行脚本 沙箱 JavaScript runtime code execute sandbox vm',
  inputSchema: z.object({
    language: z
      .string()
      .min(1)
      .describe('代码语言，目前支持: javascript, js, typescript, ts'),
    code: z
      .string()
      .min(1)
      .describe('要执行的代码内容'),
  }),
  isReadOnly: false,
  isDestructive: true,
  permissionLevel: 'confirm',
  async call(input) {
    const { language, code } = input as { language?: string; code?: string };
    if (!code) return { data: '请提供要执行的代码', isError: true };
    const lang = (language || 'javascript').toLowerCase().trim();

    // 检查语言支持
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      return {
        data: [
          `❌ 暂不支持 "${language}" 语言。`,
          '',
          `目前支持的编程语言: ${SUPPORTED_LANGUAGES.join(', ')}`,
          `其他语言的执行环境正在开发中。`,
        ].join('\n'),
        isError: true,
      };
    }

    // 重置日志
    logs = [];

    try {
      const sandbox = createSandbox();
      const context = vm.createContext(sandbox);
      const script = new vm.Script(code, {
        filename: 'code_run_sandbox.js',
      });

      const startTime = Date.now();
      const result = script.runInContext(context, {
        timeout: 5000,
        breakOnSigint: true,
      });
      const elapsed = Date.now() - startTime;

      // 格式化结果
      const resultStr = result === undefined ? 'undefined' : String(result);
      const logOutput = logs.join('\n');

      const lines = [
        '✅ **代码执行成功**',
        '---',
        `⏱ 耗时: ${elapsed}ms`,
        '',
      ];

      if (resultStr !== 'undefined' || logOutput) {
        if (resultStr !== 'undefined') {
          lines.push('**返回值**:');
          lines.push(`\`\`\`\n${resultStr}\n\`\`\``);
        }
        if (logOutput) {
          lines.push('**控制台输出**:');
          lines.push(`\`\`\`\n${logOutput}\n\`\`\``);
        }
      } else {
        lines.push('代码执行完毕，无返回值或控制台输出。');
      }

      return {
        data: lines.join('\n'),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const logOutput = logs.join('\n');

      const lines = [
        '❌ **代码执行失败**',
        '---',
        `错误: ${msg}`,
      ];

      if (logOutput) {
        lines.push('', '**执行期间的输出**:', `\`\`\`\n${logOutput}\n\`\`\``);
      }

      return {
        data: lines.join('\n'),
        isError: true,
      };
    }
  },
});
