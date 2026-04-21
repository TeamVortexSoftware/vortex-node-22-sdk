/**
 * Target recipient of an invitation
 */
export type InvitationTarget = {
  /** Delivery channel type */
  type: 'email' | 'phone' | 'share' | 'internal';
  /** Target address (email, phone number, or share link ID) */
  value: string;
  /** Display name of the person being invited */
  name?: string | null;
  /** Avatar URL for the person being invited */
  avatarUrl?: string | null;
};

/**
 * ScopeInput is used when creating JWTs - represents customer's scope data
 * Supports both 'id' (legacy) and 'groupId' (preferred) for backward compatibility
 */
export type ScopeInput = {
  /** Scope type (e.g., 'team', 'organization', 'workspace') */
  type: string;
  /**
   * @deprecated Use scopeId instead
   */
  id?: string;
  /** The scope identifier (preferred) */
  scopeId?: string;
  /**
   * @deprecated Use scopeId instead
   */
  groupId?: string;
  /** Display name for the scope */
  name: string;
};

/**
 * @deprecated Use ScopeInput instead
 */
export type GroupInput = ScopeInput;

/**
 * InvitationScope represents a scope in API responses
 * This matches the MemberGroups table structure from the API
 */
export type InvitationScope = {
  /** Vortex internal UUID */
  id: string;
  /** Vortex account ID */
  accountId: string;
  /** The customer's scope ID (preferred) */
  scopeId: string;
  /**
   * @deprecated Use scopeId instead
   */
  groupId: string;
  /** Scope type (e.g., 'workspace', 'team') */
  type: string;
  /** Display name for the scope */
  name: string;
  /** ISO timestamp when the scope was created */
  createdAt: string;
};

/**
 * @deprecated Use InvitationScope instead
 */
export type InvitationGroup = InvitationScope;

/**
 * Record of a user accepting an invitation
 */
export type InvitationAcceptance = {
  /** Unique acceptance record ID */
  id: string;
  /** Vortex account ID */
  accountId: string;
  /** ISO timestamp when the invitation was accepted */
  acceptedAt: string;
  /** The user who accepted the invitation */
  target: InvitationTarget;
};

/**
 * Base invitation result without target information.
 * Used by endpoints like getInvitationsByTarget where target is already known.
 */
export type InvitationResultBase = {
  /** Unique invitation identifier */
  id: string;
  /** Vortex account ID that owns this invitation */
  accountId: string;
  /** Number of times the invitation link was clicked */
  clickThroughs: number;
  /**
   * Invitation form data submitted by the user, including email addresses of invitees and the values of any custom fields.
   */
  formSubmissionData: Record<string, any> | null;
  /**
   * @deprecated Use formSubmissionData instead. This field contains the same data.
   */
  configurationAttributes: Record<string, any> | null;
  /** Custom attributes attached to this invitation */
  attributes: Record<string, any> | null;
  /** ISO timestamp when the invitation was created */
  createdAt: string;
  /** Whether the invitation has been deactivated */
  deactivated: boolean;
  /** Number of delivery attempts made */
  deliveryCount: number;
  /** Delivery channels used for this invitation */
  deliveryTypes: ('email' | 'phone' | 'share' | 'internal')[];
  /** Your user ID who created this invitation */
  foreignCreatorId: string;
  /** Type of invitation: single_use (one accept), multi_use (unlimited), or autojoin (domain-based) */
  invitationType: 'single_use' | 'multi_use' | 'autojoin';
  /** ISO timestamp when the invitation was last modified */
  modifiedAt: string | null;
  /** Current status of the invitation */
  status:
    | 'queued'
    | 'sending'
    | 'sent'
    | 'delivered'
    | 'accepted'
    | 'shared'
    | 'unfurled'
    | 'accepted_elsewhere';
  /** Number of times the invitation was viewed */
  views: number;
  /** ID of the component configuration used */
  widgetConfigurationId: string;
  /** Scopes associated with this invitation (preferred) */
  scopes: InvitationScope[];
  /**
   * @deprecated Use scopes instead
   */
  groups: InvitationScope[];
  /** List of users who accepted this invitation */
  accepts?: InvitationAcceptance[];
  /** Whether the invitation has expired */
  expired: boolean;
  /** ISO timestamp when the invitation expires */
  expires?: string;
  /** Source identifier (e.g., campaign name) */
  source?: string;
  /** Customer-defined subtype for categorizing this invitation (e.g., pymk, find-friends, profile-button) */
  subtype?: string | null;
  /** Display name of the invitation creator */
  creatorName?: string | null;
  /** Avatar URL of the invitation creator */
  creatorAvatarUrl?: string | null;
};

