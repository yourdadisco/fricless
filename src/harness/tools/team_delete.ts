import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Team Delete Tool — 删除团队会话
 *
 * 删除已有的团队会话。
 * 当前为单用户模式，团队功能不可用。
 */
export const teamDeleteTool = defineTool({
  name: 'team_delete',
  description: '删除团队会话。',
  inputSchema: z.object({
    name: z.string().describe('要删除的团队会话名称'),
  }),
  isReadOnly: true,
  searchHint: 'team delete remove collaborate',
  async call(_input) {
    return {
      data: 'Team features not available',
    };
  },
});
