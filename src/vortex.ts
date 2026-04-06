import crypto from 'node:crypto';
import { stringify as uuidStringify } from 'uuid';
import {
  ApiRequestBody,
  ApiResponseJson,
  InvitationResult,
  InvitationResultBase,
  AcceptInvitationRequest,
  User,
  AcceptUser,
  AutojoinDomainsResponse,
  ConfigureAutojoinRequest,
  InvitationTarget,
  CreateInvitationRequest,
  CreateInvitationResponse,
  SyncInternalInvitationRequest,
  SyncInternalInvitationResponse,
} from './types';

// SDK identification for request tracking
// __SDK_VERSION__ is injected at build time by tsup (see tsup.config.ts)
declare const __SDK_VERSION__: string;
const SDK_NAME = 'vortex-node-sdk';
const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : '0.8.2';

/**
 * Transform an InvitationScope from API wire format to SDK format.
 * Adds scopeId as a preferred alias for groupId.
 */
function transformScope<T>(scope: T): T {
  if (!scope || typeof scope !== 'object') return scope;
  return {
    ...(scope as any),
    scopeId: (scope as any).groupId,
  } as T;
}

/**
 * Transform an invitation result from API wire format to SDK format.
 * Adds scopes as a preferred alias for groups, with scopeId on each element.
 */
function transformInvitationResult<T>(result: T): T {
  if (!result || typeof result !== 'object') return result;
  const transformed = { ...result } as any;
  if (Array.isArray(transformed.groups)) {
    const mappedScopes = transformed.groups.map(transformScope);
    transformed.scopes = mappedScopes;
    transformed.groups = mappedScopes;
  }
  return transformed as T;
}

/**
 * Transform an array of invitation results.
 */
function transformInvitationResults<T>(results: T[]): T[] {
  return results.map(transformInvitationResult);
}

/**
 * Transform a create invitation request from SDK format to API wire format.
 * Maps scopes -> groups and scopeId -> groupId for the API.
 */
function transformCreateRequest(params: Record<string, any>): Record<string, any> {
  const transformed = { ...params };

  // Preferred: flat scopeId/scopeType/scopeName params (single scope)
  if (transformed.scopeId && !transformed.groups && !transformed.scopes) {
    transformed.groups = [
      {
        groupId: transformed.scopeId,
        type: transformed.scopeType,
        name: transformed.scopeName,
      },
    ];
  }
  delete transformed.scopeId;
  delete transformed.scopeType;
  delete transformed.scopeName;

  // Legacy: array-based scopes -> groups
  if (transformed.scopes && !transformed.groups) {
    transformed.groups = transformed.scopes;
  }
  delete transformed.scopes;

  // Map scopeId -> groupId in each scope object (if someone used scopeId in array form)
  if (Array.isArray(transformed.groups)) {
    transformed.groups = transformed.groups.map((g: any) => {
      const { scopeId, ...rest } = g;
      return {
        ...rest,
        groupId: rest.groupId || scopeId,
      };
    });
  }
  return transformed;
}

export class Vortex {
  constructor(private apiKey: string) {}

  /**
   * Parse the API key into its components (kid and raw key).
   * API key format: VRTX.<base64url-encoded-uuid>.<key>
   */
  private parseApiKey(): { kid: string; key: string } {
    const [prefix, encodedId, key] = this.apiKey.split('.');
    if (!prefix || !encodedId || !key) {
      throw new Error('Invalid API key format');
    }
    if (prefix !== 'VRTX') {
      throw new Error('Invalid API key prefix');
    }
    const kid = uuidStringify(Buffer.from(encodedId, 'base64url'));
    return { kid, key };
  }

  /**
   * Derive the signing key from the API key components.
   * signingKey = HMAC-SHA256(key, kid)
   */
  private deriveSigningKey(key: string, kid: string): Buffer {
    return crypto.createHmac('sha256', key).update(kid).digest();
  }

