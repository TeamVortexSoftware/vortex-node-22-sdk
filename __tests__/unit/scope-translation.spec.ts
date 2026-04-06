import { describe, it, expect, beforeEach } from '@jest/globals';
import { Vortex } from '../../src/vortex';

// We need to test that the SDK transforms API responses
// The transforms are module-level functions, so we test through the Vortex class methods

describe('Scope Translation', () => {
  let vortex: Vortex;

  beforeEach(() => {
    vortex = new Vortex('VRTX.dGVzdC1pZA.test-key');
  });

  describe('createInvitation input translation', () => {
    it('should translate scopes/scopeId to groups/groupId when sending to API', async () => {
      // Mock the API request to capture what gets sent
      let capturedBody: any;
      (vortex as any).vortexApiRequest = async (options: any) => {
        capturedBody = JSON.parse(JSON.stringify(options.body));
        return { id: 'inv-1', shortLink: 'https://...', status: 'queued', createdAt: '2025-01-01' };
      };

      await vortex.createInvitation({
        widgetConfigurationId: 'wc-1',
        target: { type: 'email', value: 'test@example.com' },
        inviter: { userId: 'user-1' },
        scopes: [{ type: 'team', scopeId: 'team-123', name: 'Engineering' }],
      });

      // API should receive 'groups' with 'groupId', not 'scopes' with 'scopeId'
      expect(capturedBody.groups).toBeDefined();
      expect(capturedBody.scopes).toBeUndefined();
      expect(capturedBody.groups[0].groupId).toBe('team-123');
      expect(capturedBody.groups[0].scopeId).toBeUndefined();
      expect(capturedBody.groups[0].type).toBe('team');
      expect(capturedBody.groups[0].name).toBe('Engineering');
    });

    it('should translate flat scopeId/scopeType/scopeName to groups array', async () => {
      let capturedBody: any;
      (vortex as any).vortexApiRequest = async (options: any) => {
        capturedBody = JSON.parse(JSON.stringify(options.body));
        return { id: 'inv-1', shortLink: 'https://...', status: 'queued', createdAt: '2025-01-01' };
      };

      await vortex.createInvitation({
        widgetConfigurationId: 'wc-1',
        target: { type: 'email', value: 'test@example.com' },
        inviter: { userId: 'user-1' },
        scopeId: 'team-123',
        scopeType: 'team',
        scopeName: 'Engineering',
      });

      // API should receive a single-element groups array
      expect(capturedBody.groups).toBeDefined();
      expect(capturedBody.groups).toHaveLength(1);
      expect(capturedBody.groups[0].groupId).toBe('team-123');
      expect(capturedBody.groups[0].type).toBe('team');
      expect(capturedBody.groups[0].name).toBe('Engineering');
      // Flat params should be cleaned up
      expect(capturedBody.scopeId).toBeUndefined();
      expect(capturedBody.scopeType).toBeUndefined();
      expect(capturedBody.scopeName).toBeUndefined();
      expect(capturedBody.scopes).toBeUndefined();
    });

    it('should still accept deprecated groups/groupId input', async () => {
      let capturedBody: any;
      (vortex as any).vortexApiRequest = async (options: any) => {
        capturedBody = JSON.parse(JSON.stringify(options.body));
        return { id: 'inv-1', shortLink: 'https://...', status: 'queued', createdAt: '2025-01-01' };
      };

      await vortex.createInvitation({
        widgetConfigurationId: 'wc-1',
        target: { type: 'email', value: 'test@example.com' },
        inviter: { userId: 'user-1' },
        groups: [{ type: 'team', groupId: 'team-123', name: 'Engineering' }],
      });

      expect(capturedBody.groups).toBeDefined();
      expect(capturedBody.groups[0].groupId).toBe('team-123');
    });
  });

  describe('Response translation', () => {
    const mockApiResponse = {
      id: 'inv-1',
      accountId: 'acc-1',
      clickThroughs: 0,
      configurationAttributes: null,
      attributes: null,
      createdAt: '2025-01-01T00:00:00Z',
      deactivated: false,
      deliveryCount: 1,
      deliveryTypes: ['email'],
      foreignCreatorId: 'user-1',
      invitationType: 'single_use',
      modifiedAt: null,
      status: 'sent',
      views: 0,
      widgetConfigurationId: 'wc-1',
      projectId: 'proj-1',
      // API returns groups/groupId
      groups: [
        {
          id: 'scope-uuid-1',
          accountId: 'acc-1',
          groupId: 'my-team-id',
          type: 'team',
          name: 'Engineering',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
      target: [{ type: 'email', value: 'test@example.com' }],
      accepts: [],
      expired: false,
    };

    it('getInvitation should return scopes/scopeId alongside groups/groupId', async () => {
      (vortex as any).vortexApiRequest = async () => ({ ...mockApiResponse });

      const result = await vortex.getInvitation('inv-1');

      // New preferred fields
      expect(result.scopes).toBeDefined();
      expect(result.scopes).toHaveLength(1);
      expect(result.scopes[0].scopeId).toBe('my-team-id');
      expect(result.scopes[0].type).toBe('team');
      expect(result.scopes[0].name).toBe('Engineering');

      // Deprecated fields still work
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groupId).toBe('my-team-id');
      expect(result.groups[0].scopeId).toBe('my-team-id');
    });

    it('getInvitationsByScope should return scopes/scopeId', async () => {
      (vortex as any).vortexApiRequest = async () => ({
        invitations: [{ ...mockApiResponse }],
      });

      const results = await vortex.getInvitationsByScope('team', 'my-team-id');

      expect(results[0].scopes).toBeDefined();
      expect(results[0].scopes[0].scopeId).toBe('my-team-id');
    });

    it('acceptInvitations should return scopes/scopeId', async () => {
      (vortex as any).vortexApiRequest = async () => ({ ...mockApiResponse });

      const result = await vortex.acceptInvitations(['inv-1'], { email: 'test@example.com' });

      expect(result.scopes).toBeDefined();
      expect(result.scopes[0].scopeId).toBe('my-team-id');
    });

    it('reinvite should return scopes/scopeId', async () => {
      (vortex as any).vortexApiRequest = async () => ({ ...mockApiResponse });

      const result = await vortex.reinvite('inv-1');

      expect(result.scopes).toBeDefined();
      expect(result.scopes[0].scopeId).toBe('my-team-id');
    });

    it('getInvitationsByTarget should return scopes/scopeId', async () => {
      (vortex as any).vortexApiRequest = async () => ({
        invitations: [{ ...mockApiResponse }],
      });

      const results = await vortex.getInvitationsByTarget('email', 'test@example.com');

      expect(results[0].scopes).toBeDefined();
      expect(results[0].scopes[0].scopeId).toBe('my-team-id');
    });
  });
});
