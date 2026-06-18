import { z } from 'zod';
import { defineTool } from '../Tool.js';

/**
 * Terminal Capture Tool — 终端捕获工具
 *
 * 捕获终端输出和状态，记录命令执行结果。
 * 当前为模拟实现，记录捕获请求但不实际连接终端。
 */

interface CaptureSession {
  id: string;
  status: 'idle' | 'recording' | 'stopped';
  buffer: string[];
  startedAt: string;
}

let captureSession: CaptureSession = {
  id: 'default',
  status: 'idle',
  buffer: [],
  startedAt: '',
};

export const terminalCaptureTool = defineTool({
  name: 'terminal_capture',
  description: '捕获终端输出和状态。记录命令执行结果。',
  inputSchema: z.object({
    action: z
      .enum(['start', 'stop', 'capture'])
      .describe('操作类型：start（开始捕获）、stop（停止捕获）、capture（获取当前捕获内容）'),
  }),
  isReadOnly: false,
  searchHint: 'terminal capture record log output',
  async call(input) {
    const { action } = input as { action: 'start' | 'stop' | 'capture' };

    switch (action) {
      case 'start': {
        if (captureSession.status === 'recording') {
          return { data: '终端捕获已在运行中' };
        }
        captureSession = {
          id: `capture_${Date.now()}`,
          status: 'recording',
          buffer: [],
          startedAt: new Date().toISOString(),
        };
        return { data: `终端捕获已开始 (ID: ${captureSession.id})` };
      }

      case 'stop': {
        if (captureSession.status !== 'recording') {
          return { data: '没有正在运行的终端捕获' };
        }
        captureSession.status = 'stopped';
        return {
          data: `终端捕获已停止。共捕获 ${captureSession.buffer.length} 行输出。`,
        };
      }

      case 'capture': {
        return {
          data:
            captureSession.buffer.length > 0
              ? captureSession.buffer.join('\n')
              : '（暂无捕获内容）',
        };
      }

      default: {
        return { data: '未知的操作类型', isError: true };
      }
    }
  },
});