/**
 * Full invitation result including target information.
 * Used by getInvitation, getInvitationsByScope, and other endpoints that return targets.
 */
export type InvitationResult = InvitationResultBase & {
  /** List of invitation targets (recipients) */
  target: InvitationTarget[];
};

/**
 * User type for accepting invitations
 * Requires either email or phone (or both)
 */
export type AcceptUser = {
  /** Email address of the accepting user */
  email?: string;
  /** Phone number of the accepting user */
  phone?: string;
  /** Display name of the accepting user */
  name?: string;
  /**
   * Whether the accepting user is an existing user in your system.
   * Set to true if the user was already registered before accepting the invitation.
   * Set to false if this is a new user signup.
   * Leave undefined if unknown.
   * Used for analytics to track new vs existing user conversions.
   */
  isExisting?: boolean;
};

/**
 * Request body for accepting invitations
 */
export type AcceptInvitationRequest = {
  /** Array of invitation IDs to accept */
  invitationIds: string[];
  /** Information about the user accepting the invitations */
  user: AcceptUser;
};

/**
 * Legacy request body for accepting invitations
 * @deprecated Use AcceptInvitationRequest instead
 */
export type AcceptInvitationRequestLegacy = {
  /** Array of invitation IDs to accept */
  invitationIds: string[];
  /** Target information (legacy format) */
  target: InvitationTarget;
};

/**
 * Request body for syncing an internal invitation action
 */
export type SyncInternalInvitationRequest = {
  /** The inviter's user ID */
  creatorId: string;
  /** The invitee's user ID */
  targetValue: string;
  /** The action taken: "accepted" or "declined" */
  action: 'accepted' | 'declined';
  /** The widget component UUID */
  componentId: string;
};

/**
 * Response from syncing an internal invitation action
 */
export type SyncInternalInvitationResponse = {
  /** Number of invitations processed */
  processed: number;
  /** IDs of the invitations that were processed */
  invitationIds: string[];
};

/**
 * Union of possible API response JSON structures
 * @internal
 */
export type ApiResponseJson =
  | InvitationResult
  | InvitationResultBase
  | { invitations: InvitationResult[] }
  | { invitations: InvitationResultBase[] }
  | {};

/**
 * Union of possible API request body types
 * @internal
 */
export type ApiRequestBody = AcceptInvitationRequest | AcceptInvitationRequestLegacy | null;

/**
 * User type for JWT generation
 * Only `id` is required. Email is optional but recommended for invitation attribution.
 */
export type User = {
  /** Unique user identifier in your system */
  id: string;
  /** User's email address (optional, used for reply-to in invitation emails) */
  email?: string;
  /** User's display name (preferred) */
  name?: string;
  /** User's avatar URL (preferred) */
  avatarUrl?: string;
  /**
   * @deprecated Use `name` instead
   */
  userName?: string;
  /**
   * @deprecated Use `avatarUrl` instead
   */
  userAvatarUrl?: string;
  /** Admin scope permissions (e.g., ['autojoin']) */
  adminScopes?: string[];
  /**
   * Optional list of allowed email domains for invitation restrictions.
   * When present, email invitations will only be allowed to addresses
   * matching one of these domains (e.g., ['acme.com', 'acme.org']).
   * Domain matching is case-insensitive.
   */
  allowedEmailDomains?: string[];
  [key: string]: any;
};

/**
 * Autojoin domain configuration
 * Allows users with matching email domains to automatically join a scope
 */
export type AutojoinDomain = {
  /** Unique domain configuration ID */
  id: string;
  /** Email domain (e.g., 'acme.com') */
  domain: string;
};

/**
 * Response from autojoin API endpoints
 */
export type AutojoinDomainsResponse = {
  /** List of configured autojoin domains */
  autojoinDomains: AutojoinDomain[];
  /** The autojoin invitation if one exists, null otherwise */
  invitation: InvitationResult | null;
};

/**
 * Request body for configuring autojoin domains
 */
export type ConfigureAutojoinRequest = {
  /** Scope ID in your system */
  scope: string;
  /** Type of scope (e.g., 'team', 'organization') */
  scopeType: string;
  /** Display name for the scope */
  scopeName?: string;
  /** List of email domains that can autojoin (e.g., ['acme.com', 'acme.org']) */
  domains: string[];
  /** Component ID to use for autojoin invitations */
  componentId: string;
  /** Custom metadata to attach to autojoin invitations */
  metadata?: Record<string, any>;
};

