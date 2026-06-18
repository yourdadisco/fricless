/**
 * TaskOutput Tool — 获取任务输出
 *
 * 返回共享存储中指定任务的输出内容。
 * 用于获取子任务的执行结果。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { TaskStore } from './task_store.js';

export const taskOutputTool = defineTool({
  name: 'task_output',
  description: '获取指定任务的输出内容。用于获取子任务的执行结果。',
  searchHint: 'get task output result log 获取任务 输出 结果',
  inputSchema: z.object({
    id: z.string().min(1).describe('任务 ID'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
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

    const output = task.output || '(无输出)';
    return { data: output };
  },
});
