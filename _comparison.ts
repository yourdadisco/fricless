/**
 * Fricless vs Claude Code 过程对比
 * 逐任务记录 fricless 的完整执行过程 + 我的过程 → 对比 → 优化
 */
import 'dotenv/config';
import { OpenAIProvider } from './src/providers/OpenAIProvider.js';
import { Harness } from './src/harness/Harness.js';
import { Session } from './src/session/Session.js';
import { builtinTools } from './src/harness/tools/index.js';
import * as fs from 'fs';
import * as path from 'path';

const LOG = 'C:\\Users\\瓜皮少年\\Desktop\\Fricless-Debug-Log\\process-compare';
fs.mkdirSync(LOG, { recursive: true });

const provider = new OpenAIProvider({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', maxTokens: 8192, vendor: 'deepseek',
});

const tools = builtinTools.filter(t => !['agent','task_create','task_get','task_list','task_update','task_stop','task_output','code_run','bash','powershell'].includes(t.name));

// 详细过程记录器
class ProcessRecorder {
  steps: string[] = [];
  output = '';
  errors: string[] = [];
  toolCalls: Array<{name: string; input: unknown; startTime: number}> = [];
  mode = 'terminal' as const;
  private stepStart = Date.now();

  private log(msg: string) {
    const t = ((Date.now() - this.stepStart) / 1000).toFixed(1);
    this.steps.push(`[${t}s] ${msg}`);
  }

  async text(c: string) { if (c) { this.output += c + '\n'; this.log(`文本输出: ${c.slice(0, 80)}`); } }
  async streamText(c: string, d: boolean) { this.output += c; if (d) this.log(`流结束 (${this.output.length}字)`); }
  async toolUse(name: string, input: unknown) {
    this.toolCalls.push({ name, input, startTime: Date.now() });
    const inputStr = JSON.stringify(input).slice(0, 100);
    this.log(`工具调用: ${name}(${inputStr})`);
  }
  async toolResult(name: string, result: string, isError: boolean) {
    const elapsed = ((Date.now() - this.toolCalls[this.toolCalls.length - 1]?.startTime || 0) / 1000).toFixed(1);
    this.log(`工具完成: ${name} ${isError ? '❌' : '✅'} (${elapsed}s, 返回${result.length}字)`);
  }
  async error(m: string) { this.errors.push(m); this.log(`错误: ${m.slice(0, 100)}`); }
  async markdown(c: string) { this.output += c + '\n'; }
  async list(_i: string[], _t?: string) {}
  async divider() {}

  get summary() {
    return this.steps.join('\n');
  }
}

type TaskDef = { id: string; prompt: string; category: string; claudeProcess: string };

const TASKS: TaskDef[] = [
  {
    id: 'T01-问答', category: 'basic', prompt: '用一段话介绍量子计算',
    claudeProcess: '直接回答。Claude 直接从知识库中提取量子计算的定义、原理和意义，无需调用工具。'
  },
  {
    id: 'T02-计算器', category: 'basic', prompt: '计算 123456 × 7890',
    claudeProcess: 'Claude 内置计算能力，直接计算并返回结果。不调用计算器工具。'
  },
  {
    id: 'T03-web搜索', category: 'search', prompt: '搜索2026年智能眼镜市场最新动态',
    claudeProcess: 'Claude 使用 web_search 服务端工具 → Anthropic 执行搜索 → 返回结构化结果 → 整合成报告。全程自动化。'
  },
  {
    id: 'T04-多工具', category: 'basic', prompt: '现在几点？同时算 2^16',
    claudeProcess: 'Claude 调用 datetime 获取时间，同时心算 2^16，一次性返回。'
  },
  {
    id: 'T05-多轮1', category: 'multi', prompt: '我叫张三',
    claudeProcess: 'Claude 记住名字到会话上下文，等待下一轮。'
  },
  {
    id: 'T06-多轮2', category: 'multi', prompt: '我叫什么名字？',
    claudeProcess: 'Claude 从会话历史检索消息 → 找到"我叫张三" → 回答"张三"。'
  },
  {
    id: 'T07-翻译', category: 'basic', prompt: '把"Artificial Intelligence"翻译成中文',
    claudeProcess: 'Claude 直接翻译，无需工具。'
  },
  {
    id: 'T08-时间戳', category: 'basic', prompt: '获取当前Unix时间戳并解释',
    claudeProcess: 'Claude 调用 datetime 工具 → 返回当前时间 → 计算 Unix 时间戳 → 解释意义。'
  },
  {
    id: 'T09-颜色', category: 'basic', prompt: '#FF0000转成RGB分量值',
    claudeProcess: 'Claude 心算十六进制转换：#FF=255, #00=0, #00=0 → RGB(255,0,0)。'
  },
  {
    id: 'T10-JSON', category: 'basic', prompt: '把{"name":"test","value":42}格式化输出',
    claudeProcess: 'Claude 直接输出格式化的 JSON，无需工具。'
  },
  { id: 'T11-翻译2', category: 'basic', prompt: '把"Machine Learning"翻译成中文', claudeProcess: 'Claude 直接翻译。' },
  { id: 'T12-摘要', category: 'basic', prompt: '将"量子计算是一种利用量子力学原理进行信息处理的新型计算范式，具有巨大的并行计算潜力。"做摘要', claudeProcess: 'Claude 提取核心句，无需工具。' },
  { id: 'T13-对比文本', category: 'basic', prompt: '对比"今天天气很好"和"今天天气不错"的差异', claudeProcess: 'Claude 直接分析语义差异。' },
  { id: 'T14-UUID', category: 'basic', prompt: '生成1个UUID', claudeProcess: 'Claude 调用 uuid_gen 工具 → 返回 UUID。' },
  { id: 'T15-base64', category: 'basic', prompt: '把"Fricless"做base64编码', claudeProcess: 'Claude 调用 base64 工具 → 返回编码结果。' },
  { id: 'T16-密码', category: 'basic', prompt: '生成12位密码含特殊字符', claudeProcess: 'Claude 调用 password_gen 工具 → 返回密码。' },
  { id: 'T17-正则', category: 'basic', prompt: '用正则提取"电话:138-0000-8888"中的号码', claudeProcess: 'Claude 直接写正则提取。' },
  { id: 'T18-单位', category: 'basic', prompt: '100公里是多少英里？100℃是多少℉？', claudeProcess: 'Claude 调用 unit_convert 工具或直接计算。' },
  { id: 'T19-哈希', category: 'basic', prompt: '计算"test"的SHA256', claudeProcess: 'Claude 调用 hash 工具 → 返回哈希值。' },
  { id: 'T20-混合', category: 'complex', prompt: '搜索今天AI新闻，用datetime获取日期，然后总结', claudeProcess: 'Claude 调用 datetime → 调用 web_search → 整合结果。' },
];

