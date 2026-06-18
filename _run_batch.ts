/**
 * 批量运行多个任务，记录所有结果
 */
import 'dotenv/config';
import { OpenAIProvider } from './src/providers/OpenAIProvider.js';
import { Harness } from './src/harness/Harness.js';
import { Session } from './src/session/Session.js';
import { builtinTools } from './src/harness/tools/index.js';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = 'C:\\Users\\瓜皮少年\\Desktop\\Fricless-Debug-Log\\batch-results';
fs.mkdirSync(LOG_DIR, { recursive: true });

const provider = new OpenAIProvider({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com/v1',
  maxTokens: 8192,
  vendor: 'deepseek',
});

const tools = builtinTools.filter(t => !['agent', 'task_create', 'task_get', 'task_list', 'task_update', 'task_stop', 'task_output'].includes(t.name));

const tasks = [
  ['04-代码生成', '写一个Python函数判断回文数'],
  ['05-翻译', '把"Hello world, this is Fricless AI gateway"翻译成中文'],
  ['06-json', '把{"users":[{"name":"张三","age":28},{"name":"李四","age":32}]}格式化输出'],
  ['07-base64', '把"Hello Fricless"进行base64编码'],
  ['08-hash', '计算"hello world"的MD5和SHA256'],
  ['09-uuid', '生成2个UUID'],
  ['10-时间戳', '获取当前Unix时间戳并解释意义'],
  ['11-单位转换', '把100公里转英里，100摄氏度转华氏度'],
  ['12-颜色', '#FF0000是什么颜色？转RGB和HSL'],
  ['13-密码', '生成一个16位强密码'],
];

let pass = 0, fail = 0;
let allLog = `# 批量测试结果 (${new Date().toISOString()})\n\n`;

for (const [name, prompt] of tasks) {
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
  const session = new Session({ id: name, userId: 'test' });
  const h = new Harness({
    session, provider, tools, commandDefs: [], renderer: r, chatId: name,
    options: { systemPrompt: '你是AI助手。回答简洁准确。', maxToolRoundtrips: 6 },
  });

  process.stdout.write(`[${name}]...`);
  const start = Date.now();
  try {
    await h.handleUserMessage(prompt);
  } catch (e: any) { r.errors.push(e.message.slice(0, 100)); }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const ok = r.errors.length === 0 && r.output.length > 10;

  if (ok) { pass++; process.stdout.write(` ✅ ${elapsed}s\n`); }
  else { fail++; process.stdout.write(` ❌ ${elapsed}s\n`); }

  const singleLog = [
    `## ${name}`,
    `> 耗时: ${elapsed}s | 工具: ${r.toolCalls.join(', ') || '无'} | 状态: ${ok ? '✅' : '❌'}`,
    '',
    '### 输入',
    prompt,
    '',
    '### 输出',
    r.output.slice(0, 1000),
    '',
    '---',
  ].join('\n');

  allLog += singleLog + '\n';

  // 保存单任务日志
  fs.writeFileSync(path.join(LOG_DIR, `${name}.md`), singleLog, 'utf-8');
}

allLog += `\n## 总计\n${pass}/${pass+fail} 通过 (${(pass/(pass+fail)*100).toFixed(0)}%)\n`;
fs.writeFileSync(path.join(LOG_DIR, 'SUMMARY.md'), allLog, 'utf-8');
console.log(`\n📁 ${LOG_DIR}/SUMMARY.md`);
console.log(`总计: ${pass}/${pass+fail} 通过`);
process.exit(fail > 0 ? 1 : 0);
