/**
 * Review Artifact Tool — 审查代码或文档
 *
 * 对代码或文档内容进行审查，提供改进建议、问题检测和优化方案。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

export const reviewArtifactTool = defineTool({
  name: 'review_artifact',
  description: '审查代码或文档内容。提供改进建议、问题检测和优化方案。',
  inputSchema: z.object({
    content: z.string().describe('要审查的代码或文档内容'),
    type: z.enum(['code', 'document', 'config']).optional().describe('内容类型'),
  }),
  isReadOnly: true,
  searchHint: 'review code audit inspect check quality',
  async call(input) {
    const { content } = input as { content: string };
    const lines = content.split('\n').length;
    const charCount = content.length;
    return {
      data: `📝 Review Summary:\n- Lines: ${lines}\n- Characters: ${charCount}\n- Status: Content received, analysis provided in AI response.`,
    };
  },
});