/**
 * Target types for creating invitations
 * - email: Send invitation via email
 * - phone: Send invitation via SMS
 * - internal: In-app invitation (no external delivery)
 */
export type CreateInvitationTargetType = 'email' | 'phone' | 'internal';

/**
 * Target for creating an invitation
 */
export type CreateInvitationTarget = {
  /** Delivery channel type */
  type: CreateInvitationTargetType;
  /** Target address: email address, phone number, or internal user ID */
  value: string;
  /** Display name of the person being invited */
  name?: string;
  /** Avatar URL for the person being invited */
  avatarUrl?: string;
};

/**
 * Information about the user creating the invitation (the inviter)
 */
export type Inviter = {
  /** The internal user ID of the person creating the invitation (from your system) */
  userId: string;
  /** The email address of the person creating the invitation */
  userEmail?: string;
  /** The display name of the person creating the invitation (preferred) */
  name?: string;
  /** Avatar URL for the person creating the invitation (preferred) */
  avatarUrl?: string;
  /** @deprecated Use `name` instead */
  userName?: string;
  /** @deprecated Use `avatarUrl` instead */
  userAvatarUrl?: string;
};

/**
 * Scope information for creating invitations
 */
export type CreateInvitationScope = {
  /** The type of the scope (e.g., "team", "organization", "project") */
  type: string;
  /** The ID of the scope in your system (preferred) */
  scopeId?: string;
  /** @deprecated Use scopeId instead */
  groupId?: string;
  /** The display name of the scope */
  name: string;
};

/**
 * @deprecated Use CreateInvitationScope instead
 */
export type CreateInvitationGroup = CreateInvitationScope;

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
  /** The scope ID in your system (preferred — single scope per invitation) */
  scopeId?: string;
  /** The scope type (e.g., "team", "organization", "project") */
  scopeType?: string;
  /** The display name of the scope */
  scopeName?: string;
  /** @deprecated Use scopeId/scopeType/scopeName instead */
  scopes?: CreateInvitationScope[];
  /** @deprecated Use scopeId/scopeType/scopeName instead */
  groups?: CreateInvitationScope[];
  /** The source of the invitation for analytics (e.g., "api", "backend", "pymk") */
  source?: string;
  /** Template variables for email customization */
  templateVariables?: Record<string, string>;
  /** Custom metadata to attach to the invitation (passed through to webhooks) */
  metadata?: Record<string, any>;
  /**
   * Customer-defined subtype for categorizing this invitation.
   * Used for analytics segmentation, especially for internal invitations.
   * Examples: "pymk", "find-friends", "profile-button", "post-signup"
   */
  subtype?: string;
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

/**
 * User object for generateToken - flexible structure
 * Only `id` is required for secure attribution
 */
export type GenerateTokenUser = {
  /** User ID - required for secure attribution */
  id: string | number;
  /** User's email address */
  email?: string;
  /** User's display name */
  name?: string;
  /** User's phone number */
  phone?: string;
  /** User's avatar URL */
  avatarUrl?: string;
  /** Additional custom properties */
  [key: string]: any;
};

/**
 * Payload structure for generateToken method
 * All fields are optional - sign only what you need
 */
export type GenerateTokenData = {
  /** Widget component ID */
  component?: string;
  /** DOM selector for trigger button */
  trigger?: string;
  /** DOM selector for embed container */
  embed?: string;
  /** User information - include `id` for secure attribution */
  user?: GenerateTokenUser;
  /** Scope/workspace identifier */
  scope?: string;
  /** Template variables for customization */
  vars?: Record<string, any>;
  /** Additional custom properties */
  [key: string]: any;
};

/**
 * Options for generateJwt method
 */
export type GenerateJwtOptions = {
  /**
   * JWT expiration time
   * - String format: '5m', '1h', '24h', '7d' (minutes, hours, days)
   * - Number format: seconds
   * - Default: 30 days (2592000 seconds)
   */
  expiresIn?: string | number;
};

/**
 * Options for generateToken method
 */
export type GenerateTokenOptions = {
  /**
   * Token expiration time
   * - String format: '5m', '1h', '24h', '7d' (minutes, hours, days)
   * - Number format: seconds
   * - Default: '30d' (30 days)
   */
  expiresIn?: string | number;
};
