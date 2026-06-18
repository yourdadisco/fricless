import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineTool, defineToolWithSchema } from '../Tool.js';

describe('defineTool', () => {
  it('creates a BuiltTool with correct defaults (isReadOnly=false, isEnabled=()=>true, permissionLevel=auto)', () => {
    const tool = defineTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: z.object({ foo: z.string() }),
      async call(input) {
        return { data: `hello ${input.foo}` };
      },
    });

    expect(tool.name).toBe('test_tool');
    expect(tool.description).toBe('A test tool');
    expect(tool.isReadOnly).toBe(false);
    expect(tool.isEnabled()).toBe(true);
    expect(tool.permissionLevel).toBe('auto');
  });

  it('respects explicit isReadOnly, isEnabled, and permissionLevel', () => {
    const tool = defineTool({
      name: 'write_tool',
      description: 'A writable tool',
      inputSchema: z.object({ value: z.string() }),
      isReadOnly: false,
      isEnabled: () => false,
      permissionLevel: 'confirm',
      async call(input) {
        return { data: `wrote ${input.value}` };
      },
    });

    expect(tool.isReadOnly).toBe(false);
    expect(tool.isEnabled()).toBe(false);
    expect(tool.permissionLevel).toBe('confirm');
  });

  it('generates jsonSchema from Zod schema via zod-to-json-schema', () => {
    const tool = defineTool({
      name: 'schema_tool',
      description: 'Schema test tool',
      inputSchema: z.object({
        name: z.string().describe('The name'),
        count: z.number().optional(),
      }),
      async call(input) {
        return { data: `${input.name}: ${input.count}` };
      },
    });

    expect(tool.jsonSchema).toBeDefined();
    expect(tool.jsonSchema.type).toBe('object');
    expect(tool.jsonSchema.properties).toBeDefined();
    expect(tool.jsonSchema.properties).toHaveProperty('name');
    expect(tool.jsonSchema.properties).toHaveProperty('count');
    expect(tool.jsonSchema.description).toBe('Schema test tool');
  });

  it('generated jsonSchema includes description from Zod schema description when present', () => {
    const tool = defineTool({
      name: 'described_tool',
      description: 'Schema test tool',
      inputSchema: z.object({
        query: z.string().describe('搜索关键词'),
      }).describe('自定义描述'),
      async call(input) {
        return { data: input.query };
      },
    });

    // The schema description should take precedence over tool description
    expect(tool.jsonSchema.description).toBe('自定义描述');
  });

  it('preserves the call function and input type', async () => {
    const tool = defineTool({
      name: 'greeter',
      description: 'Greets the user',
      inputSchema: z.object({ name: z.string() }),
      async call(input) {
        return { data: `Hello, ${input.name}!` };
      },
    });

    const result = await tool.call({ name: 'World' }, {
      sessionId: 's1',
      userId: 'u1',
      sendMessage: async () => {},
    });

    expect(result).toEqual({ data: 'Hello, World!' });
  });

  it('allows isError in result', async () => {
    const tool = defineTool({
      name: 'error_tool',
      description: 'May fail',
      inputSchema: z.object({}),
      async call() {
        return { data: 'Something broke', isError: true };
      },
    });

    const result = await tool.call({}, {
      sessionId: 's1',
      userId: 'u1',
      sendMessage: async () => {},
    });

    expect(result.isError).toBe(true);
    expect(result.data).toBe('Something broke');
  });
});

describe('defineToolWithSchema', () => {
  it('preserves manually provided jsonSchema', () => {
    const manualSchema = {
      type: 'object',
      properties: {
        expr: { type: 'string', description: 'Math expression' },
      },
      required: ['expr'],
    };

    const tool = defineToolWithSchema({
      name: 'manual_tool',
      description: 'Tool with manual schema',
      inputSchema: z.object({ expr: z.string() }),
      jsonSchema: manualSchema,
      async call(input) {
        return { data: `result: ${input.expr}` };
      },
    });

    // Must be the exact same object reference
    expect(tool.jsonSchema).toBe(manualSchema);
    expect((tool.jsonSchema.properties as Record<string, unknown>).expr).toEqual({ type: 'string', description: 'Math expression' });
    expect(tool.jsonSchema.required).toEqual(['expr']);
  });

  it('applies default values like defineTool', () => {
    const tool = defineToolWithSchema({
      name: 'defaults_tool',
      description: 'Defaults test',
      inputSchema: z.object({ x: z.number() }),
      jsonSchema: { type: 'object' },
      async call(input) {
        return { data: `${input.x}` };
      },
    });

    expect(tool.isReadOnly).toBe(false);
    expect(tool.isEnabled()).toBe(true);
    expect(tool.permissionLevel).toBe('auto');
  });

  it('respects explicit flags', () => {
    const tool = defineToolWithSchema({
      name: 'custom_tool',
      description: 'Custom',
      inputSchema: z.object({}),
      jsonSchema: { type: 'object' },
      isReadOnly: false,
      isEnabled: () => false,
      permissionLevel: 'deny',
      async call() {
        return { data: 'done' };
      },
    });

    expect(tool.isReadOnly).toBe(false);
    expect(tool.isEnabled()).toBe(false);
    expect(tool.permissionLevel).toBe('deny');
  });
});
