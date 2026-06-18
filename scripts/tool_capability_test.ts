/**
 * Fricless Tool Capability Test
 *
 * Tests all 32 tools by calling their `.call()` function directly with
 * appropriate test inputs. Runs programmatically (no interactive CLI needed).
 * Appends results to the debug log file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = 'C:/Users/瓜皮少年/Desktop/Fricless-Debug-Log/01-工具能力测试.md';

// ── Tool Imports ──────────────────────────────────────────

// File operations
const { readFileTool } = await import('../src/harness/tools/read_file.js');
const { writeFileTool } = await import('../src/harness/tools/write_file.js');
const { editFileTool } = await import('../src/harness/tools/edit_file.js');
const { globTool } = await import('../src/harness/tools/glob.js');
const { grepTool } = await import('../src/harness/tools/grep.js');

// Code execution
const { bashTool } = await import('../src/harness/tools/bash.js');
const { powershellTool } = await import('../src/harness/tools/powershell.js');
const { codeRunTool } = await import('../src/harness/tools/code_run.js');

// Network
const { webSearchTool } = await import('../src/harness/tools/web_search.js');
const { webFetchTool } = await import('../src/harness/tools/web_fetch.js');
const { webBrowserTool } = await import('../src/harness/tools/web_browser.js');

// Data
const { hashTool } = await import('../src/harness/tools/hash.js');
const { uuidGenTool } = await import('../src/harness/tools/uuid_gen.js');
const { dateTimeTool } = await import('../src/harness/tools/datetime.js');
const { timeTool } = await import('../src/harness/tools/time.js');

// Conversion
const { translateTool } = await import('../src/harness/tools/translate.js');

// Task Management
const { taskCreateTool } = await import('../src/harness/tools/task_create.js');
const { taskGetTool } = await import('../src/harness/tools/task_get.js');
const { taskListTool } = await import('../src/harness/tools/task_list.js');
const { taskUpdateTool } = await import('../src/harness/tools/task_update.js');
const { taskStopTool } = await import('../src/harness/tools/task_stop.js');
const { taskOutputTool } = await import('../src/harness/tools/task_output.js');
const { TaskStore } = await import('../src/harness/tools/task_store.js');

// Utilities
const { calculatorTool } = await import('../src/harness/tools/calculator.js');
const { sleepTool } = await import('../src/harness/tools/sleep.js');
const { echoTool } = await import('../src/harness/tools/echo.js');
const { todoTool } = await import('../src/harness/tools/todo.js');

// ── Test Infrastructure ───────────────────────────────────

const results: string[] = [];
let testIndex = 0;

function makeCtx() {
  return {
    sessionId: 'test-session-001',
    userId: 'test-user',
    chatId: 'test-chat',
    sendMessage: async (content: string) => { /* no-op */ },
  };
}

function elapsed(start: bigint): string {
  return ((Number(process.hrtime.bigint() - start)) / 1e9).toFixed(2);
}

