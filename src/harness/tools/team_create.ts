import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Team Create Tool — 创建团队会话
 *
 * 邀请其他用户加入协作会话。
 * 当前为单用户模式，团队功能不可用。
 */
export const teamCreateTool = defineTool({
  name: 'team_create',
  description: '创建团队会话。邀请其他用户加入协作。',
  inputSchema: z.object({
    name: z.string().describe('团队会话名称'),
    members: z
      .array(z.string())
      .optional()
      .describe('团队成员列表（用户 ID 或邮箱）'),
  }),
  isReadOnly: false,
  searchHint: 'team collaborate share session',
  async call(_input) {
    return {
      data: 'Team features not available in single-user mode',
    };
  },
});
