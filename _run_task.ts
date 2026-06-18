/**
 * 单任务运行器：实际跑一个任务，记录输出，与我对标
 * 用法: npx tsx _run_task.ts <任务名> "<prompt>"
 */
import 'dotenv/config';
import { OpenAIProvider } from './src/providers/OpenAIProvider.js';
import { Harness } from './src/harness/Harness.js';
import { Session } from './src/session/Session.js';
import { builtinTools } from './src/harness/tools/index.js';
import * as fs from 'fs';
import * as path from 'path';

const taskName = process.argv[2] || 'unnamed';
const prompt = process.argv[3] || '你好';

const LOG_DIR = 'C:\\Users\\瓜皮少年\\Desktop\\Fricless-Debug-Log\\tasks';

const provider = new OpenAIProvider({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com/v1',
  maxTokens: 8192,
  vendor: 'deepseek',
});

const tools = builtinTools.filter(t => !['agent', 'task_create', 'task_get', 'task_list', 'task_update', 'task_stop', 'task_output', 'code_run', 'bash', 'powershell'].includes(t.name));

class Capturer {
  output = '';
  toolCalls: string[] = [];
  errors: string[] = [];
  mode = 'terminal' as const;

  async text(c: string) { this.output += c + '\n'; }
  async streamText(c: string, d: boolean) { this.output += c; if (d) this.output += '\n'; }
  async toolUse(n: string) { this.toolCalls.push(n); }
  async toolResult(_n: string, _r: string, _e: boolean) {}
  async error(m: string) { this.errors.push(m); this.output += '[ERROR] ' + m + '\n'; }
  async markdown(c: string) { this.output += c + '\n'; }
  async list(_i: string[], _t?: string) {}
  async divider() {}
}

const r = new Capturer();
const session = new Session({ id: taskName, userId: 'test' });
const h = new Harness({
  session, provider, tools, commandDefs: [], renderer: r, chatId: taskName,
  options: { systemPrompt: '你是AI助手。当需要最新信息时用web_search搜索。回答引用来源。', maxToolRoundtrips: 8, maxContextTokens: 16000 },
});

const start = Date.now();
console.log(`\n=== 任务: ${taskName} ===`);
console.log(`输入: ${prompt}\n`);

try {
  await h.handleUserMessage(prompt);
} catch (e: any) {
  console.log(`[EXCEPTION] ${e.message.slice(0, 100)}`);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const hasOutput = r.output.length > 20;
const hasError = r.errors.length > 0;

// 输出结果
console.log(`\n⏱️ ${elapsed}s`);
console.log(`工具: ${r.toolCalls.join(', ') || '无'}`);
console.log(`错误: ${r.errors.length}`);
console.log(`\n--- 输出 (${r.output.length}字) ---`);
console.log(r.output.slice(0, 2000) + (r.output.length > 2000 ? '\n...(截断)' : ''));

// 写入日志
const logFile = path.join(LOG_DIR, `${taskName}.md`);
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.writeFileSync(logFile, [
  `# 任务: ${taskName}`,
  `> 耗时: ${elapsed}s`,
  `> 工具: ${r.toolCalls.join(', ') || '无'}`,
  `> 错误: ${r.errors.length}`,
  '',
  '## 输入',
  prompt,
  '',
  '## 输出',
  r.output,
].join('\n'), 'utf-8');

console.log(`\n📁 ${logFile}`);
console.log(`\n=== 判定: ${!hasError && hasOutput ? '✅ 通过' : '❌ 失败'} ===`);
process.exit(!hasError && hasOutput ? 0 : 1);
