export type InvitationTarget = {
  type: 'email' | 'sms';
  value: string;
};

/**
 * GroupInput is used when creating JWTs - represents customer's group data
 * Supports both 'id' (legacy) and 'group_id' (preferred) for backward compatibility
 */
export type GroupInput = {
  type: string;
  id?: string;      // Legacy field (deprecated, use group_id)
  groupId?: string; // Preferred: Customer's group ID
  name: string;
};

/**
 * InvitationGroup represents a group in API responses
 * This matches the MemberGroups table structure from the API
 */
export type InvitationGroup = {
  id: string;        // Vortex internal UUID
  accountId: string; // Vortex account ID
  groupId: string;   // Customer's group ID (the ID they provided to Vortex)
  type: string;      // Group type (e.g., "workspace", "team")
  name: string;      // Group name
  createdAt: string; // ISO 8601 timestamp when the group was created
};

export type InvitationAcceptance = {
  id: string;
  accountId: string;
  projectId: string;
  acceptedAt: string;
  target: InvitationTarget;
}

export type InvitationResult = {
  id: string;
  accountId: string;
  clickThroughs: number;
  configurationAttributes: Record<string, any> | null;
  attributes: Record<string, any> | null;
  createdAt: string;
  deactivated: boolean;
  deliveryCount: number;
  deliveryTypes: ('email' | 'sms' | 'share')[];
  foreignCreatorId: string;
  invitationType: 'single_use' | 'multi_use';
  modifiedAt: string | null;
  status: 'queued' | 'sending' | 'delivered' | 'accepted' | 'shared' | 'unfurled' | 'accepted_elsewhere';
  target: InvitationTarget[];
  views: number;
  widgetConfigurationId: string;
  projectId: string;
  groups: InvitationGroup[];
  accepts: InvitationAcceptance[];
};

export type AcceptInvitationRequest = {
  invitationIds: string[];
  target: InvitationTarget;
};

export type ApiResponseJson = InvitationResult | { invitations: InvitationResult[] } | {};

export type ApiRequestBody = AcceptInvitationRequest | null;