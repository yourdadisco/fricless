/**
 * Translate Tool — 文本翻译
 *
 * 使用基本的翻译逻辑进行文本翻译。
 * 注意：这是一个基础的实现，生产环境建议接入专业的翻译 API（如 DeepL、Google Translate）。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

// 简单的语言代码到中文名称映射
const LANGUAGE_NAMES: Record<string, string> = {
  zh: '中文',
  en: '英语',
  ja: '日语',
  ko: '韩语',
  fr: '法语',
  de: '德语',
  es: '西班牙语',
  pt: '葡萄牙语',
  ru: '俄语',
  ar: '阿拉伯语',
  it: '意大利语',
  nl: '荷兰语',
  th: '泰语',
  vi: '越南语',
};

// 基础词汇表（仅用于演示基本翻译概念）
const BASIC_VOCAB: Record<string, Record<string, string>> = {
  zh: {
    hello: '你好',
    world: '世界',
    thank: '谢谢',
    good: '好',
    bad: '坏',
    yes: '是',
    no: '不',
    please: '请',
    sorry: '对不起',
    help: '帮助',
    'how are you': '你好吗',
    'thank you': '谢谢你',
  },
  en: {
    '你好': 'hello',
    '世界': 'world',
    '谢谢': 'thank you',
    '好': 'good',
    '坏': 'bad',
    '是': 'yes',
    '不': 'no',
    '请': 'please',
    '对不起': 'sorry',
    '帮助': 'help',
    '你好吗': 'how are you',
    '谢谢你': 'thank you',
  },
};

/**
 * 简单字典翻译（仅覆盖基础词汇）
 * 对于超出词汇表的文本，返回提示信息
 */
function dictionaryTranslate(text: string, targetLang: string): string {
  const dict = BASIC_VOCAB[targetLang];
  if (!dict) return '';

  const lowerText = text.toLowerCase().trim();
  if (dict[lowerText]) return dict[lowerText];

  // 尝试逐词翻译
  const words = lowerText.split(/\s+/);
  const translated = words.map(w => dict[w] || `[${w}]`);
  return translated.join(' ');
}

export const translateTool = defineTool({
  name: 'translate',
  description: '将文本翻译为目标语言（基础实现，覆盖常见短语）',
  searchHint: '翻译 语言 translate language 中英 多语言',
  inputSchema: z.object({
    text: z.string().min(1).describe('需要翻译的文本'),
    targetLanguage: z
      .string()
      .min(2)
      .max(10)
      .describe('目标语言代码，例如: zh, en, ja, ko, fr, de, es, ru'),
  }),
  isReadOnly: true,
  async call(input) {
    const { text, targetLanguage } = input as { text: string; targetLanguage: string };

    try {
      const langName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;
      const translated = dictionaryTranslate(text, targetLanguage);

      if (translated && !translated.includes('[UNKNOWN]')) {
        return {
          data: [
            `🌐 **翻译结果** (${langName})`,
            '',
            `原文: ${text}`,
            `译文: ${translated}`,
            '',
            `> 注意: 这是基础词典翻译，仅支持常用短语。`,
            `> 如需高质量翻译，请集成专业翻译 API。`,
          ].join('\n'),
        };
      }

      // 如果词典翻译无法处理，返回说明
      return {
        data: [
          `🌐 **翻译请求** (${langName})`,
          '',
          `原文: ${text}`,
          `译文: [基础词典暂未收录 "${text}" 的 "${targetLanguage}" 翻译]`,
          '',
          `> 支持的语言: ${Object.entries(LANGUAGE_NAMES).map(([code, name]) => `${code}(${name})`).join(', ')}`,
          `> 提示: 集成专业翻译 API 后可实现全量翻译。`,
        ].join('\n'),
        isError: false,
      };
    } catch (err) {
      return {
        data: `翻译失败: ${err instanceof Error ? err.message : '未知错误'}`,
        isError: true,
      };
    }
  },
});