let pass = 0, fail = 0;
const reports: string[] = [];

for (const task of TASKS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${task.id}] ${task.prompt}`);
  console.log(`${'='.repeat(60)}`);

  // ── 跑 fricless ──
  const r = new ProcessRecorder();
  const session = new Session({ id: task.id, userId: 'test' });
  const h = new Harness({
    session, provider, tools, commandDefs: [], renderer: r, chatId: task.id,
    options: { systemPrompt: '你是AI助手。回答准确简洁。', maxToolRoundtrips: 6, maxContextTokens: 16000 },
  });

  const t0 = Date.now();
  try { await h.handleUserMessage(task.prompt); }
  catch (e: any) { r.errors.push(String(e).slice(0, 100)); }
  const t1 = ((Date.now() - t0) / 1000).toFixed(1);

  const ok = r.errors.length === 0 && (r.output.length > 5 || r.output.trim().length > 0);
  if (ok) pass++; else fail++;

  // ── 构建对比报告 ──
  const report = [
    `## ${task.id} (${task.category})`,
    `**输入**: ${task.prompt}`,
    `**耗时**: ${t1}s`,
    `**结果**: ${ok ? '✅' : '❌'}`,
    '',
    `### Fricless 执行过程`,
    '```',
    r.summary,
    '```',
    '',
    `### Fricless 最终输出`,
    '```',
    r.output.slice(0, 1000),
    r.output.length > 1000 ? '\n...(截断)' : '',
    '```',
    '',
    `### Claude Code 执行过程（参考）`,
    task.claudeProcess,
    '',
    `### 差异分析`,
    (() => {
      const issues: string[] = [];
      if (r.toolCalls.length > 0) issues.push(`调用 ${r.toolCalls.length} 个工具: ${r.toolCalls.map(t=>t.name).join(', ')}`);
      else issues.push('直接回答，无需工具');
      if (r.errors.length > 0) issues.push(`错误: ${r.errors.join('; ')}`);
      if (r.output.length < 20) issues.push('回复过短');
      return issues.join('\n');
    })(),
    '',
    `### 优化建议`,
    (() => {
      const tips: string[] = [];
      if (r.toolCalls.some(t => t.name === 'datetime' && task.id === 'T04')) tips.push('✅ 正确使用 datetime 工具');
      if (r.toolCalls.some(t => t.name === 'web_search')) tips.push('✅ 正确使用 web_search');
      if (r.errors.length > 0) tips.push(`❌ 需要修复错误处理: ${r.errors[0]}`);
      if (ok && r.errors.length === 0) tips.push('✅ 过程正常，无需优化');
      return tips.join('\n');
    })(),
    '',
    '---',
  ].join('\n');

  reports.push(report);
  console.log(`耗时: ${t1}s | 工具: ${r.toolCalls.map(t=>t.name).join(', ') || '无'} | ${ok ? '✅' : '❌'}`);

  // 写单任务日志
  fs.writeFileSync(path.join(LOG, `${task.id}.md`), report, 'utf-8');
}

// 汇总
fs.writeFileSync(path.join(LOG, 'SUMMARY.md'), [
  '# Fricless vs Claude Code 过程对比报告',
  `> 测试时间: ${new Date().toISOString()}`,
  '',
  `## 总计`,
  `✅ 通过: ${pass}`,
  `❌ 失败: ${fail}`,
  `📊 通过率: ${(pass/(pass+fail)*100).toFixed(0)}%`,
  '',
  ...reports,
].join('\n'), 'utf-8');

console.log(`\n📁 ${LOG}/SUMMARY.md`);
console.log(`总计: ${pass}/${pass+fail} 通过`);
process.exit(fail > 0 ? 1 : 0);
