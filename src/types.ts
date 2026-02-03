export type InvitationTarget = {
  type: 'email' | 'phone' | 'share' | 'internal';
  value: string;
};

/**
 * GroupInput is used when creating JWTs - represents customer's group data
 * Supports both 'id' (legacy) and 'group_id' (preferred) for backward compatibility
 */
export type GroupInput = {
  type: string;
  id?: string; // Legacy field (deprecated, use group_id)
  groupId?: string; // Preferred: Customer's group ID
  name: string;
};

/**
 * InvitationGroup represents a group in API responses
 * This matches the MemberGroups table structure from the API
 */
export type InvitationGroup = {
  id: string; // Vortex internal UUID
  accountId: string; // Vortex account ID
  groupId: string; // Customer's group ID (the ID they provided to Vortex)
  type: string; // Group type (e.g., "workspace", "team")
  name: string; // Group name
  createdAt: string; // ISO 8601 timestamp when the group was created
};

export type InvitationAcceptance = {
  id: string;
  accountId: string;
  projectId: string;
  acceptedAt: string;
  target: InvitationTarget;
};

export type InvitationResult = {
  id: string;
  accountId: string;
  clickThroughs: number;
  configurationAttributes: Record<string, any> | null;
  attributes: Record<string, any> | null;
  createdAt: string;
  deactivated: boolean;
  deliveryCount: number;
  deliveryTypes: ('email' | 'phone' | 'share' | 'internal')[];
  foreignCreatorId: string;
  invitationType: 'single_use' | 'multi_use' | 'autojoin';
  modifiedAt: string | null;
  status:
    | 'queued'
    | 'sending'
    | 'sent'
    | 'delivered'
    | 'accepted'
    | 'shared'
    | 'unfurled'
    | 'accepted_elsewhere';
  target: InvitationTarget[];
  views: number;
  widgetConfigurationId: string;
  projectId: string;
  groups: InvitationGroup[];
  accepts: InvitationAcceptance[];
  expired: boolean;
  expires?: string;
  source?: string;
  creatorName?: string | null;
  creatorAvatarUrl?: string | null;
};

/**
 * User type for accepting invitations
 * Requires either email or phone (or both)
 */
export type AcceptUser = {
  email?: string;
  phone?: string;
  name?: string;
};

export type AcceptInvitationRequest = {
  invitationIds: string[];
  user: AcceptUser;
};

export type AcceptInvitationRequestLegacy = {
  invitationIds: string[];
  target: InvitationTarget;
};

export type ApiResponseJson = InvitationResult | { invitations: InvitationResult[] } | {};

export type ApiRequestBody = AcceptInvitationRequest | AcceptInvitationRequestLegacy | null;

/**
 * User type for JWT generation
 * Requires both id and email
 */
export type User = {
  id: string;
  email: string;
  userName?: string;
  userAvatarUrl?: string;
  adminScopes?: string[];
  [key: string]: any;
};

/**
 * Autojoin domain configuration
 */
export type AutojoinDomain = {
  id: string;
  domain: string;
};

/**
 * Response from autojoin API endpoints
 */
export type AutojoinDomainsResponse = {
  autojoinDomains: AutojoinDomain[];
  invitation: InvitationResult | null;
};

/**
 * Request body for configuring autojoin domains
 */
export type ConfigureAutojoinRequest = {
  scope: string;
  scopeType: string;
  scopeName?: string;
  domains: string[];
  widgetId: string;
  metadata?: Record<string, any>;
};

/**
 * Target types for creating invitations
 */
export type CreateInvitationTargetType = 'email' | 'phone' | 'internal';

/**
 * Target for creating an invitation
 */
export type CreateInvitationTarget = {
  type: CreateInvitationTargetType;
  value: string;
};

/**
 * Information about the user creating the invitation (the inviter)
 */
export type Inviter = {
  /** The internal user ID of the person creating the invitation (from your system) */
  userId: string;
  /** The email address of the person creating the invitation */
  userEmail?: string;
  /** The display name of the person creating the invitation */
  userName?: string;
  /** Avatar URL for the person creating the invitation */
  userAvatarUrl?: string;
};

/**
 * Group information for creating invitations
 */
export type CreateInvitationGroup = {
  /** The type of the group/scope (e.g., "team", "organization", "project") */
  type: string;
  /** The ID of the group/scope in your system */
  groupId: string;
  /** The display name of the group/scope */
  name: string;
};

/**
 * Configuration for link unfurl (Open Graph) metadata
 * Controls how the invitation link appears when shared on social platforms or messaging apps
 */
export type UnfurlConfig = {
  /** The title shown in link previews (og:title) */
  title?: string;
  /** The description shown in link previews (og:description) */
  description?: string;
  /** The image URL shown in link previews (og:image) - must be HTTPS */
  image?: string;
  /** The Open Graph type (og:type) - e.g., 'website', 'article', 'product' */
  type?: 'website' | 'article' | 'video' | 'music' | 'book' | 'profile' | 'product';
  /** The site name shown in link previews (og:site_name) */
  siteName?: string;
};

/**
 * Request body for creating an invitation via the public API
 */
export type CreateInvitationRequest = {
  /** The ID of the widget configuration to use for this invitation */
  widgetConfigurationId: string;
  /** The target of the invitation (who is being invited) */
  target: CreateInvitationTarget;
  /** Information about the user creating the invitation */
  inviter: Inviter;
  /** Groups/scopes to associate with this invitation */
  groups?: CreateInvitationGroup[];
  /** The source of the invitation for analytics (e.g., "api", "backend", "pymk") */
  source?: string;
  /** Template variables for email customization */
  templateVariables?: Record<string, string>;
  /** Custom metadata to attach to the invitation (passed through to webhooks) */
  metadata?: Record<string, any>;
  /** Link unfurl (Open Graph) configuration for social/messaging previews */
  unfurlConfig?: UnfurlConfig;
};

/**
 * Response from creating an invitation
 */
export type CreateInvitationResponse = {
  /** The ID of the created invitation */
  id: string;
  /** The short link for the invitation */
  shortLink: string;
  /** The status of the invitation */
  status: string;
  /** When the invitation was created */
  createdAt: string;
};
