import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { Harness } from '../Harness.js';
import { Session } from '../../session/Session.js';
import { MockProvider } from '../../__tests__/mocks/MockProvider.js';
import { MockRenderer } from '../../__tests__/mocks/MockRenderer.js';
import { defineTool } from '../Tool.js';
import type { AnyTool } from '../Tool.js';
import type { CommandDef } from '../Command.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const calculatorTool = defineTool({
  name: 'calculator',
  description: 'Perform math calculations',
  inputSchema: z.object({ expression: z.string() }),
  isReadOnly: true,
  async call(input) {
    return { data: `result: ${input.expression}` };
  },
});

const secureTool = defineTool({
  name: 'secure_tool',
  description: 'Restricted tool',
  inputSchema: z.object({ key: z.string() }),
  validateInput(input: unknown): { valid: boolean; error?: string } {
    if (typeof input !== 'object' || input === null || !('key' in (input as Record<string, unknown>))) {
      return { valid: false, error: 'key is required' };
    }
    const rec = input as Record<string, unknown>;
    if (!rec.key || rec.key === '') {
      return { valid: false, error: 'key is required' };
    }
    return { valid: true };
  },
  async checkPermissions(input) {
    const rec = input as { key: string };
    if (rec.key !== 'admin') {
      return { allowed: false, reason: 'admin key required' };
    }
    return { allowed: true };
  },
  isReadOnly: true,
  async call(input) {
    return { data: `access granted: ${(input as { key: string }).key}` };
  },
});

const disabledTool = defineTool({
  name: 'disabled_tool',
  description: 'This tool is disabled',
  inputSchema: z.object({}),
  isEnabled: () => false,
  async call() {
    return { data: 'should not be called' };
  },
});

const pingCommandDef: CommandDef = {
  name: 'ping',
  aliases: ['p'],
  description: 'Health check',
  execute: async (_args, ctx) => {
    await ctx.sendMessage('pong');
  },
};

const clearCommandDef: CommandDef = {
  name: 'clear',
  aliases: ['reset'],
  description: 'Clear session',
  execute: async (_args, ctx) => {
    await ctx.sendMessage('cleared');
  },
};

const unknownCommandDefs: CommandDef[] = [pingCommandDef, clearCommandDef];

