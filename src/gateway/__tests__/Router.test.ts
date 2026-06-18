import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router } from '../Router.js';
import { MockSessionStore } from '../../__tests__/mocks/MockSessionStore.js';
import { MockProvider } from '../../__tests__/mocks/MockProvider.js';
import { MockRenderer } from '../../__tests__/mocks/MockRenderer.js';
import type { CommandDef } from '../../harness/Command.js';
import type { InboundMessage } from '../../channels/types.js';

function makeRouter(store?: MockSessionStore) {
  const pingCommandDef: CommandDef = {
    name: 'ping',
    description: 'Health check',
    execute: async (_args, ctx) => {
      await ctx.sendMessage('pong');
    },
  };

  const sessionStore = store ?? new MockSessionStore();

  const router = new Router({
    sessionStore,
    tools: [],
    commands: [pingCommandDef],
    providerFactory: () => new MockProvider(),
    rendererFactory: () => new MockRenderer(),
  });

  return { router, sessionStore };
}

function makeMessage(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    userId: 'user1',
    chatId: 'chat1',
    text: '/ping',
    messageId: 'msg-001',
    isMention: true,
    raw: {},
    ...overrides,
  };
}

describe('Router', () => {
  let store: MockSessionStore;
  let router: Router;

  beforeEach(() => {
    store = new MockSessionStore();
    const created = makeRouter(store);
    router = created.router;
  });

  afterEach(() => {
    store.reset();
  });

  describe('route', () => {
    it('gets or creates a session for the incoming message', async () => {
      expect(store.activeCount).toBe(0);

      await router.route(makeMessage());

      // A session should have been created
      expect(store.activeCount).toBe(1);
      const session = store.get('chat1:user1');
      expect(session).not.toBeNull();
      expect(session!.userId).toBe('user1');
      expect(session!.chatId).toBe('chat1');
    });

    it('reuses an existing session for the same user+chat combination', async () => {
      await router.route(makeMessage());
      expect(store.createCount).toBe(1);

      // Second message from same user+chat
      await router.route(makeMessage({ messageId: 'msg-002', text: '/ping' }));

      // createCount should still be 1 (reused, not created)
      expect(store.createCount).toBe(1);
      expect(store.activeCount).toBe(1);
    });

    it('creates separate sessions for different users', async () => {
      await router.route(makeMessage({ userId: 'user1' }));
      await router.route(makeMessage({ userId: 'user2', messageId: 'msg-002' }));

      expect(store.activeCount).toBe(2);
      expect(store.get('chat1:user1')).not.toBeNull();
      expect(store.get('chat1:user2')).not.toBeNull();
    });

    it('creates separate sessions for p2p vs group chats', async () => {
      // P2P message (no chatId)
      await router.route(makeMessage({ chatId: undefined }));
      // Group message
      await router.route(makeMessage({ chatId: 'group1', messageId: 'msg-002' }));

      expect(store.activeCount).toBe(2);
      expect(store.get('p2p:user1')).not.toBeNull();
      expect(store.get('group1:user1')).not.toBeNull();
    });

    it('creates harness for new sessions (no crash on first message)', async () => {
      // Harness creation happens inside route(). If it fails, this will throw.
      await expect(
        router.route(makeMessage()),
      ).resolves.toBeUndefined();
    });
  });

  describe('cleanExpired', () => {
    it('cleans up expired harnesses and returns cleaned count', async () => {
      // Create a session by routing a message
      await router.route(makeMessage());
      expect(store.activeCount).toBe(1);

      // Make the session expired
      const session = store.get('chat1:user1')!;
      session.lastActiveAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      // Also create a non-expired session
      await router.route(makeMessage({
        userId: 'user2',
        messageId: 'msg-002',
        text: '/ping',
      }));
      expect(store.activeCount).toBe(2);

      const cleaned = router.cleanExpired();

      // Only the expired session should be cleaned
      expect(cleaned).toBe(1);
      expect(store.activeCount).toBe(1);
      // user1's session should be gone, user2's session should remain
      expect(store.get('chat1:user1')).toBeNull();
      expect(store.get('chat1:user2')).not.toBeNull();
    });

    it('returns 0 when no sessions are expired', async () => {
      await router.route(makeMessage());
      await router.route(makeMessage({ userId: 'user2', messageId: 'msg-002' }));

      const cleaned = router.cleanExpired();

      expect(cleaned).toBe(0);
      expect(store.activeCount).toBe(2);
    });

    it('handles empty session store gracefully', () => {
      const cleaned = router.cleanExpired();
      expect(cleaned).toBe(0);
    });
  });
});
