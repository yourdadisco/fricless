/**
 * DateTime Tool — 增强版日期时间工具
 *
 * 比基础 time 工具提供更多格式选项：
 *   - full: 完整日期时间（默认）
 *   - date: 仅日期
 *   - time: 仅时间
 *   - iso: ISO 8601 格式
 *
 * 支持自定义时区，默认使用 Asia/Shanghai。
 */

import { z } from 'zod';
import { defineTool } from '../Tool.js';

/** 格式化选项 */
type FormatOption = 'full' | 'date' | 'time' | 'iso';

/**
 * 格式化日期时间
 */
function formatDateTime(now: Date, timezone: string, format: FormatOption): string {
  try {
    switch (format) {
      case 'iso':
        return now.toISOString();

      case 'date': {
        const formatter = new Intl.DateTimeFormat('zh-CN', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        return formatter.format(now);
      }

      case 'time': {
        const formatter = new Intl.DateTimeFormat('zh-CN', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        return formatter.format(now);
      }

      case 'full':
      default: {
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
        return formatter.format(now);
      }
    }
  } catch {
    // 时区无效时的回退
    return now.toLocaleString('zh-CN');
  }
}

export const dateTimeTool = defineTool({
  name: 'datetime',
  description: '获取当前日期和时间信息，支持多种格式和时区',
  searchHint: '时间 日期 时区 time date timezone datetime 当前时间',
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .default('Asia/Shanghai')
      .describe('时区，例如 Asia/Shanghai、America/New_York、Europe/London、Asia/Tokyo'),
    format: z
      .enum(['full', 'date', 'time', 'iso'])
      .optional()
      .default('full')
      .describe('输出格式: full(完整), date(仅日期), time(仅时间), iso(ISO 8601)'),
  }),
  isReadOnly: true,
  async call(input) {
    const { timezone = 'Asia/Shanghai', format = 'full' } = input as {
      timezone?: string;
      format?: FormatOption;
    };

    try {
      const now = new Date();
      const formatted = formatDateTime(now, timezone, format);
      const iso = now.toISOString();
      const unix = Math.floor(now.getTime() / 1000);
      const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];

      // 获取 UTC 偏移
      let utcOffset = '';
      try {
        const offsetMinutes = -now.getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const absMin = Math.abs(offsetMinutes);
        const hours = Math.floor(absMin / 60);
        const mins = absMin % 60;
        utcOffset = `UTC${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      } catch {
        utcOffset = 'UTC?';
      }

      const formatLabels: Record<FormatOption, string> = {
        full: '完整日期时间',
        date: '日期',
        time: '时间',
        iso: 'ISO 8601',
      };

      const lines = [
        `🕐 **当前时间信息**`,
        '---',
        `${formatLabels[format]}: ${formatted}`,
        `星期${weekday}`,
        `时区: ${timezone} (${utcOffset})`,
        `ISO 8601: ${iso}`,
        `Unix 时间戳: ${unix}`,
      ];

      return {
        data: lines.join('\n'),
      };
    } catch (err) {
      return {
        data: `获取时间失败: ${err instanceof Error ? err.message : '未知错误'}`,
        isError: true,
      };
    }
  },
});
