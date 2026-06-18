/**
 * TaskList Tool — 列出所有活跃任务
 *
 * 从共享存储中返回所有任务列表。
 * 支持按状态过滤。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { TaskStore } from './task_store.js';

export const taskListTool = defineTool({
  name: 'task_list',
  description: '列出所有活跃任务。可选参数 status 可按状态过滤。',
  searchHint: 'list tasks all running stopped 列出任务 列表',
  inputSchema: z.object({
    status: z
      .string()
      .optional()
      .describe('按状态过滤: running, stopped（不传则返回全部）'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  permissionLevel: 'auto',
  async call(input) {
    const { status } = input as { status?: string };
    let tasks = TaskStore.listTasks();
    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }
    if (tasks.length === 0) {
      return { data: '暂无任务。' };
    }
    const lines = tasks.map(
      (t) => `- ${t.id} [${t.status}] ${t.name || '(无名称)'}`,
    );
    return { data: lines.join('\n') };
  },
});
