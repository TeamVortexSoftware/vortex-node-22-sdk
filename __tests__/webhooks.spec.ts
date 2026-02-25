import crypto from 'node:crypto';
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  VortexWebhooks,
  VortexWebhookSignatureError,
  VortexWebhookEvent,
  VortexAnalyticsEvent,
  WebhookEventTypes,
  isWebhookEvent,
  isAnalyticsEvent,
  WebhookHandlers,
} from '../src';

const TEST_SECRET = 'whsec_test_secret_key_1234567890';

function sign(payload: string, secret: string = TEST_SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const sampleWebhookEvent: VortexWebhookEvent = {
  id: 'evt_123',
  type: 'invitation.accepted',
  timestamp: '2026-02-25T12:00:00Z',
  accountId: 'acc_456',
  environmentId: 'env_789',
  sourceTable: 'invitations',
  operation: 'update',
  data: {
    invitationId: 'inv_abc',
    targetEmail: 'user@example.com',
  },
};

const sampleAnalyticsEvent: VortexAnalyticsEvent = {
  id: 'ae_123',
  name: 'widget_loaded',
  accountId: 'acc_456',
  organizationId: 'org_789',
  projectId: 'proj_012',
  environmentId: 'env_345',
  deploymentId: 'dep_678',
  widgetConfigurationId: 'wc_901',
  foreignUserId: 'user_234',
  sessionId: 'sess_567',
  payload: { variant: 'A' },
  platform: 'web',
  segmentation: 'control',
  timestamp: '2026-02-25T12:00:00Z',
};

describe('VortexWebhooks', () => {
  let webhooks: VortexWebhooks;

  beforeEach(() => {
    webhooks = new VortexWebhooks({ secret: TEST_SECRET });
  });

  describe('constructor', () => {
    it('throws if secret is empty', () => {
      expect(() => new VortexWebhooks({ secret: '' })).toThrow('requires a secret');
    });
  });

  describe('verifySignature', () => {
    it('returns true for valid signature', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      const sig = sign(payload);
      expect(webhooks.verifySignature(payload, sig)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      expect(webhooks.verifySignature(payload, 'bad_signature')).toBe(false);
    });

    it('returns false for empty signature', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      expect(webhooks.verifySignature(payload, '')).toBe(false);
    });

    it('returns false for tampered payload', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      const sig = sign(payload);
      const tampered = payload.replace('inv_abc', 'inv_hacked');
      expect(webhooks.verifySignature(tampered, sig)).toBe(false);
    });

    it('returns false for wrong secret', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      const sig = sign(payload, 'wrong_secret');
      expect(webhooks.verifySignature(payload, sig)).toBe(false);
    });

    it('works with Buffer payload', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      const sig = sign(payload);
      expect(webhooks.verifySignature(Buffer.from(payload), sig)).toBe(true);
    });
  });

  describe('constructEvent', () => {
    it('returns webhook event for valid signature', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      const sig = sign(payload);
      const event = webhooks.constructEvent(payload, sig);
      expect(isWebhookEvent(event)).toBe(true);
      expect((event as VortexWebhookEvent).type).toBe('invitation.accepted');
      expect((event as VortexWebhookEvent).data.invitationId).toBe('inv_abc');
    });

    it('returns analytics event for valid signature', () => {
      const payload = JSON.stringify(sampleAnalyticsEvent);
      const sig = sign(payload);
      const event = webhooks.constructEvent(payload, sig);
      expect(isAnalyticsEvent(event)).toBe(true);
      expect((event as VortexAnalyticsEvent).name).toBe('widget_loaded');
    });

    it('throws VortexWebhookSignatureError for invalid signature', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      expect(() => webhooks.constructEvent(payload, 'bad')).toThrow(VortexWebhookSignatureError);
    });

    it('throws for tampered payload', () => {
      const payload = JSON.stringify(sampleWebhookEvent);
      const sig = sign(payload);
      const tampered = payload.replace('inv_abc', 'inv_hacked');
      expect(() => webhooks.constructEvent(tampered, sig)).toThrow(VortexWebhookSignatureError);
    });
  });

  describe('handleEvent', () => {
    it('calls type-specific handler for webhook events', async () => {
      const calls: string[] = [];
      const handlers: WebhookHandlers = {
        on: {
          'invitation.accepted': async () => { calls.push('specific'); },
        },
        onEvent: async () => { calls.push('general'); },
      };
      await webhooks.handleEvent(sampleWebhookEvent, handlers);
      expect(calls).toEqual(['specific', 'general']);
    });

    it('calls onEvent even without type-specific handler', async () => {
      const calls: string[] = [];
      const handlers: WebhookHandlers = {
        onEvent: async () => { calls.push('general'); },
      };
      await webhooks.handleEvent(sampleWebhookEvent, handlers);
      expect(calls).toEqual(['general']);
    });

    it('calls onAnalyticsEvent for analytics events', async () => {
      const calls: string[] = [];
      const handlers: WebhookHandlers = {
        onAnalyticsEvent: async (event) => { calls.push(event.name); },
      };
      await webhooks.handleEvent(sampleAnalyticsEvent, handlers);
      expect(calls).toEqual(['widget_loaded']);
    });

    it('does not call webhook handlers for analytics events', async () => {
      const calls: string[] = [];
      const handlers: WebhookHandlers = {
        on: { 'invitation.accepted': async () => { calls.push('should-not-run'); } },
        onEvent: async () => { calls.push('should-not-run'); },
        onAnalyticsEvent: async () => { calls.push('analytics'); },
      };
      await webhooks.handleEvent(sampleAnalyticsEvent, handlers);
      expect(calls).toEqual(['analytics']);
    });

    it('handles empty handlers gracefully', async () => {
      await webhooks.handleEvent(sampleWebhookEvent, {});
      await webhooks.handleEvent(sampleAnalyticsEvent, {});
      // No throws = pass
    });

    it('calls onError and rethrows when a handler throws', async () => {
      const errors: Error[] = [];
      const handlers: WebhookHandlers = {
        on: {
          'invitation.accepted': async () => { throw new Error('handler boom'); },
        },
        onError: (err) => { errors.push(err); },
      };
      await expect(webhooks.handleEvent(sampleWebhookEvent, handlers)).rejects.toThrow('handler boom');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('handler boom');
    });

    it('rethrows without onError when handler throws', async () => {
      const handlers: WebhookHandlers = {
        onEvent: async () => { throw new Error('no error handler'); },
      };
      await expect(webhooks.handleEvent(sampleWebhookEvent, handlers)).rejects.toThrow('no error handler');
    });
  });
});

describe('type guards', () => {
  it('isWebhookEvent correctly identifies webhook events', () => {
    expect(isWebhookEvent(sampleWebhookEvent)).toBe(true);
    expect(isWebhookEvent(sampleAnalyticsEvent)).toBe(false);
  });

  it('isAnalyticsEvent correctly identifies analytics events', () => {
    expect(isAnalyticsEvent(sampleAnalyticsEvent)).toBe(true);
    expect(isAnalyticsEvent(sampleWebhookEvent)).toBe(false);
  });
});

describe('WebhookEventTypes', () => {
  it('has expected event type values', () => {
    expect(WebhookEventTypes.INVITATION_ACCEPTED).toBe('invitation.accepted');
    expect(WebhookEventTypes.MEMBER_CREATED).toBe('member.created');
    expect(WebhookEventTypes.ABTEST_WINNER_DECLARED).toBe('abtest.winner_declared');
  });
});
