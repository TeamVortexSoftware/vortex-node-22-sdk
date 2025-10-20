export type InvitationTarget = {
  type: 'email' | 'sms';
  value: string;
};

export type InvitationGroup = {
  id: string;
  type: string;
  name: string;
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