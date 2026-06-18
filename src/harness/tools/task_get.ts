/**
 * TaskGet Tool — 获取任务详情
 *
 * 根据任务 ID 从共享存储中检索子任务的详细信息。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { TaskStore } from './task_store.js';

export const taskGetTool = defineTool({
  name: 'task_get',
  description: '根据任务 ID 获取子任务的详细信息。',
  searchHint: 'get task details fetch retrieve by id 获取任务 详情',
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
    return { data: JSON.stringify(task, null, 2) };
  },
});
