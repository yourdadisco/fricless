import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Gateway } from '../Gateway.js';
import { MockChannel } from '../../__tests__/mocks/MockChannel.js';
import { MockProvider } from '../../__tests__/mocks/MockProvider.js';
import type { CommandDef } from '../../harness/Command.js';

function makeGateway() {
  const pingCommandDef: CommandDef = {
    name: 'ping',
    description: 'Health check',
    execute: async (_args, ctx) => {
      await ctx.sendMessage('pong');
    },
  };

  const gateway = new Gateway({
    tools: [],
    commands: [pingCommandDef],
    providerFactory: () => new MockProvider(),
  });

  return gateway;
}

describe('Gateway', () => {
  let gateway: Gateway;
  let channel1: MockChannel;
  let channel2: MockChannel;

  beforeEach(() => {
    vi.useFakeTimers();
    gateway = makeGateway();
    channel1 = new MockChannel();
    channel2 = new MockChannel();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registerChannel', () => {
    it('binds onMessage handler so simulateMessage routes correctly', async () => {
      gateway.registerChannel(channel1);

      // Simulate a message through the channel -- it should route through
      // the handler without throwing, and a pong response should be sent back.
      await channel1.simulateMessage({
        userId: 'user1',
        chatId: 'chat1',
        text: '/ping',
        messageId: 'msg1',
        isMention: true,
        raw: {},
      });

      expect(channel1.sentMessages.length).toBeGreaterThan(0);
    });
  });

  describe('start', () => {
    it('connects registered channels and sets isRunning=true', async () => {
      gateway.registerChannel(channel1);
      gateway.registerChannel(channel2);

      expect(gateway.isRunning).toBe(false);

      await gateway.start();

      expect(gateway.isRunning).toBe(true);
      expect(channel1.status).toBe('connected');
      expect(channel2.status).toBe('connected');
    });

    it('works with zero registered channels', async () => {
      await gateway.start();
      expect(gateway.isRunning).toBe(true);
    });
  });

  describe('stop', () => {
    it('disconnects channels and sets isRunning=false', async () => {
      gateway.registerChannel(channel1);
      gateway.registerChannel(channel2);
      await gateway.start();

      expect(gateway.isRunning).toBe(true);
      expect(channel1.status).toBe('connected');
      expect(channel2.status).toBe('connected');

      await gateway.stop();

      expect(gateway.isRunning).toBe(false);
      expect(channel1.status).toBe('disconnected');
      expect(channel2.status).toBe('disconnected');
    });

    it('is safe to call when not started', async () => {
      gateway.registerChannel(channel1);
      await gateway.stop();
      expect(gateway.isRunning).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('sends messages to all registered channels', async () => {
      gateway.registerChannel(channel1);
      gateway.registerChannel(channel2);

      // Trigger a broadcast by routing a /ping command via channel1
      await channel1.simulateMessage({
        userId: 'user1',
        chatId: 'chat1',
        text: '/ping',
        messageId: 'msg1',
        isMention: true,
        raw: {},
      });

      // Both channels should have received the pong response
      expect(channel1.sentMessages.length).toBe(1);
      expect(channel1.sentMessages[0].content).toBe('pong');

      expect(channel2.sentMessages.length).toBe(1);
      expect(channel2.sentMessages[0].content).toBe('pong');
    });

    it('sends to each channel independently — one failure does not block others', async () => {
      const brokenChannel = new MockChannel();
      // Override send on brokenChannel to throw
      brokenChannel.send = vi.fn().mockRejectedValue(new Error('network error'));

      gateway.registerChannel(brokenChannel);
      gateway.registerChannel(channel1);

      await channel1.simulateMessage({
        userId: 'user1',
        chatId: 'chat1',
        text: '/ping',
        messageId: 'msg1',
        isMention: true,
        raw: {},
      });

      // brokenChannel still had send called (even though it rejected)
      expect(brokenChannel.send).toHaveBeenCalled();
      // channel1 still got the message
      expect(channel1.sentMessages.length).toBe(1);
    });
  });

  describe('activeSessions', () => {
    it('returns active session count after routing messages', async () => {
      gateway.registerChannel(channel1);
      expect(gateway.activeSessions).toBe(0);

      await channel1.simulateMessage({
        userId: 'user1',
        chatId: 'chat1',
        text: '/ping',
        messageId: 'msg1',
        isMention: true,
        raw: {},
      });

      expect(gateway.activeSessions).toBe(1);
    });
  });
});
