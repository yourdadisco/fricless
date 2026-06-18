/**
 * TaskUpdate Tool — 更新任务状态/属性
 *
 * 更新共享存储中指定任务的属性（如状态、输出等）。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { TaskStore } from './task_store.js';

export const taskUpdateTool = defineTool({
  name: 'task_update',
  description: '更新指定任务的属性（状态、输出等）。',
  searchHint: 'update task modify status output progress 更新任务 状态',
  inputSchema: z.object({
    id: z.string().min(1).describe('任务 ID'),
    status: z.string().optional().describe('新状态: running, completed, stopped, pending'),
    output: z.string().optional().describe('任务输出内容'),
  }),
  isReadOnly: false,
  isDestructive: false,
  permissionLevel: 'auto',
  async call(input) {
    const { id, status, output } = input as {
      id: string;
      status?: string;
      output?: string;
    };

    const task = TaskStore.getTask(id);
    if (!task) {
      return {
        data: `任务未找到: ${id}`,
        isError: true,
      };
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (output !== undefined) updates.output = output;

    if (Object.keys(updates).length === 0) {
      return { data: '未提供要更新的字段。' };
    }

    TaskStore.updateTask(id, updates);
    return { data: `任务已更新: ${id}` };
  },
});