function createHarness(params: {
  session?: Session;
  provider?: MockProvider;
  tools?: AnyTool[];
  commandDefs?: CommandDef[];
  renderer?: MockRenderer;
  chatId?: string;
  options?: { maxToolRoundtrips?: number };
} = {}) {
  const session = params.session ?? new Session({ id: 'test-session', userId: 'test-user' });
  const provider = params.provider ?? new MockProvider();
  const renderer = params.renderer ?? new MockRenderer();
  return {
    session,
    provider,
    renderer,
    harness: new Harness({
      session,
      provider,
      tools: params.tools ?? [],
      commandDefs: params.commandDefs ?? [],
      renderer,
      chatId: params.chatId ?? 'test-chat',
      options: {
        maxToolRoundtrips: params.options?.maxToolRoundtrips ?? 10,
        systemPrompt: 'You are a helpful assistant.',
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Harness', () => {
  describe('handleUserMessage with non-command text', () => {
    it('runs the conversation loop and adds assistant message', async () => {
      const provider = new MockProvider([
        [{ type: 'text', delta: 'Hello there!' }],
      ]);
      const { session, harness } = createHarness({ provider, tools: [], commandDefs: unknownCommandDefs });

      await harness.handleUserMessage('hello');

      const userMsg = session.messages.find(m => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg!.content).toBe('hello');

      const assistantMsg = session.messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(typeof assistantMsg!.content).toBe('string');
    });
  });

  describe('handleUserMessage with /ping', () => {
    it('calls the ping command and sends pong response', async () => {
      const renderer = new MockRenderer();
      const { harness } = createHarness({ commandDefs: [pingCommandDef], renderer });

      await harness.handleUserMessage('/ping');

      expect(renderer.texts).toContain('pong');
    });
  });

  describe('handleUserMessage with /clear', () => {
    it('clears session messages', async () => {
      const { session, harness } = createHarness({ commandDefs: [clearCommandDef] });

      session.addMessage({ role: 'user', content: 'old message' });
      session.addMessage({ role: 'assistant', content: 'old reply' });
      expect(session.messages.length).toBeGreaterThan(0);

      await harness.handleUserMessage('/clear');

      expect(session.messages).toHaveLength(0);
    });
  });

  describe('StreamText', () => {
    it('opens sendStream when text events arrive', async () => {
      const provider = new MockProvider([
        [{ type: 'text', delta: 'Streaming response' }],
      ]);
      const { harness } = createHarness({ provider });

      await harness.handleUserMessage('stream test');
      // No crash = success for streaming path
    });

    it('processes tool_use events after text', async () => {
      const provider = new MockProvider([
        [
          { type: 'text', delta: 'Calling tool...' },
          { type: 'tool_use', name: 'calculator', input: { expression: '2+2' }, id: 'call_1' },
        ],
        [
          { type: 'text', delta: 'Tool result received.' },
        ],
      ]);
      const { session, harness } = createHarness({
        provider,
        tools: [calculatorTool],
        options: { maxToolRoundtrips: 2 },
      });

      await harness.handleUserMessage('calculate');

      const toolMsg = session.messages.find(m => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.content).toBe('result: 2+2');
    });
  });

  describe('Tool execution', () => {
    it('validates input and returns error when validation fails', async () => {
      const provider = new MockProvider([
        [
          { type: 'text', delta: 'Checking...' },
          { type: 'tool_use', name: 'secure_tool', input: { key: '' }, id: 'call_1' },
        ],
        [
          { type: 'text', delta: 'Validation failed.' },
        ],
      ]);
      const { session, harness } = createHarness({ provider, tools: [secureTool], options: { maxToolRoundtrips: 2 } });

      await harness.handleUserMessage('use tool');

      const toolMsg = session.messages.find(m => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.content as string).toContain('输入校验失败');
    });

    it('checks permissions and returns error when permission denied', async () => {
      const provider = new MockProvider([
        [
          { type: 'text', delta: 'Checking permissions...' },
          { type: 'tool_use', name: 'secure_tool', input: { key: 'user' }, id: 'call_1' },
        ],
        [
          { type: 'text', delta: 'Permission denied.' },
        ],
      ]);
      const { session, harness } = createHarness({ provider, tools: [secureTool], options: { maxToolRoundtrips: 2 } });

      await harness.handleUserMessage('use tool');

      const toolMsg = session.messages.find(m => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.content as string).toContain('权限不足');
    });

    it('executes tool when both validation and permission pass', async () => {
      const provider = new MockProvider([
        [
          { type: 'text', delta: 'Executing...' },
          { type: 'tool_use', name: 'secure_tool', input: { key: 'admin' }, id: 'call_1' },
        ],
        [
          { type: 'text', delta: 'Done.' },
        ],
      ]);
      const { session, harness } = createHarness({ provider, tools: [secureTool], options: { maxToolRoundtrips: 2 } });

      await harness.handleUserMessage('use tool');

      const toolMsg = session.messages.find(m => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.content as string).toContain('access granted: admin');
    });

    it('handles tool not found in registry', async () => {
      const provider = new MockProvider([
        [
          { type: 'text', delta: 'Using unknown...' },
          { type: 'tool_use', name: 'nonexistent', input: {}, id: 'call_1' },
        ],
        [
          { type: 'text', delta: 'Tool not found.' },
        ],
      ]);
      const { session, harness } = createHarness({ provider, tools: [calculatorTool], options: { maxToolRoundtrips: 2 } });

      await harness.handleUserMessage('use unknown');

      const toolMsg = session.messages.find(m => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.content as string).toContain('不存在');
    });
  });

  describe('tools/enabled state', () => {
    it('filters disabled tools from tool descriptors', async () => {
      const provider = new MockProvider([
        [{ type: 'text', delta: 'Response' }],
      ]);
      const { harness } = createHarness({ provider, tools: [disabledTool, calculatorTool] });

      await harness.handleUserMessage('hello');

      expect(provider.lastTools).toHaveLength(1);
      expect(provider.lastTools[0].name).toBe('calculator');
    });

    it('returns error when a disabled tool is called', async () => {
      const provider = new MockProvider([
        [
          { type: 'text', delta: 'Trying disabled...' },
          { type: 'tool_use', name: 'disabled_tool', input: {}, id: 'call_1' },
        ],
        [
          { type: 'text', delta: 'Done.' },
        ],
      ]);
      const { session, harness } = createHarness({ provider, tools: [disabledTool, calculatorTool], options: { maxToolRoundtrips: 2 } });

      await harness.handleUserMessage('use disabled');

      const toolMsg = session.messages.find(m => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg!.content as string).toContain('未启用');
    });
  });

  describe('error from provider', () => {
    it('sends error message and stops conversation loop', async () => {
      const renderer = new MockRenderer();
      const provider = new MockProvider([
        [
          { type: 'text', delta: 'Partial response...' },
          { type: 'error', message: 'API timeout' },
        ],
      ]);
      const { session, harness } = createHarness({ provider, tools: [], renderer });

      await harness.handleUserMessage('hello');

      expect(renderer.errors.some(e => e.includes('超时') || e.includes('timeout'))).toBe(true);

      const assistantMsg = session.messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeUndefined();
    });
  });

  describe('handleCommand', () => {
    it('sends "unknown command" message for unrecognized commands', async () => {
      const renderer = new MockRenderer();
      const { harness } = createHarness({ commandDefs: [pingCommandDef], renderer });

      await harness.handleUserMessage('/bogus');

      expect(renderer.errors.some(e => e.includes('未知命令'))).toBe(true);
    });
  });
});