  /**
   * Build the canonical user payload from a User object.
   * This produces the same shape as UnsignedData (userId, userEmail, etc.)
   * with keys sorted alphabetically for cross-language consistency.
   */
  private buildCanonicalPayload(user: User): Record<string, any> {
    const payload: Record<string, any> = {
      userId: user.id,
    };

    if (user.email) {
      payload.userEmail = user.email;
    }

    // Prefer new property names (name/avatarUrl), fall back to deprecated (userName/userAvatarUrl)
    const userName = user.name ?? user.userName;
    const userAvatarUrl = user.avatarUrl ?? user.userAvatarUrl;

    if (userName) {
      payload.name = userName;
    }

    if (userAvatarUrl) {
      payload.avatarUrl = userAvatarUrl;
    }

    if (user.adminScopes && user.adminScopes.length > 0) {
      payload.adminScopes = user.adminScopes;
    }

    if (user.allowedEmailDomains && user.allowedEmailDomains.length > 0) {
      payload.allowedEmailDomains = user.allowedEmailDomains;
    }

    // Include any additional custom properties
    const knownKeys = new Set([
      'id',
      'email',
      'name',
      'avatarUrl',
      'userName',
      'userAvatarUrl',
      'adminScopes',
      'allowedEmailDomains',
    ]);
    for (const [k, v] of Object.entries(user)) {
      if (!knownKeys.has(k) && v !== undefined) {
        payload[k] = v;
      }
    }

    // Sort keys for canonical JSON (cross-language determinism)
    const sorted: Record<string, any> = {};
    for (const k of Object.keys(payload).sort()) {
      sorted[k] = payload[k];
    }
    return sorted;
  }

  /**
   * Recursively canonicalize a value by sorting object keys at all levels.
   * This avoids using the `replacer` array parameter of JSON.stringify,
   * which would otherwise filter out nested properties.
   */
  private static canonicalizeValue(value: any): any {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Handle objects with toJSON (e.g., Date) — mirrors JSON.stringify behavior
    if (typeof value.toJSON === 'function') {
      return Vortex.canonicalizeValue(value.toJSON());
    }

    if (Array.isArray(value)) {
      return value.map((item) => Vortex.canonicalizeValue(item));
    }

    // Use null-prototype object to prevent prototype pollution via __proto__ keys
    const result: Record<string, any> = Object.create(null);
    const keys = Object.keys(value).sort();

    for (const key of keys) {
      // Skip dangerous prototype keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      const v = (value as Record<string, any>)[key];
      if (typeof v === 'undefined' || typeof v === 'function' || typeof v === 'symbol') {
        continue;
      }
      result[key] = Vortex.canonicalizeValue(v);
    }

    return result;
  }

  /**
   * Produce the canonical JSON string for a user payload.
   * Keys are sorted alphabetically at all nesting levels and no extra
   * whitespace is used. This must match across all SDKs and the backend
   * verifier.
   */
  static canonicalJson(obj: Record<string, any>): string {
    const canonical = Vortex.canonicalizeValue(obj);
    return JSON.stringify(canonical);
  }

  /**
   * Sign a user object for use with the `signature` widget prop.
   *
   * The returned string should be passed as the `signature` prop alongside
   * the `user` prop on VortexInvite (or other widget components). The widget
   * and backend handle everything else.
   *
   * @param user - User object (same shape as generateJwt)
   * @returns Signature string in `kid:hexDigest` format
   *
   * @example
   * ```typescript
   * const vortex = new Vortex(process.env.VORTEX_API_KEY);
   * const signature = vortex.sign({ id: 'user-123', email: 'user@example.com' });
   * // Pass to frontend:
   * // <VortexInvite user={{ userId: 'user-123', userEmail: 'user@example.com' }} signature={signature} />
   * ```
   */
  sign(user: User): string {
    if (!user.id && !(user as any).userId) {
      throw new Error('userId (or id) is required for signing');
    }
    const { kid, key } = this.parseApiKey();
    const signingKey = this.deriveSigningKey(key, kid);
    const canonical = this.buildCanonicalPayload(user);
    const data = Vortex.canonicalJson(canonical);
    const digest = crypto.createHmac('sha256', signingKey).update(data).digest('hex');
    return `${kid}:${digest}`;
  }

