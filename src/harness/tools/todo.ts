import { z } from 'zod';
import { defineTool } from '../Tool.js';

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

const todos: TodoItem[] = [];
let nextId = 1;

export const todoTool = defineTool({
  name: 'todo',
  description: '管理待办事项。可以添加、完成、列出、删除待办项。',
  inputSchema: z.object({
    action: z.enum(['add', 'done', 'list', 'clear']).describe('操作类型'),
    text: z.string().optional().describe('待办内容（add时必填）'),
    id: z.number().optional().describe('待办ID（done/delete时必填）'),
  }),
  isReadOnly: false,
  searchHint: 'todo task reminder checklist',
  async call(input, ctx) {
    const { action, text, id } = input as {
      action: string;
      text?: string;
      id?: number;
    };
    switch (action) {
      case 'add': {
        if (!text) return { data: 'Text required', isError: true };
        todos.push({ id: String(nextId++), text, done: false, createdAt: Date.now() });
        return { data: `✅ Added todo: ${text}` };
      }
      case 'done': {
        const item = todos.find(t => t.id === String(id));
        if (!item) return { data: `Todo #${id} not found`, isError: true };
        item.done = true;
        return { data: `✅ Completed: ${item.text}` };
      }
      case 'list': {
        if (todos.length === 0) return { data: 'No todos.' };
        return {
          data: todos
            .map(t => `${t.done ? '✅' : '⬜'} #${t.id} ${t.text}`)
            .join('\n'),
        };
      }
      case 'clear': {
        todos.length = 0;
        return { data: 'All todos cleared.' };
      }
      default:
        return { data: 'Unknown action', isError: true };
    }
  },
});
