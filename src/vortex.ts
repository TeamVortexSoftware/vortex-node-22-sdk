import crypto from 'node:crypto';
import { stringify as uuidStringify } from 'uuid';
import { ApiRequestBody, ApiResponseJson, InvitationResult, AcceptInvitationRequest, User } from './types';

export class Vortex {
  constructor(private apiKey: string) { }

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
   *     adminScopes: ['autoJoin']
   *   }
   * });
   * ```
   */
  generateJwt(params: { user: User; [key: string]: any }): string {
    const { user, ...rest } = params;
    const [prefix, encodedId, key] = this.apiKey.split('.'); // prefix is just VRTX
    if (!prefix || !encodedId || !key) {
      throw new Error('Invalid API key format');
    }
    if (prefix !== 'VRTX') {
      throw new Error('Invalid API key prefix');
    }
    const id = uuidStringify(Buffer.from(encodedId, 'base64url'));

    const expires = Math.floor(Date.now() / 1000) + 3600;

    // 🔐 Step 1: Derive signing key from API key + ID
    const signingKey = crypto.createHmac('sha256', key).update(id).digest(); // <- raw Buffer

    // 🧱 Step 2: Build header + payload
    const header = {
      iat: Math.floor(Date.now() / 1000),
      alg: 'HS256',
      typ: 'JWT',
      kid: id,
    };

    // Build payload with user data
    const payload: any = {
      userId: user.id,
      userEmail: user.email,
      expires,
    };

    // Add adminScopes if present
    if (user.adminScopes) {
      payload.adminScopes = user.adminScopes;
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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: ApiRequestBody,
    queryParams?: Record<string, string | number | boolean>,
  }): Promise<ApiResponseJson> {
    const { method, path, body, queryParams } = options;
    const url = new URL(`${process.env.VORTEX_API_BASE_URL || 'https://api.vortexsoftware.com'}${path}`);
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
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!results.ok) {
      const errorBody = await results.text();
      throw new Error(`Vortex API request failed: ${results.status} ${results.statusText} - ${errorBody}`);
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

  async getInvitationsByTarget(targetType: 'email' | 'username' | 'phoneNumber', targetValue: string): Promise<InvitationResult[]> {
    const response = await this.vortexApiRequest({
      method: 'GET',
      path: '/api/v1/invitations?targetType',
      queryParams: {
        targetType,
        targetValue,
      }
    }) as { invitations: InvitationResult[] };
    return response.invitations;
  }

  async getInvitation(invitationId: string): Promise<InvitationResult> {
    return this.vortexApiRequest({
      method: 'GET',
      path: `/api/v1/invitations/${invitationId}`,
    }) as Promise<InvitationResult>;
  }

  async revokeInvitation(invitationId: string): Promise<{}> {
    return this.vortexApiRequest({
      method: 'DELETE',
      path: `/api/v1/invitations/${invitationId}`,
    }) as Promise<{}>;
  }

  async acceptInvitations(
    invitationIds: string[],
    target: { type: 'email' | 'username' | 'phoneNumber'; value: string }
  ): Promise<InvitationResult> {
    const response = await this.vortexApiRequest({
      method: 'POST',
      body: {
        invitationIds,
        target,
      } as AcceptInvitationRequest,
      path: `/api/v1/invitations/accept`,
    }) as InvitationResult;
    return response;
  }

  async deleteInvitationsByGroup(groupType: string, groupId: string): Promise<{}> {
    return this.vortexApiRequest({
      method: 'DELETE',
      path: `/api/v1/invitations/by-group/${groupType}/${groupId}`,
    }) as Promise<{}>;
  }

  async getInvitationsByGroup(groupType: string, groupId: string): Promise<InvitationResult[]> {
    const response = await this.vortexApiRequest({
      method: 'GET',
      path: `/api/v1/invitations/by-group/${groupType}/${groupId}`,
    }) as { invitations: InvitationResult[] };
    return response.invitations;
  }

  async reinvite(invitationId: string): Promise<InvitationResult> {
    return this.vortexApiRequest({
      method: 'POST',
      path: `/api/v1/invitations/${invitationId}/reinvite`,
    }) as Promise<InvitationResult>;
  }
}