  /**
   * Generate a JWT token for a user
   *
   * @param params - Object containing user and optional additional properties
   * @param params.user - User object with id, email, and optional adminScopes
   * @returns JWT token string
   *
   * @example
   * ```typescript
   * const token = vortex.generateJwt({
   *   user: {
   *     id: "user-123",
   *     email: "user@example.com",
   *     adminScopes: ['autojoin']
   *   }
   * });
   * ```
   */
  generateJwt(params: { user: User; [key: string]: any }): string {
    const { user, ...rest } = params;
    const { kid, key } = this.parseApiKey();

    const expires = Math.floor(Date.now() / 1000) + 3600;

    // 🔐 Step 1: Derive signing key from API key + ID
    const signingKey = this.deriveSigningKey(key, kid);

    // 🧱 Step 2: Build header + payload
    const header = {
      iat: Math.floor(Date.now() / 1000),
      alg: 'HS256',
      typ: 'JWT',
      kid,
    };

    // Build payload with user data
    const payload: any = {
      userId: user.id,
      userEmail: user.email,
      expires,
      // Include identifiers array for widget compatibility (VrtxAutojoin checks this)
      identifiers: user.email ? [{ type: 'email', value: user.email }] : [],
    };

    // Add name if present (prefer new property, fall back to deprecated)
    const userName = user.name ?? user.userName;
    if (userName) {
      payload.name = userName;
    }

    // Add avatarUrl if present (prefer new property, fall back to deprecated)
    const userAvatarUrl = user.avatarUrl ?? user.userAvatarUrl;
    if (userAvatarUrl) {
      payload.avatarUrl = userAvatarUrl;
    }

    // Add adminScopes if present
    if (user.adminScopes && user.adminScopes.length > 0) {
      payload.adminScopes = user.adminScopes;
      // Add widget compatibility fields for autojoin admin
      if (user.adminScopes.includes('autojoin')) {
        payload.userIsAutojoinAdmin = true;
        payload.role = 'admin'; // VrtxAutojoin checks parsedJwt.role === 'admin'
      }
    }

    // Add allowedEmailDomains if present (for domain-restricted invitations)
    if (user.allowedEmailDomains && user.allowedEmailDomains.length > 0) {
      payload.allowedEmailDomains = user.allowedEmailDomains;
    }

    // Add any additional properties from rest
    if (rest && Object.keys(rest).length > 0) {
      Object.assign(payload, rest);
    }

    // 🧱 Step 3: Base64URL encode
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // 🧾 Step 4: Sign
    const toSign = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(
      crypto.createHmac('sha256', signingKey).update(toSign).digest()
    ).toString('base64url');
    const jwt = `${toSign}.${signature}`;
    return jwt;
  }

