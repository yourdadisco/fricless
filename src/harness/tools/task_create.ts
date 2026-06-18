/**
 * TaskCreate Tool — 创建子任务
 *
 * 在共享任务存储中创建一个新的子任务。
 * 需要用户确认（confirm 级别）。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';
import { TaskStore } from './task_store.js';

export const taskCreateTool = defineTool({
  name: 'task_create',
  description: '创建一个新的子任务，返回任务 ID。需要用户确认。',
  searchHint: 'create task subtask child new task 创建任务 子任务',
  inputSchema: z.object({
    id: z.string().min(1).describe('任务唯一标识符'),
    name: z.string().optional().describe('任务名称'),
    description: z.string().optional().describe('任务描述'),
  }),
  isReadOnly: false,
  isDestructive: false,
  permissionLevel: 'confirm',
  async call(input) {
    const { id, name, description } = input as {
      id: string;
      name?: string;
      description?: string;
    };

    if (TaskStore.getTask(id)) {
      return {
        data: `任务已存在: ${id}`,
        isError: true,
      };
    }

    TaskStore.addTask(id, { name, description });
    return {
      data: `任务已创建: ${id}`,
    };
  },
});
