import { describe, it, expect } from '@jest/globals';
import type { InvitationGroup, GroupInput, InvitationResult } from './types';

describe('InvitationGroup Types', () => {
  describe('InvitationGroup deserialization', () => {
    it('should properly deserialize all 6 fields from API response', () => {
      // This is the actual structure returned by the API (MemberGroups table)
      const apiResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        groupId: 'workspace-123',
        type: 'workspace',
        name: 'My Workspace',
        createdAt: '2025-01-27T12:00:00.000Z',
      };

      // TypeScript will enforce that the object matches InvitationGroup type
      const group: InvitationGroup = apiResponse;

      expect(group.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(group.accountId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
      expect(group.groupId).toBe('workspace-123');
      expect(group.type).toBe('workspace');
      expect(group.name).toBe('My Workspace');
      expect(group.createdAt).toBe('2025-01-27T12:00:00.000Z');
    });

    it('should handle InvitationResult with groups array', () => {
      const apiResponse = {
        id: 'inv-123',
        accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        clickThroughs: 5,
        configurationAttributes: {},
        attributes: {},
        createdAt: '2025-01-27T12:00:00.000Z',
        deactivated: false,
        deliveryCount: 1,
        deliveryTypes: ['email'] as ('email' | 'sms' | 'share')[],
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
            type: 'workspace',
            name: 'My Workspace',
            createdAt: '2025-01-27T12:00:00.000Z',
          },
        ],
        accepts: [],
        expired: false,
      };

      const invitation: InvitationResult = apiResponse;

      expect(invitation.groups).toHaveLength(1);
      expect(invitation.groups[0].groupId).toBe('workspace-123');
      expect(invitation.groups[0].accountId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    });
  });

  describe('GroupInput for JWT generation', () => {
    it('should accept legacy id field', () => {
      const group: GroupInput = {
        type: 'workspace',
        id: 'workspace-123',
        name: 'My Workspace',
      };

      expect(group.id).toBe('workspace-123');
      expect(group.type).toBe('workspace');
      expect(group.name).toBe('My Workspace');
    });

    it('should accept preferred groupId field', () => {
      const group: GroupInput = {
        type: 'workspace',
        groupId: 'workspace-123',
        name: 'My Workspace',
      };

      expect(group.groupId).toBe('workspace-123');
      expect(group.type).toBe('workspace');
      expect(group.name).toBe('My Workspace');
    });

    it('should accept both id and groupId fields', () => {
      const group: GroupInput = {
        type: 'workspace',
        id: 'workspace-old',
        groupId: 'workspace-new',
        name: 'My Workspace',
      };

      expect(group.id).toBe('workspace-old');
      expect(group.groupId).toBe('workspace-new');
    });
  });

  describe('JSON serialization', () => {
    it('should serialize GroupInput correctly', () => {
      const group: GroupInput = {
        type: 'workspace',
        groupId: 'workspace-123',
        name: 'My Workspace',
      };

      const json = JSON.stringify(group);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe('workspace');
      expect(parsed.groupId).toBe('workspace-123');
      expect(parsed.name).toBe('My Workspace');
    });

    it('should deserialize InvitationGroup from JSON string', () => {
      const jsonString = JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        accountId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        groupId: 'workspace-123',
        type: 'workspace',
        name: 'My Workspace',
        createdAt: '2025-01-27T12:00:00.000Z',
      });

      const group: InvitationGroup = JSON.parse(jsonString);

      expect(group.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(group.groupId).toBe('workspace-123');
      expect(group.accountId).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    });
  });
});
