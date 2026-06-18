import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Time Tool — 获取当前日期和时间信息
 *
 * 支持自定义时区，默认使用 Asia/Shanghai。
 */
export const timeTool = defineTool({
  name: 'time',
  description: '获取当前日期和时间信息',
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .default('Asia/Shanghai')
      .describe('时区，例如 Asia/Shanghai、America/New_York、Europe/London'),
  }),
  isReadOnly: true,
  async call(input) {
    const { timezone = 'Asia/Shanghai' } = input as { timezone?: string };

    try {
      const now = new Date();

      // 尝试使用 Intl.DateTimeFormat 格式化
      let formatted: string;
      try {
        const formatter = new Intl.DateTimeFormat('zh-CN', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        formatted = formatter.format(now);
      } catch {
        // 时区无效时的回退
        formatted = now.toLocaleString('zh-CN');
      }

      const iso = now.toISOString();
      const unix = Math.floor(now.getTime() / 1000);
      const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

      return {
        data: [
          `当前时间 (${timezone}): ${formatted}`,
          `星期${weekday}`,
          `ISO 8601: ${iso}`,
          `Unix 时间戳: ${unix}`,
        ].join('\n'),
      };
    } catch (err) {
      return {
        data: `获取时间失败: ${err instanceof Error ? err.message : '未知错误'}`,
        isError: true,
      };
    }
  },
});