async function testTool(
  name: string,
  description: string,
  tool: { call: (input: any, ctx: any) => Promise<any> } | null,
  input: any,
  expectError?: boolean,
  timeoutMs?: number,
) {
  testIndex++;
  const start = process.hrtime.bigint();
  let toolCalled = false;
  let resultData = '';
  let errorMsg = '';
  let success = false;

  if (tool === null) {
    // Tool does not exist
    const sec = elapsed(start);
    results.push([
      `## Task ${testIndex}: ${name} - ${description}`,
      `- **Status**: NOT IMPLEMENTED (tool definition not found in codebase)`,
      `- **Prompt used**: N/A`,
      `- **Tool called**: ❌ (not found)`,
      `- **Result**: ❌`,
      `- **Error**: Tool "${name}" is not defined in src/harness/tools/`,
      `- **Time**: ${sec}s`,
      '',
    ].join('\n'));
    return;
  }

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), timeoutMs ?? 15_000);
    const ctx = { ...makeCtx(), signal: ac.signal };

    const result = await tool.call(input, ctx);
    clearTimeout(timeout);

    toolCalled = true;
    resultData = typeof result.data === 'string'
      ? result.data.slice(0, 200)
      : JSON.stringify(result.data).slice(0, 200);
    errorMsg = result.isError ? resultData : '';
    success = !result.isError;

    if (expectError) {
      // If we expected an error and got one, that's actually a pass
      if (result.isError) {
        success = true;
      }
    }
  } catch (err: any) {
    toolCalled = true;
    errorMsg = err.message ?? String(err);
    resultData = errorMsg;
    success = false;
  }

  const sec = elapsed(start);
  results.push([
    `## Task ${testIndex}: ${name} - ${description}`,
    `- **Prompt used**: \`${JSON.stringify(input).slice(0, 150)}\``,
    `- **Tool called**: ✅`,
    `- **Result**: ${success ? '✅' : '❌'}`,
    errorMsg ? `- **Error**: ${errorMsg.slice(0, 200)}` : `- **Error**: (none)`,
    `- **Time**: ${sec}s`,
    `- **Output preview**: ${resultData.slice(0, 150)}`,
    '',
  ].join('\n'));
}

// ── Header ────────────────────────────────────────────────

results.push(`# Fricless Tool Capability Test Report

> Generated: ${new Date().toISOString()}
> Project: Fricless (类 OpenClaw 骨架)
> Method: Programmatic direct tool call via tsx

`);

results.push(`## Summary

- **Total tests**: 32
- **Tools in codebase**: 25
- **Tools NOT implemented**: 7 (json_tool, base64, password_gen, regex_test, unit_convert, color_tool, diff_tool)
- **Network-dependent tools**: web_search, web_fetch, web_browser (require internet)
- **Destructive tools**: write_file, edit_file, bash, powershell, code_run (tested with safe inputs)

`);

// ── File Operations (5) ──────────────────────────────────

const tmpFile = path.join(PROJECT_ROOT, '_test_tmp.txt');

// 1. read_file
await testTool('read_file', 'Read file content', readFileTool, {
  path: path.join(PROJECT_ROOT, 'package.json'),
  maxLines: 5,
});

// 2. write_file
await testTool('write_file', 'Write content to file', writeFileTool, {
  path: tmpFile,
  content: 'Hello from Fricless tool test!',
});

// 3. edit_file
await testTool('edit_file', 'Replace text in file', editFileTool, {
  path: tmpFile,
  oldString: 'Hello',
  newString: 'Hi',
});

// 4. glob
await testTool('glob', 'Search files by pattern', globTool, {
  pattern: '*.ts',
  path: path.join(PROJECT_ROOT, 'src/harness/tools'),
});

// 5. grep
await testTool('grep', 'Search text in files', grepTool, {
  pattern: 'defineTool',
  path: path.join(PROJECT_ROOT, 'src/harness/tools'),
  glob: '*.ts',
});

// ── Code Execution (3) ───────────────────────────────────

// 6. bash
await testTool('bash', 'Execute shell command', bashTool, {
  command: 'echo "Fricless tool test OK"',
  timeout: 10,
});

// 7. powershell
await testTool('powershell', 'Execute PowerShell command', powershellTool, {
  command: 'Write-Output "Fricless PS test OK"',
  timeout: 10,
});

// 8. code_run
await testTool('code_run', 'Run JS code in sandbox', codeRunTool, {
  language: 'javascript',
  code: 'const x = 42; console.log("x =", x); x * 2;',
});

// ── Network (3) ─────────────────────────────────────────

// 9. web_search
await testTool('web_search', 'Search internet via Bing', webSearchTool, {
  query: 'Fricless AI gateway',
  count: 3,
}, false, 20_000);

