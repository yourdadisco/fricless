/**
 * Send User File Tool — 向用户发送文件
 *
 * 终端模式下保存到本地，飞书模式下发送文件消息。
 * 破坏性操作，需要用户确认。
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const sendUserFileTool = defineTool({
  name: 'send_user_file',
  description: '向用户发送文件。终端模式下保存到本地，飞书模式下发送文件消息。',
  inputSchema: z.object({
    filename: z.string().describe('文件名'),
    content: z.string().describe('文件内容'),
    type: z.enum(['text', 'json', 'csv', 'html', 'markdown']).optional().describe('文件类型'),
  }),
  isReadOnly: false,
  permissionLevel: 'confirm',
  searchHint: 'send file export download share',
  async call(input) {
    const { filename, content } = input as { filename: string; content: string };
    try {
      const filepath = resolve(filename);
      writeFileSync(filepath, content, 'utf-8');
      return { data: `File saved: ${filepath}\nSize: ${content.length} bytes` };
    } catch (e: any) {
      return { data: `Failed to save file: ${e.message}`, isError: true };
    }
  },
});
