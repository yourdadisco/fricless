import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Remote Trigger Tool — 远程触发工具
 *
 * 发送信号到外部系统执行任务。
 * 当前为模拟实现，记录触发请求但不实际发送。
 */
export const remoteTriggerTool = defineTool({
  name: 'remote_trigger',
  description: '触发远程操作。发送信号到外部系统执行任务。',
  inputSchema: z.object({
    target: z.string().describe('远程目标标识，如 webhook URL 或服务名称'),
    payload: z.string().optional().describe('可选的 JSON 载荷，发送给远程系统的数据'),
  }),
  isReadOnly: false,
  searchHint: 'remote trigger signal webhook',
  async call(input) {
    const { target, payload } = input as { target: string; payload?: string };

    // 模拟验证 target 格式
    if (!target || target.trim().length === 0) {
      return { data: 'target 参数不能为空', isError: true };
    }

    const logEntry = payload
      ? `Remote trigger sent to ${target}\nPayload: ${payload}`
      : `Remote trigger sent to ${target}`;

    return { data: logEntry };
  },
});