// 10. web_fetch
await testTool('web_fetch', 'Fetch URL as markdown', webFetchTool, {
  url: 'https://example.com',
  maxChars: 1000,
}, false, 20_000);

// 11. web_browser
await testTool('web_browser', 'Browse web page', webBrowserTool, {
  url: 'https://example.com',
  maxChars: 1000,
}, false, 20_000);

// ── Data (5) ────────────────────────────────────────────

// 12. json_tool — does NOT exist in codebase
await testTool('json_tool', 'JSON parse/stringify/validate', null, {});

// 13. base64 — does NOT exist in codebase
await testTool('base64', 'Base64 encode/decode', null, {});

// 14. hash
await testTool('hash', 'Compute SHA-256 hash', hashTool, {
  text: 'Fricless test message',
  algorithm: 'sha256',
});

// 15. uuid_gen
await testTool('uuid_gen', 'Generate UUID', uuidGenTool, {
  count: 1,
});

// 16. timestamp (covered by datetime)
await testTool('datetime', 'Get current time / timestamp', dateTimeTool, {
  timezone: 'Asia/Shanghai',
  format: 'iso',
});

// ── Security (2) ────────────────────────────────────────

// 17. password_gen — does NOT exist
await testTool('password_gen', 'Generate secure password', null, {});

// 18. regex_test — does NOT exist
await testTool('regex_test', 'Test regex pattern', null, {});

// ── Conversion (4) ──────────────────────────────────────

// 19. unit_convert — does NOT exist
await testTool('unit_convert', 'Unit conversion (length/temp/weight)', null, {});

// 20. color_tool — does NOT exist
await testTool('color_tool', 'Color format conversion (hex/rgb/hsl)', null, {});

// 21. diff_tool — does NOT exist
await testTool('diff_tool', 'Text diff and comparison', null, {});

// 22. translate
await testTool('translate', 'Translate text (basic dict)', translateTool, {
  text: 'hello',
  targetLanguage: 'zh',
});

// ── Task Management (6) ─────────────────────────────────

// Reset task store first
TaskStore.tasks.clear();

// 23. task_create
await testTool('task_create', 'Create a subtask', taskCreateTool, {
  id: 'test-task-001',
  name: 'Test Task',
  description: 'A test task for capability verification',
});

// 24. task_get
await testTool('task_get', 'Get task details', taskGetTool, {
  id: 'test-task-001',
});

// 25. task_list
await testTool('task_list', 'List all tasks', taskListTool, {});

// 26. task_update
await testTool('task_update', 'Update task status', taskUpdateTool, {
  id: 'test-task-001',
  status: 'completed',
  output: 'Task completed successfully',
});

// 27. task_stop
// Create a second task to stop
TaskStore.addTask('stop-me-task', { name: 'Stoppable Task', description: 'This task will be stopped' });
await testTool('task_stop', 'Stop a running task', taskStopTool, {
  id: 'stop-me-task',
});

// 28. task_output
await testTool('task_output', 'Get task output', taskOutputTool, {
  id: 'test-task-001',
});

// ── Utilities (4) ───────────────────────────────────────

// 29. calculator
await testTool('calculator', 'Evaluate math expression', calculatorTool, {
  expression: '2 + 3 * 4',
});

// 30. sleep
await testTool('sleep', 'Wait N seconds', sleepTool, {
  seconds: 1,
});

// 31. echo
await testTool('echo', 'Echo back input', echoTool, {
  message: 'Hello Fricless!',
});

// 32. todo
await testTool('todo', 'Manage todo list', todoTool, {
  action: 'add',
  text: 'Test todo item',
});

// ── Cleanup ──────────────────────────────────────────────

try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

// ── Write Log File ───────────────────────────────────────

const summary = results.join('\n');
fs.writeFileSync(LOG_FILE, summary, 'utf-8');
console.log(`Report written to: ${LOG_FILE}`);
console.log(`Total tests: ${testIndex}`);
