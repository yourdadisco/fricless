/**
 * Schedule Cron Tool — 定时任务
 *
 * 创建基于 cron 表达式的定时任务。
 * 需要 fricless gateway 执行已调度的任务。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const scheduleCronTool = defineTool({
  name: 'schedule_cron',
  description: '创建定时任务。使用 cron 表达式设定任务的执行时间。',
  inputSchema: z.object({
    name: z.string().describe('任务名称'),
    cron: z.string().describe('cron 表达式（5字段，如 "0 9 * * *" 表示每天9点）'),
    task: z.string().describe('要执行的任务描述'),
  }),
  isReadOnly: false,
  permissionLevel: 'confirm',
  searchHint: 'cron schedule timer periodic recurring',
  async call(input) {
    const { name, cron, task } = input as { name: string; cron: string; task: string };
    return {
      data: `Scheduled task "${name}": ${cron} → ${task}\nNote: Run fricless gateway to execute scheduled tasks.`,
    };
  },
});
