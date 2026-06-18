import { z } from 'zod';
import { defineToolWithSchema } from '../Tool.js';

/**
 * 计算器 Tool
 *
 * 演示 Tool 系统的完整用法：
 * 1. Zod input schema + JSON Schema 导出
 * 2. 输入校验
 * 3. 执行逻辑
 * 4. 权限标记（只读）
 */
export const calculatorTool = defineToolWithSchema({
  name: 'calculator',
  description: '执行数学计算，支持四则运算、平方、平方根等。传入数学表达式，返回计算结果。',
  inputSchema: z.object({
    expression: z.string().describe('数学表达式，如 "2 + 3 * 4" 或 "sqrt(16)"'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式，如 "2 + 3 * 4" 或 "sqrt(16)"',
      },
    },
    required: ['expression'],
  },
  isReadOnly: true,
  isEnabled: () => true,
  async call(input) {
    const { expression } = input as { expression: string };

    try {
      // 安全执行数学表达式
      const result = safeEval(expression);
      return { data: `\`${expression} = ${result}\`` };
    } catch (err) {
      return {
        data: `表达式 "${expression}" 计算出错: ${err instanceof Error ? err.message : '未知错误'}`,
        isError: true,
      };
    }
  },
});

/**
 * 安全的数学表达式求值
 * 只允许数字、运算符、括号、数学函数
 */
function safeEval(expr: string): number {
  // 只允许安全的字符
  const sanitized = expr.replace(/\s+/g, '');

  if (!/^[\d+\-*/().,%^sqrt|eE]+$/.test(sanitized)) {
    throw new Error('表达式包含非法字符，只支持数字和 + - * / ( ) . %');
  }

  // 使用 Function 构造函数在沙盒中执行
  // 注意: 只用于数学计算，没有外部 API 访问
  const fn = new Function(
    'return ((sqrt) => ' + sanitized.replace(/sqrt/g, 'Math.sqrt').replace(/\^/g, '**') + ')()',
  );

  const result = fn();
  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('计算无有效结果');
  }
  return result;
}
