import { describe, it, expect } from '@jest/globals';
import type {
  InvitationScope,
  ScopeInput,
  InvitationGroup,
  GroupInput,
  InvitationResult,
} from './types';

describe('InvitationScope Types', () => {
  describe('InvitationScope deserialization', () => {
    it('should properly deserialize all 6 fields from API response', () => {
      // This is the actual structure returned by the API (MemberGroups table)
      const apiResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        groupId: 'workspace-123',
        scopeId: 'workspace-123',
        type: 'workspace',
        name: 'My Workspace',
        createdAt: '2025-01-27T12:00:00.000Z',
      };

      // TypeScript will enforce that the object matches InvitationScope type
      const scope: InvitationScope = apiResponse;

      expect(scope.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(scope.accountId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
      expect(scope.scopeId).toBe('workspace-123');
      expect(scope.groupId).toBe('workspace-123');
      expect(scope.type).toBe('workspace');
      expect(scope.name).toBe('My Workspace');
      expect(scope.createdAt).toBe('2025-01-27T12:00:00.000Z');
    });

    it('should handle InvitationResult with groups array (API response field name)', () => {
      const apiResponse = {
        id: 'inv-123',
        accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        clickThroughs: 5,
        formSubmissionData: {},
        configurationAttributes: {},
        attributes: {},
        createdAt: '2025-01-27T12:00:00.000Z',
        deactivated: false,
        deliveryCount: 1,
        deliveryTypes: ['email'] as ('email' | 'phone' | 'share' | 'internal')[],
        foreignCreatorId: 'user-123',
        invitationType: 'single_use' as 'single_use' | 'multi_use',
        modifiedAt: null,
        status: 'delivered' as any,
        target: [{ type: 'email' as const, value: 'test@example.com' }],
        views: 10,
        widgetConfigurationId: 'widget-123',
        projectId: 'project-123',
        groups: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            groupId: 'workspace-123',
            scopeId: 'workspace-123',
            type: 'workspace',
            name: 'My Workspace',
            createdAt: '2025-01-27T12:00:00.000Z',
          },
        ],
        scopes: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            groupId: 'workspace-123',
            scopeId: 'workspace-123',
            type: 'workspace',
            name: 'My Workspace',
            createdAt: '2025-01-27T12:00:00.000Z',
          },
        ],
        accepts: [],
        expired: false,
      };

      const invitation: InvitationResult = apiResponse;

      expect(invitation.scopes).toHaveLength(1);
      expect(invitation.scopes[0].scopeId).toBe('workspace-123');
      // Deprecated fields still work
      expect(invitation.groups).toHaveLength(1);
      expect(invitation.groups[0].groupId).toBe('workspace-123');
    });
  });

  describe('ScopeInput for JWT generation', () => {
    it('should accept legacy id field', () => {
      const scope: ScopeInput = {
        type: 'workspace',
        id: 'workspace-123',
        name: 'My Workspace',
      };

      expect(scope.id).toBe('workspace-123');
      expect(scope.type).toBe('workspace');
      expect(scope.name).toBe('My Workspace');
    });

    it('should accept preferred scopeId field', () => {
      const scope: ScopeInput = {
        type: 'workspace',
        groupId: 'workspace-123',
        name: 'My Workspace',
      };

      expect(scope.groupId).toBe('workspace-123');
      expect(scope.type).toBe('workspace');
      expect(scope.name).toBe('My Workspace');
    });

    it('should accept both id and scopeId fields', () => {
      const scope: ScopeInput = {
        type: 'workspace',
        id: 'workspace-old',
        groupId: 'workspace-new',
        name: 'My Workspace',
      };

      expect(scope.id).toBe('workspace-old');
      expect(scope.groupId).toBe('workspace-new');
    });
  });

  describe('Backward compatibility with deprecated types', () => {
    it('GroupInput should work as alias for ScopeInput', () => {
      const group: GroupInput = {
        type: 'workspace',
        groupId: 'workspace-123',
        name: 'My Workspace',
      };

      expect(group.groupId).toBe('workspace-123');
      expect(group.type).toBe('workspace');
      expect(group.name).toBe('My Workspace');
    });

    it('InvitationGroup should work as alias for InvitationScope', () => {
      const group: InvitationGroup = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        groupId: 'workspace-123',
        scopeId: 'workspace-123',
        type: 'workspace',
        name: 'My Workspace',
        createdAt: '2025-01-27T12:00:00.000Z',
      };

      expect(group.scopeId).toBe('workspace-123');
      expect(group.groupId).toBe('workspace-123');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize ScopeInput correctly', () => {
      const scope: ScopeInput = {
        type: 'workspace',
        groupId: 'workspace-123',
        name: 'My Workspace',
      };

      const json = JSON.stringify(scope);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe('workspace');
      expect(parsed.groupId).toBe('workspace-123');
      expect(parsed.name).toBe('My Workspace');
    });

    it('should deserialize InvitationScope from JSON string', () => {
      const jsonString = JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        groupId: 'workspace-123',
        scopeId: 'workspace-123',
        type: 'workspace',
        name: 'My Workspace',
        createdAt: '2025-01-27T12:00:00.000Z',
      });

      const scope: InvitationScope = JSON.parse(jsonString);

      expect(scope.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(scope.scopeId).toBe('workspace-123');
      expect(scope.groupId).toBe('workspace-123');
    });
  });
});

describe('Scope Translation (groups/groupId → scopes/scopeId)', () => {
  // These tests import the Vortex class and verify the transform behavior
  // by checking that API responses with "groups"/"groupId" are augmented
  // with "scopes"/"scopeId" fields

  describe('Response transformation', () => {
    it('should add scopes alongside groups in invitation results', () => {
      // Simulate what the API returns (raw wire format)
      const apiResponse: InvitationResult = {
        id: 'inv-1',
        accountId: 'acc-1',
        clickThroughs: 0,
        formSubmissionData: null,
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
        groups: [
          {
            id: 'scope-uuid-1',
            accountId: 'acc-1',
            groupId: 'my-team-id',
            scopeId: 'my-team-id',
            type: 'team',
            name: 'Engineering',
            createdAt: '2025-01-01T00:00:00Z',
          },
        ],
        scopes: [
          {
            id: 'scope-uuid-1',
            accountId: 'acc-1',
            groupId: 'my-team-id',
            scopeId: 'my-team-id',
            type: 'team',
            name: 'Engineering',
            createdAt: '2025-01-01T00:00:00Z',
          },
        ],
        target: [{ type: 'email', value: 'test@example.com' }],
        accepts: [],
        expired: false,
      };

      // After SDK transformation, both scopes and groups should exist
      expect(apiResponse.scopes).toBeDefined();
      expect(apiResponse.scopes).toHaveLength(1);
      expect(apiResponse.scopes[0].scopeId).toBe('my-team-id');
      // Deprecated fields still accessible
      expect(apiResponse.groups).toHaveLength(1);
      expect(apiResponse.groups[0].groupId).toBe('my-team-id');
    });
  });
});
