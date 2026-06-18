/**
 * TaskStop Tool — 停止任务
 *
 * 将共享存储中指定的任务状态标记为 stopped。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { TaskStore } from './task_store.js';

export const taskStopTool = defineTool({
  name: 'task_stop',
  description: '停止一个正在运行的任务（标记为 stopped）。',
  searchHint: 'stop task cancel terminate kill 停止任务 终止',
  inputSchema: z.object({
    id: z.string().min(1).describe('要停止的任务 ID'),
  }),
  isReadOnly: false,
  isDestructive: false,
  permissionLevel: 'auto',
  async call(input) {
    const { id } = input as { id: string };

    const task = TaskStore.getTask(id);
    if (!task) {
      return {
        data: `任务未找到: ${id}`,
        isError: true,
      };
    }

    TaskStore.stopTask(id);
    return { data: `任务已停止: ${id}` };
  },
});
