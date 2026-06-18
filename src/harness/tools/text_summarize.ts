/**
 * Text Summarize Tool — 文本摘要
 *
 * 使用简单的抽取式摘要方法（首句提取）对文本进行摘要。
 * 当文本较短时直接返回原文，当文本较长时提取关键句子。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * 简单的抽取式摘要：提取文本中的关键句子
 *
 * 策略:
 * 1. 如果文本不超过 maxLength，直接返回
 * 2. 按句子分割
 * 3. 优先保留开头和结尾的句子，中间部分按需选取
 */
function extractiveSummarize(text: string, maxLength: number): string {
  const cleaned = text.trim();
  if (!cleaned) return '';

  // 如果文本已经足够短，直接返回
  if (cleaned.length <= maxLength) return cleaned;

  // 按中文句号、英文句号、感叹号、问号、换行分割
  const sentences = cleaned
    .split(/(?<=[。！？.!?\n])/g)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length <= 3) {
    // 句子很少，截取前 maxLength 字符
    return cleaned.substring(0, maxLength) + '...';
  }

  // 始终包含第一句（主题句）
  const result: string[] = [sentences[0]];
  let currentLength = sentences[0].length;

  // 如果还有空间，添加最后一句
  if (currentLength + sentences[sentences.length - 1].length <= maxLength) {
    result.push(sentences[sentences.length - 1]);
    currentLength += sentences[sentences.length - 1].length;
  }

  // 中间句子按比例选取
  if (currentLength < maxLength) {
    const remaining = maxLength - currentLength;
    const middleSentences = sentences.slice(1, -1);
    const budgetPerSentence = remaining / middleSentences.length;

    for (const sentence of middleSentences) {
      if (currentLength + sentence.length > maxLength) break;
      const score = sentence.length;
      if (score <= budgetPerSentence * 1.5) {
        result.push(sentence);
        currentLength += sentence.length;
      }
    }
  }

  return result.join('') + (currentLength < cleaned.length ? '...' : '');
}

export const textSummarizeTool = defineTool({
  name: 'text_summarize',
  description: '对文本进行摘要总结，返回关键信息',
  searchHint: '文本摘要 总结 summarize TL;DR 提炼 精简',
  inputSchema: z.object({
    text: z.string().min(1).describe('需要摘要的文本内容'),
    maxLength: z
      .number()
      .int()
      .positive()
      .optional()
      .default(500)
      .describe('摘要最大字符数，默认 500'),
  }),
  isReadOnly: true,
  async call(input) {
    const { text, maxLength = 500 } = input as { text: string; maxLength?: number };

    try {
      const summary = extractiveSummarize(text, maxLength);
      const originalLength = text.length;

      return {
        data: [
          `📝 **摘要**:`,
          summary,
          '',
          `---`,
          `原文长度: ${originalLength} 字符 | 摘要长度: ${summary.length} 字符 | 压缩比: ${Math.round((summary.length / originalLength) * 100)}%`,
        ].join('\n'),
      };
    } catch (err) {
      return {
        data: `摘要生成失败: ${err instanceof Error ? err.message : '未知错误'}`,
        isError: true,
      };
    }
  },
});