  async vortexApiRequest(options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body?: ApiRequestBody;
    queryParams?: Record<string, string | number | boolean>;
  }): Promise<ApiResponseJson> {
    const { method, path, body, queryParams } = options;
    const url = new URL(
      `${process.env.VORTEX_API_BASE_URL || 'https://api.vortexsoftware.com'}${path}`
    );
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    const results = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'x-vortex-sdk-name': SDK_NAME,
        'x-vortex-sdk-version': SDK_VERSION,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!results.ok) {
      const errorBody = await results.text();
      throw new Error(
        `Vortex API request failed: ${results.status} ${results.statusText} - ${errorBody}`
      );
    }

    // Check if response has content to parse
    const contentLength = results.headers.get('content-length');
    const contentType = results.headers.get('content-type');

    // If no content or content-length is 0, return empty object
    if (contentLength === '0' || (!contentType?.includes('application/json') && !contentLength)) {
      return {};
    }

    // Try to get text first to check if there's actually content
    const responseText = await results.text();
    if (!responseText.trim()) {
      return {};
    }

    // Parse JSON if there's content
    try {
      return JSON.parse(responseText);
    } catch (error) {
      // If JSON parsing fails, return the text or empty object
      return {};
    }
  }

  async getInvitationsByTarget(
    targetType: 'email' | 'username' | 'phoneNumber',
    targetValue: string
  ): Promise<InvitationResultBase[]> {
    const response = (await this.vortexApiRequest({
      method: 'GET',
      path: '/api/v1/invitations',
      queryParams: {
        targetType,
        targetValue,
      },
    })) as { invitations: InvitationResultBase[] };
    return transformInvitationResults(response.invitations);
  }

  async getInvitation(invitationId: string): Promise<InvitationResult> {
    const result = await this.vortexApiRequest({
      method: 'GET',
      path: `/api/v1/invitations/${invitationId}`,
    });
    return transformInvitationResult(result as InvitationResult);
  }

  async revokeInvitation(invitationId: string): Promise<{}> {
    return this.vortexApiRequest({
      method: 'DELETE',
      path: `/api/v1/invitations/${invitationId}`,
    }) as Promise<{}>;
  }

  /**
   * Accept invitations using the new User format (preferred)
   * @param invitationIds - Array of invitation IDs to accept
   * @param user - User object with email or phone (and optional name)
   * @returns Invitation result
   * @example
   * ```typescript
   * await vortex.acceptInvitations(['inv-123'], { email: 'user@example.com', name: 'John' });
   * ```
   */
  async acceptInvitations(invitationIds: string[], user: AcceptUser): Promise<InvitationResult>;

  /**
   * Accept invitations using legacy target format (deprecated)
   * @deprecated Use the User format instead: acceptInvitations(invitationIds, { email: 'user@example.com' })
   * @param invitationIds - Array of invitation IDs to accept
   * @param target - Legacy target object with type and value
   * @returns Invitation result
   */
  async acceptInvitations(
    invitationIds: string[],
    target: InvitationTarget
  ): Promise<InvitationResult>;

  /**
   * Accept invitations using multiple legacy targets (deprecated)
   * Will call the accept endpoint once per target
   * @deprecated Use the User format instead: acceptInvitations(invitationIds, { email: 'user@example.com' })
   * @param invitationIds - Array of invitation IDs to accept
   * @param targets - Array of legacy target objects
   * @returns Invitation result from the last acceptance
   */
  async acceptInvitations(
    invitationIds: string[],
    targets: InvitationTarget[]
  ): Promise<InvitationResult>;

  // Implementation
  async acceptInvitations(
    invitationIds: string[],
    userOrTarget: AcceptUser | InvitationTarget | InvitationTarget[]
  ): Promise<InvitationResult> {
    // Handle array of targets (legacy, call once per target)
    if (Array.isArray(userOrTarget)) {
      console.warn(
        '[Vortex SDK] DEPRECATED: Passing an array of targets is deprecated. Use the User format instead: acceptInvitations(invitationIds, { email: "user@example.com" })'
      );
      let lastResult: InvitationResult | undefined;
      for (const target of userOrTarget) {
        lastResult = await this.acceptInvitations(invitationIds, target);
      }
      if (!lastResult) {
        throw new Error('No targets provided');
      }
      return lastResult;
    }

    // Check if it's a legacy target format (has 'type' and 'value' properties)
    const isLegacyTarget = 'type' in userOrTarget && 'value' in userOrTarget;

    if (isLegacyTarget) {
      console.warn(
        '[Vortex SDK] DEPRECATED: Passing a target object is deprecated. Use the User format instead: acceptInvitations(invitationIds, { email: "user@example.com" })'
      );

      // Convert target to User format
      const target = userOrTarget as InvitationTarget;
      const user: AcceptUser = {};

      if (target.type === 'email') {
        user.email = target.value;
      } else if (target.type === 'phone') {
        user.phone = target.value;
      } else {
        throw new Error(`Unsupported target type for accept: ${target.type}`);
      }

      // Make request with User format
      const response = (await this.vortexApiRequest({
        method: 'POST',
        body: {
          invitationIds,
          user,
        } as AcceptInvitationRequest,
        path: `/api/v1/invitations/accept`,
      })) as InvitationResult;
      return transformInvitationResult(response);
    }

    // New User format
    const user = userOrTarget as AcceptUser;

    // Validate that either email or phone is provided
    if (!user.email && !user.phone) {
      throw new Error('User must have either email or phone');
    }

    const response = (await this.vortexApiRequest({
      method: 'POST',
      body: {
        invitationIds,
        user,
      } as AcceptInvitationRequest,
      path: `/api/v1/invitations/accept`,
    })) as InvitationResult;
    return transformInvitationResult(response);
  }

  /**
   * Accept a single invitation
   * This is the recommended method for accepting invitations.
   * @param invitationId - Single invitation ID to accept
   * @param user - User object with email or phone (and optional name)
   * @returns Invitation result
   * @example
   * ```typescript
   * await vortex.acceptInvitation('inv-123', { email: 'user@example.com', name: 'John' });
   * ```
   */
  async acceptInvitation(invitationId: string, user: AcceptUser): Promise<InvitationResult> {
    return this.acceptInvitations([invitationId], user);
  }

  /**
   * @deprecated Use deleteInvitationsByScope instead
   */
  async deleteInvitationsByGroup(groupType: string, groupId: string): Promise<{}> {
    return this.deleteInvitationsByScope(groupType, groupId);
  }

  /**
   * @deprecated Use getInvitationsByScope instead
   */
  async getInvitationsByGroup(groupType: string, groupId: string): Promise<InvitationResult[]> {
    return this.getInvitationsByScope(groupType, groupId);
  }

  /**
   * Delete all invitations for a specific scope
   * @param scopeType - The type of scope (e.g., "team", "organization")
   * @param scope - The scope identifier (customer's scope ID)
   * @returns Empty object
   */
  async deleteInvitationsByScope(scopeType: string, scope: string): Promise<{}> {
    return this.vortexApiRequest({
      method: 'DELETE',
      path: `/api/v1/invitations/by-scope/${scopeType}/${scope}`,
    }) as Promise<{}>;
  }

  /**
   * Get all invitations for a specific scope
   * @param scopeType - The type of scope (e.g., "team", "organization")
   * @param scope - The scope identifier (customer's scope ID)
   * @returns Array of invitation results
   */
  async getInvitationsByScope(scopeType: string, scope: string): Promise<InvitationResult[]> {
    const response = (await this.vortexApiRequest({
      method: 'GET',
      path: `/api/v1/invitations/by-scope/${scopeType}/${scope}`,
    })) as { invitations: InvitationResult[] };
    return transformInvitationResults(response.invitations);
  }

  async reinvite(invitationId: string): Promise<InvitationResult> {
    const result = await this.vortexApiRequest({
      method: 'POST',
      path: `/api/v1/invitations/${invitationId}/reinvite`,
    });
    return transformInvitationResult(result as InvitationResult);
  }

  /**
   * Get autojoin domains configured for a specific scope
   *
   * @param scopeType - The type of scope (e.g., "organization", "team", "project")
   * @param scope - The scope identifier (customer's group ID)
   * @returns Autojoin domains and associated invitation
   *
   * @example
   * ```typescript
   * const result = await vortex.getAutojoinDomains('organization', 'acme-org');
   * console.log(result.autojoinDomains); // [{ id: '...', domain: 'acme.com' }]
   * ```
   */
  async getAutojoinDomains(scopeType: string, scope: string): Promise<AutojoinDomainsResponse> {
    return this.vortexApiRequest({
      method: 'GET',
      path: `/api/v1/invitations/by-scope/${encodeURIComponent(scopeType)}/${encodeURIComponent(scope)}/autojoin`,
    }) as Promise<AutojoinDomainsResponse>;
  }

  /**
   * Configure autojoin domains for a specific scope
   *
   * This endpoint syncs autojoin domains - it will add new domains, remove domains
   * not in the provided list, and deactivate the autojoin invitation if all domains
   * are removed (empty array).
   *
   * @param params - Configuration parameters
   * @param params.scope - The scope identifier (customer's group ID)
   * @param params.scopeType - The type of scope (e.g., "organization", "team")
   * @param params.scopeName - Optional display name for the scope
   * @param params.domains - Array of domains to configure for autojoin
   * @param params.widgetId - The widget configuration ID
   * @returns Updated autojoin domains and associated invitation
   *
   * @example
   * ```typescript
   * const result = await vortex.configureAutojoin({
   *   scope: 'acme-org',
   *   scopeType: 'organization',
   *   scopeName: 'Acme Corporation',
   *   domains: ['acme.com', 'acme.org'],
   *   widgetId: 'widget-123',
   * });
   * ```
   */
  async configureAutojoin(params: ConfigureAutojoinRequest): Promise<AutojoinDomainsResponse> {
    const response = (await this.vortexApiRequest({
      method: 'POST',
      path: '/api/v1/invitations/autojoin',
      body: params as unknown as ApiRequestBody,
    })) as AutojoinDomainsResponse;
    if (response.invitation) {
      response.invitation = transformInvitationResult(response.invitation);
    }
    return response;
  }

  /**
   * Create an invitation from your backend
   *
   * This method allows you to create invitations programmatically using your API key,
   * without requiring a user JWT token. This is useful for server-side invitation
   * creation, such as "People You May Know" flows or admin-initiated invitations.
   *
   * @param params - Invitation parameters
   * @param params.widgetConfigurationId - The widget configuration ID to use
   * @param params.target - The target of the invitation (who is being invited)
   * @param params.target.type - 'email', 'phone', or 'internal'
   * @param params.target.value - Email address, phone number, or internal user ID
   * @param params.inviter - Information about the user creating the invitation
   * @param params.inviter.userId - Your internal user ID for the inviter
   * @param params.inviter.userEmail - Optional email of the inviter
   * @param params.inviter.name - Optional display name of the inviter
   * @param params.scopeId - The scope ID in your system (preferred)
   * @param params.scopeType - The scope type (e.g., "team", "organization")
   * @param params.scopeName - The display name of the scope
   * @param params.scopes - @deprecated Use scopeId/scopeType/scopeName instead
   * @param params.groups - @deprecated Use scopeId/scopeType/scopeName instead
   * @param params.source - Optional source for analytics (defaults to 'api')
   * @param params.subtype - Optional subtype for analytics segmentation (e.g., 'pymk', 'find-friends')
   * @param params.templateVariables - Optional template variables for email customization
   * @param params.metadata - Optional metadata passed through to webhooks
   * @param params.unfurlConfig - Optional link unfurl (Open Graph) configuration
   * @returns Created invitation with ID, short link, status, and creation timestamp
   *
   * @example
   * ```typescript
   * // Create an email invitation with custom link preview
   * const invitation = await vortex.createInvitation({
   *   widgetConfigurationId: 'widget-config-123',
   *   target: { type: 'email', value: 'invitee@example.com' },
   *   inviter: { userId: 'user-456', userEmail: 'inviter@example.com', name: 'John Doe' },
   *   scopeId: 'team-789',
   *   scopeType: 'team',
   *   scopeName: 'Engineering',
   *   unfurlConfig: {
   *     title: 'Join the Engineering team!',
   *     description: 'John Doe invited you to collaborate on Engineering',
   *     image: 'https://example.com/og-image.png',
   *     type: 'website',
   *     siteName: 'Acme App',
   *   },
   * });
   *
   * // Create an internal invitation (PYMK flow - no email sent)
   * // Use subtype for analytics segmentation
   * const pymkInvitation = await vortex.createInvitation({
   *   widgetConfigurationId: 'widget-config-123',
   *   target: { type: 'internal', value: 'internal-user-id-abc' },
   *   inviter: { userId: 'user-456' },
   *   source: 'internal',
   *   subtype: 'pymk', // Track this as a "People You May Know" invitation
   * });
   * ```
   */
  async createInvitation(params: CreateInvitationRequest): Promise<CreateInvitationResponse> {
    const transformedParams = transformCreateRequest(params);
    return this.vortexApiRequest({
      method: 'POST',
      path: '/api/v1/invitations',
      body: transformedParams as unknown as ApiRequestBody,
    }) as Promise<CreateInvitationResponse>;
  }

  /**
   * Sync an internal invitation action (accept or decline)
   *
   * This method notifies Vortex that an internal invitation was accepted or declined
   * within your application, so Vortex can update the invitation status accordingly.
   *
   * @param params - Sync parameters
   * @param params.creatorId - The inviter's user ID
   * @param params.targetValue - The invitee's user ID
   * @param params.action - The action taken: "accepted" or "declined"
   * @param params.componentId - The widget component UUID
   * @returns Object with processed count and invitation IDs
   *
   * @example
   * ```typescript
   * const result = await vortex.syncInternalInvitation({
   *   creatorId: 'user-123',
   *   targetValue: 'user-456',
   *   action: 'accepted',
   *   componentId: 'component-uuid-789',
   * });
   * console.log(`Processed ${result.processed} invitations`);
   * ```
   */
  async syncInternalInvitation(
    params: SyncInternalInvitationRequest
  ): Promise<SyncInternalInvitationResponse> {
    return this.vortexApiRequest({
      method: 'POST',
      path: '/api/v1/invitations/sync-internal-invitation',
      body: params as unknown as ApiRequestBody,
    }) as Promise<SyncInternalInvitationResponse>;
  }
}
