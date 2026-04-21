# @teamvortexsoftware/vortex-node-22-sdk

<!-- AUTO-GENERATED FROM SDK MANIFEST — DO NOT EDIT DIRECTLY -->

![Version](https://img.shields.io/badge/version-0.20.0-blue)
![Language](https://img.shields.io/badge/language-typescript-green)

**Invitation infrastructure for modern apps**

Vortex handles the complete invitation lifecycle — sending invites via email/SMS/share links, tracking clicks and conversions, managing referral programs, and optimizing your invitation flows with A/B testing. You focus on your product; Vortex handles the growth mechanics.
[Learn more about Vortex →](https://tryvortex.com)

## Why This SDK?

This backend SDK securely signs user data for Vortex components. Your API key stays on your server, while the signed token is passed to the frontend where Vortex components render the invitation UI.

- Keep your API key secure — it never touches the browser
- Sign user identity for attribution — know who sent each invitation
- Control what data components can access via scoped tokens
- Verify webhook signatures for secure event handling

## How It Works

Vortex uses a split architecture: your backend signs tokens with the SDK, and your frontend renders components that use those tokens to securely interact with Vortex.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Server   │     │  User Browser   │     │  Vortex Cloud   │
│    (this SDK)   │     │   (component)   │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. generateToken()   │                       │
         │◄──────────────────────│                       │
         │                       │                       │
         │  2. Return token      │                       │
         │──────────────────────►│                       │
         │                       │                       │
         │                       │  3. Component calls   │
         │                       │     API with token    │
         │                       │──────────────────────►│
         │                       │                       │
         │                       │  4. Render UI,        │
         │                       │     send invitations  │
         │                       │◄──────────────────────│
         │                       │                       │
```

### Integration Flow

**1. Install the backend SDK** `[backend]`

Add this SDK to your Node.js server

```typescript
npm install @teamvortexsoftware/vortex-node-22-sdk
```

**2. Initialize the client** `[backend]`

Create a Vortex client with your API key (keep this on the server!)

```typescript
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';

const vortex = new Vortex(process.env.VORTEX_API_KEY);
```

**3. Generate a token for the current user** `[backend]`

When a user loads a page with a Vortex component, generate a signed token on your server

```typescript
const token = vortex.generateToken({ user: { id: currentUser.id } });
```

**4. Pass the token to your frontend** `[backend]`

Include the token in your page response or API response

```typescript
res.json({ vortexToken: token, ...otherData });
```

**5. Render a Vortex component with the token** `[frontend]`

Use the React/Angular/Web Component with the token

```typescript
import { VortexInvite } from '@teamvortexsoftware/vortex-react';

<VortexInvite token={vortexToken} />
```

**6. Vortex handles the rest** `[vortex]`

The component securely communicates with Vortex servers, displays the invitation UI, sends emails/SMS, tracks conversions, and reports analytics

### Security Model

> ⚠️ **Important:** Your Vortex API key is a secret that grants full access to your account. It must never be exposed to browsers or client-side code.

By signing tokens on your server, you:

- Keep your API key secret (it never leaves your server)
- Control exactly what user data is shared with components
- Ensure invitations are attributed to real, authenticated users
- Prevent abuse — users can only send invitations as themselves

#### When Signing is Optional

Token signing is controlled by your component configuration in the Vortex dashboard. If "Require Secure Token" is enabled, requests without a valid token will be rejected. If disabled (e.g., for public referral programs), components work without backend signing. The SDK is still useful for server-side operations like verifying webhooks regardless of this setting.

---

## Quick Start

Generate a secure token for Vortex components

```typescript
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';

const vortex = new Vortex(process.env.VORTEX_API_KEY!);

// Generate a token for the current user
const token = vortex.generateToken({
  user: { id: 'user-123', email: 'user@example.com' },
});

// Pass the token to your frontend component
// <VortexInvite token={token} />
```

## Installation

```bash
npm install @teamvortexsoftware/vortex-node-22-sdk
```

<details>
<summary>Other package managers</summary>

**yarn:**

```bash
yarn add @teamvortexsoftware/vortex-node-22-sdk
```

**pnpm:**

```bash
pnpm add @teamvortexsoftware/vortex-node-22-sdk
```

</details>

## Initialization

```typescript
const client = new Vortex(process.env.VORTEX_API_KEY!);
```

### Environment Variables

| Variable         | Required | Description         |
| ---------------- | -------- | ------------------- |
| `VORTEX_API_KEY` | ✓        | Your Vortex API key |

## Core Methods

These are the methods you'll use most often.

### `generateToken()`

Sign a payload for use with Vortex widgets

This method generates a signed JWT token containing your payload data.
The token can be passed to widgets via the `token` prop to authenticate
and authorize the request.

**Signature:**

```typescript
generateToken(payload: GenerateTokenData, options?: GenerateTokenOptions | undefined): string
```

**Parameters:**

| Name      | Type                                | Required | Description                                       |
| --------- | ----------------------------------- | -------- | ------------------------------------------------- |
| `payload` | `GenerateTokenData`                 | ✓        | Data to sign (user, component, scope, vars, etc.) |
| `options` | `GenerateTokenOptions \| undefined` |          | Optional configuration (expiresIn)                |

**Returns:** `string`
— Signed JWT token string

**Example:**

```typescript
// --- Backend (Node.js/Express) ---
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';

const vortex = new Vortex(process.env.VORTEX_API_KEY);

app.get('/api/invite-token', (req, res) => {
  const token = vortex.generateToken({
    user: { id: req.user.id, email: req.user.email }
  });
  res.json({ token });
});

// --- Frontend (React) ---
import { VortexInvite } from '@teamvortexsoftware/vortex-react';

function InvitePage() {
  const { data } = useFetch('/api/invite-token');
  return <VortexInvite token={data.token} />;
}
```

_Added in v0.8.0_

---

### `getInvitation()`

Get a single invitation by ID

**Signature:**

```typescript
getInvitation(invitationId: string): Promise<InvitationResult>
```

**Parameters:**

| Name           | Type     | Required | Description                   |
| -------------- | -------- | -------- | ----------------------------- |
| `invitationId` | `string` | ✓        | The invitation ID to retrieve |

**Returns:** `Promise<InvitationResult>`
— The invitation details

**Example:**

```typescript
const invitation = await vortex.getInvitation('inv-123');
console.log(invitation.status);
```

_Added in v0.1.0_

---

### `acceptInvitation()`

Accept a single invitation
This is the recommended method for accepting invitations.

**Signature:**

```typescript
acceptInvitation(invitationId: string, user: AcceptUser): Promise<InvitationResult>
```

**Parameters:**

| Name           | Type         | Required | Description                                         |
| -------------- | ------------ | -------- | --------------------------------------------------- |
| `invitationId` | `string`     | ✓        | Single invitation ID to accept                      |
| `user`         | `AcceptUser` | ✓        | User object with email or phone (and optional name) |

**Returns:** `Promise<InvitationResult>`
— Invitation result

**Example:**

```typescript
await vortex.acceptInvitation('inv-123', { email: 'user@example.com', name: 'John' });
```

_Added in v0.6.0_

---

## All Methods

<details>
<summary>Click to expand full method reference</summary>

### `generateJwt()`

Generate a JWT token for a user

**Signature:**

```typescript
generateJwt(params: { [key: string]: any; user: User; }, options?: GenerateJwtOptions | undefined): string
```

**Parameters:**

| Name      | Type                                  | Required | Description                                               |
| --------- | ------------------------------------- | -------- | --------------------------------------------------------- |
| `params`  | `{ [key: string]: any; user: User; }` | ✓        | Object containing user and optional additional properties |
| `options` | `GenerateJwtOptions \| undefined`     |          | Optional configuration (expiresIn)                        |

**Returns:** `string`
— JWT token string

**Example:**

```typescript
const token = vortex.generateJwt({
  user: {
    id: 'user-123',
    email: 'user@example.com',
    adminScopes: ['autojoin'],
  },
});

// With custom expiration
const tokenWithCustomExpiry = vortex.generateJwt(
  { user: { id: 'user-123', email: 'user@example.com' } },
  { expiresIn: '24h' } // Custom expiration (default: 30 days)
);
```

_Added in v0.3.0_

---

### `getInvitationsByTarget()`

Get invitations by target (email, username, or phone number)

**Signature:**

```typescript
getInvitationsByTarget(targetType: "email" | "username" | "phoneNumber", targetValue: string): Promise<InvitationResultBase[]>
```

**Parameters:**

| Name          | Type                                     | Required | Description                    |
| ------------- | ---------------------------------------- | -------- | ------------------------------ |
| `targetType`  | `"email" \| "username" \| "phoneNumber"` | ✓        | The type of target identifier  |
| `targetValue` | `string`                                 | ✓        | The target value to search for |

**Returns:** `Promise<InvitationResultBase[]>`
— Array of invitation results matching the target

**Example:**

```typescript
const invitations = await vortex.getInvitationsByTarget('email', 'user@example.com');
```

_Added in v0.1.0_

---

### `revokeInvitation()`

Revoke (delete) an invitation

**Signature:**

```typescript
revokeInvitation(invitationId: string): Promise<{}>
```

**Parameters:**

| Name           | Type     | Required | Description                 |
| -------------- | -------- | -------- | --------------------------- |
| `invitationId` | `string` | ✓        | The invitation ID to revoke |

**Returns:** `Promise<{}>`
— Empty object on success

**Example:**

```typescript
await vortex.revokeInvitation('inv-123');
```

_Added in v0.1.0_

---

### `acceptInvitations()`

Accept one or more invitations for a user

**Signature:**

```typescript
acceptInvitations(invitationIds: string[], userOrTarget: AcceptUser | InvitationTarget | InvitationTarget[]): Promise<InvitationResult>
```

**Parameters:**

| Name            | Type                                                   | Required | Description                                              |
| --------------- | ------------------------------------------------------ | -------- | -------------------------------------------------------- |
| `invitationIds` | `string[]`                                             | ✓        | Array of invitation IDs to accept                        |
| `userOrTarget`  | `AcceptUser \| InvitationTarget \| InvitationTarget[]` | ✓        | User object with email or phone, or legacy target format |

**Returns:** `Promise<InvitationResult>`
— The accepted invitation result

**Example:**

```typescript
await vortex.acceptInvitations(['inv-123'], { email: 'user@example.com' });
```

_Added in v0.1.0_

---

### `deleteInvitationsByGroup()`

Delete all invitations for a specific group

**Signature:**

```typescript
deleteInvitationsByGroup(groupType: string, groupId: string): Promise<{}>
```

**Parameters:**

| Name        | Type     | Required | Description                                      |
| ----------- | -------- | -------- | ------------------------------------------------ |
| `groupType` | `string` | ✓        | The type of group (e.g., "team", "organization") |
| `groupId`   | `string` | ✓        | The group identifier                             |

**Returns:** `Promise<{}>`
— Empty object

_Added in v0.1.0_ · ⚠️ **Deprecated**: Use deleteInvitationsByScope instead

---

### `getInvitationsByGroup()`

Get all invitations for a specific group

**Signature:**

```typescript
getInvitationsByGroup(groupType: string, groupId: string): Promise<InvitationResult[]>
```

**Parameters:**

| Name        | Type     | Required | Description                                      |
| ----------- | -------- | -------- | ------------------------------------------------ |
| `groupType` | `string` | ✓        | The type of group (e.g., "team", "organization") |
| `groupId`   | `string` | ✓        | The group identifier                             |

**Returns:** `Promise<InvitationResult[]>`
— Array of invitation results

_Added in v0.1.0_ · ⚠️ **Deprecated**: Use getInvitationsByScope instead

---

### `deleteInvitationsByScope()`

Delete all invitations for a specific scope

**Signature:**

```typescript
deleteInvitationsByScope(scopeType: string, scope: string): Promise<{}>
```

**Parameters:**

| Name        | Type     | Required | Description                                      |
| ----------- | -------- | -------- | ------------------------------------------------ |
| `scopeType` | `string` | ✓        | The type of scope (e.g., "team", "organization") |
| `scope`     | `string` | ✓        | The scope identifier (customer's scope ID)       |

**Returns:** `Promise<{}>`
— Empty object

**Example:**

```typescript
await vortex.deleteInvitationsByScope('team', 'team-123');
```

_Added in v0.4.0_

---

### `getInvitationsByScope()`

Get all invitations for a specific scope

**Signature:**

```typescript
getInvitationsByScope(scopeType: string, scope: string): Promise<InvitationResult[]>
```

**Parameters:**

| Name        | Type     | Required | Description                                      |
| ----------- | -------- | -------- | ------------------------------------------------ |
| `scopeType` | `string` | ✓        | The type of scope (e.g., "team", "organization") |
| `scope`     | `string` | ✓        | The scope identifier (customer's scope ID)       |

**Returns:** `Promise<InvitationResult[]>`
— Array of invitation results

**Example:**

```typescript
const invitations = await vortex.getInvitationsByScope('team', 'team-123');
```

_Added in v0.4.0_

---

### `reinvite()`

Resend an invitation (reinvite)

**Signature:**

```typescript
reinvite(invitationId: string): Promise<InvitationResult>
```

**Parameters:**

| Name           | Type     | Required | Description                 |
| -------------- | -------- | -------- | --------------------------- |
| `invitationId` | `string` | ✓        | The invitation ID to resend |

**Returns:** `Promise<InvitationResult>`
— The updated invitation

**Example:**

```typescript
const invitation = await vortex.reinvite('inv-123');
```

_Added in v0.2.0_

---

### `getAutojoinDomains()`

Get autojoin domains configured for a specific scope

**Signature:**

```typescript
getAutojoinDomains(scopeType: string, scope: string): Promise<AutojoinDomainsResponse>
```

**Parameters:**

| Name        | Type     | Required | Description                                                 |
| ----------- | -------- | -------- | ----------------------------------------------------------- |
| `scopeType` | `string` | ✓        | The type of scope (e.g., "organization", "team", "project") |
| `scope`     | `string` | ✓        | The scope identifier (customer's group ID)                  |

**Returns:** `Promise<AutojoinDomainsResponse>`
— Autojoin domains and associated invitation

**Example:**

```typescript
const result = await vortex.getAutojoinDomains('organization', 'acme-org');
console.log(result.autojoinDomains); // [{ id: '...', domain: 'acme.com' }]
```

_Added in v0.6.0_

---

### `configureAutojoin()`

Configure autojoin domains for a specific scope

This endpoint syncs autojoin domains - it will add new domains, remove domains
not in the provided list, and deactivate the autojoin invitation if all domains
are removed (empty array).

**Signature:**

```typescript
configureAutojoin(params: ConfigureAutojoinRequest): Promise<AutojoinDomainsResponse>
```

**Parameters:**

| Name     | Type                       | Required | Description              |
| -------- | -------------------------- | -------- | ------------------------ |
| `params` | `ConfigureAutojoinRequest` | ✓        | Configuration parameters |

**Returns:** `Promise<AutojoinDomainsResponse>`
— Updated autojoin domains and associated invitation

**Example:**

```typescript
const result = await vortex.configureAutojoin({
  scope: 'acme-org',
  scopeType: 'organization',
  scopeName: 'Acme Corporation',
  domains: ['acme.com', 'acme.org'],
  componentId: 'component-123',
});
```

_Added in v0.6.0_

---

### `syncInternalInvitation()`

Sync an internal invitation action (accept or decline)

This method notifies Vortex that an internal invitation was accepted or declined
within your application, so Vortex can update the invitation status accordingly.

**Signature:**

```typescript
syncInternalInvitation(params: SyncInternalInvitationRequest): Promise<SyncInternalInvitationResponse>
```

**Parameters:**

| Name     | Type                            | Required | Description     |
| -------- | ------------------------------- | -------- | --------------- |
| `params` | `SyncInternalInvitationRequest` | ✓        | Sync parameters |

**Returns:** `Promise<SyncInternalInvitationResponse>`
— Object with processed count and invitation IDs

**Example:**

```typescript
const result = await vortex.syncInternalInvitation({
  creatorId: 'user-123',
  targetValue: 'user-456',
  action: 'accepted',
  componentId: 'component-uuid-789',
});
console.log(`Processed ${result.processed} invitations`);
```

_Added in v0.7.0_

---

</details>

## Types

<details>
<summary>Click to expand type definitions</summary>

### `InvitationTarget`

Target recipient of an invitation

| Field       | Type                                          | Required | Description                                            |
| ----------- | --------------------------------------------- | -------- | ------------------------------------------------------ |
| `type`      | `"email" \| "phone" \| "share" \| "internal"` | ✓        | Delivery channel type                                  |
| `value`     | `string`                                      | ✓        | Target address (email, phone number, or share link ID) |
| `name`      | `string \| null \| undefined`                 |          | Display name of the person being invited               |
| `avatarUrl` | `string \| null \| undefined`                 |          | Avatar URL for the person being invited                |

### `ScopeInput`

ScopeInput is used when creating JWTs - represents customer's scope data
Supports both 'id' (legacy) and 'groupId' (preferred) for backward compatibility

| Field     | Type                  | Required | Description                                            |
| --------- | --------------------- | -------- | ------------------------------------------------------ |
| `type`    | `string`              | ✓        | Scope type (e.g., 'team', 'organization', 'workspace') |
| `id`      | `string \| undefined` |          | ⚠️ **Deprecated**: Use scopeId instead                 |
| `scopeId` | `string \| undefined` |          | The scope identifier (preferred)                       |
| `groupId` | `string \| undefined` |          | ⚠️ **Deprecated**: Use scopeId instead                 |
| `name`    | `string`              | ✓        | Display name for the scope                             |

### `GroupInput`

| Field     | Type                  | Required | Description                                            |
| --------- | --------------------- | -------- | ------------------------------------------------------ |
| `type`    | `string`              | ✓        | Scope type (e.g., 'team', 'organization', 'workspace') |
| `id`      | `string \| undefined` |          | ⚠️ **Deprecated**: Use scopeId instead                 |
| `scopeId` | `string \| undefined` |          | The scope identifier (preferred)                       |
| `groupId` | `string \| undefined` |          | ⚠️ **Deprecated**: Use scopeId instead                 |
| `name`    | `string`              | ✓        | Display name for the scope                             |

### `InvitationScope`

InvitationScope represents a scope in API responses
This matches the MemberGroups table structure from the API

| Field       | Type     | Required | Description                              |
| ----------- | -------- | -------- | ---------------------------------------- |
| `id`        | `string` | ✓        | Vortex internal UUID                     |
| `accountId` | `string` | ✓        | Vortex account ID                        |
| `scopeId`   | `string` | ✓        | The customer's scope ID (preferred)      |
| `groupId`   | `string` | ✓        | ⚠️ **Deprecated**: Use scopeId instead   |
| `type`      | `string` | ✓        | Scope type (e.g., 'workspace', 'team')   |
| `name`      | `string` | ✓        | Display name for the scope               |
| `createdAt` | `string` | ✓        | ISO timestamp when the scope was created |

### `InvitationGroup`

| Field       | Type     | Required | Description                              |
| ----------- | -------- | -------- | ---------------------------------------- |
| `id`        | `string` | ✓        | Vortex internal UUID                     |
| `accountId` | `string` | ✓        | Vortex account ID                        |
| `scopeId`   | `string` | ✓        | The customer's scope ID (preferred)      |
| `groupId`   | `string` | ✓        | ⚠️ **Deprecated**: Use scopeId instead   |
| `type`      | `string` | ✓        | Scope type (e.g., 'workspace', 'team')   |
| `name`      | `string` | ✓        | Display name for the scope               |
| `createdAt` | `string` | ✓        | ISO timestamp when the scope was created |

### `InvitationAcceptance`

Record of a user accepting an invitation

| Field        | Type               | Required | Description                                    |
| ------------ | ------------------ | -------- | ---------------------------------------------- |
| `id`         | `string`           | ✓        | Unique acceptance record ID                    |
| `accountId`  | `string`           | ✓        | Vortex account ID                              |
| `acceptedAt` | `string`           | ✓        | ISO timestamp when the invitation was accepted |
| `target`     | `InvitationTarget` | ✓        | The user who accepted the invitation           |

### `InvitationResultBase`

Base invitation result without target information.
Used by endpoints like getInvitationsByTarget where target is already known.

| Field                     | Type                                                                                                             | Required | Description                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                      | `string`                                                                                                         | ✓        | Unique invitation identifier                                                                                           |
| `accountId`               | `string`                                                                                                         | ✓        | Vortex account ID that owns this invitation                                                                            |
| `clickThroughs`           | `number`                                                                                                         | ✓        | Number of times the invitation link was clicked                                                                        |
| `formSubmissionData`      | `Record<string, any> \| null`                                                                                    | ✓        | Invitation form data submitted by the user, including invitee identifiers (such as email addresses, phone numbers, or internal IDs) and the values of any custom fields. |
| `configurationAttributes` | `Record<string, any> \| null`                                                                                    | ✓        | ⚠️ **Deprecated**: Use formSubmissionData instead. This field contains the same data.                                  |
| `attributes`              | `Record<string, any> \| null`                                                                                    | ✓        | Custom attributes attached to this invitation                                                                          |
| `createdAt`               | `string`                                                                                                         | ✓        | ISO timestamp when the invitation was created                                                                          |
| `deactivated`             | `boolean`                                                                                                        | ✓        | Whether the invitation has been deactivated                                                                            |
| `deliveryCount`           | `number`                                                                                                         | ✓        | Number of delivery attempts made                                                                                       |
| `deliveryTypes`           | `("email" \| "phone" \| "share" \| "internal")[]`                                                                | ✓        | Delivery channels used for this invitation                                                                             |
| `foreignCreatorId`        | `string`                                                                                                         | ✓        | Your user ID who created this invitation                                                                               |
| `invitationType`          | `"single_use" \| "multi_use" \| "autojoin"`                                                                      | ✓        | Type of invitation: single_use (one accept), multi_use (unlimited), or autojoin (domain-based)                         |
| `modifiedAt`              | `string \| null`                                                                                                 | ✓        | ISO timestamp when the invitation was last modified                                                                    |
| `status`                  | `"queued" \| "sending" \| "sent" \| "delivered" \| "accepted" \| "shared" \| "unfurled" \| "accepted_elsewhere"` | ✓        | Current status of the invitation                                                                                       |
| `views`                   | `number`                                                                                                         | ✓        | Number of times the invitation was viewed                                                                              |
| `widgetConfigurationId`   | `string`                                                                                                         | ✓        | ID of the component configuration used                                                                                 |
| `scopes`                  | `InvitationScope[]`                                                                                              | ✓        | Scopes associated with this invitation (preferred)                                                                     |
| `groups`                  | `InvitationScope[]`                                                                                              | ✓        | ⚠️ **Deprecated**: Use scopes instead                                                                                  |
| `accepts`                 | `InvitationAcceptance[] \| undefined`                                                                            |          | List of users who accepted this invitation                                                                             |
| `expired`                 | `boolean`                                                                                                        | ✓        | Whether the invitation has expired                                                                                     |
| `expires`                 | `string \| undefined`                                                                                            |          | ISO timestamp when the invitation expires                                                                              |
| `source`                  | `string \| undefined`                                                                                            |          | Source identifier (e.g., campaign name)                                                                                |
| `subtype`                 | `string \| null \| undefined`                                                                                    |          | Customer-defined subtype for categorizing this invitation (e.g., pymk, find-friends, profile-button)                   |
| `creatorName`             | `string \| null \| undefined`                                                                                    |          | Display name of the invitation creator                                                                                 |
| `creatorAvatarUrl`        | `string \| null \| undefined`                                                                                    |          | Avatar URL of the invitation creator                                                                                   |

### `InvitationResult`

Full invitation result including target information.
Used by getInvitation, getInvitationsByScope, and other endpoints that return targets.

| Field                     | Type                                                                                                             | Required | Description                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                      | `string`                                                                                                         | ✓        | Unique invitation identifier                                                                                           |
| `accountId`               | `string`                                                                                                         | ✓        | Vortex account ID that owns this invitation                                                                            |
| `clickThroughs`           | `number`                                                                                                         | ✓        | Number of times the invitation link was clicked                                                                        |
| `formSubmissionData`      | `Record<string, any> \| null`                                                                                    | ✓        | Invitation form data submitted by the user, including invitee identifiers (such as email addresses, phone numbers, or internal IDs) and the values of any custom fields. |
| `configurationAttributes` | `Record<string, any> \| null`                                                                                    | ✓        | ⚠️ **Deprecated**: Use formSubmissionData instead. This field contains the same data.                                  |
| `attributes`              | `Record<string, any> \| null`                                                                                    | ✓        | Custom attributes attached to this invitation                                                                          |
| `createdAt`               | `string`                                                                                                         | ✓        | ISO timestamp when the invitation was created                                                                          |
| `deactivated`             | `boolean`                                                                                                        | ✓        | Whether the invitation has been deactivated                                                                            |
| `deliveryCount`           | `number`                                                                                                         | ✓        | Number of delivery attempts made                                                                                       |
| `deliveryTypes`           | `("email" \| "phone" \| "share" \| "internal")[]`                                                                | ✓        | Delivery channels used for this invitation                                                                             |
| `foreignCreatorId`        | `string`                                                                                                         | ✓        | Your user ID who created this invitation                                                                               |
| `invitationType`          | `"single_use" \| "multi_use" \| "autojoin"`                                                                      | ✓        | Type of invitation: single_use (one accept), multi_use (unlimited), or autojoin (domain-based)                         |
| `modifiedAt`              | `string \| null`                                                                                                 | ✓        | ISO timestamp when the invitation was last modified                                                                    |
| `status`                  | `"queued" \| "sending" \| "sent" \| "delivered" \| "accepted" \| "shared" \| "unfurled" \| "accepted_elsewhere"` | ✓        | Current status of the invitation                                                                                       |
| `views`                   | `number`                                                                                                         | ✓        | Number of times the invitation was viewed                                                                              |
| `widgetConfigurationId`   | `string`                                                                                                         | ✓        | ID of the component configuration used                                                                                 |
| `scopes`                  | `InvitationScope[]`                                                                                              | ✓        | Scopes associated with this invitation (preferred)                                                                     |
| `groups`                  | `InvitationScope[]`                                                                                              | ✓        | ⚠️ **Deprecated**: Use scopes instead                                                                                  |
| `accepts`                 | `InvitationAcceptance[] \| undefined`                                                                            |          | List of users who accepted this invitation                                                                             |
| `expired`                 | `boolean`                                                                                                        | ✓        | Whether the invitation has expired                                                                                     |
| `expires`                 | `string \| undefined`                                                                                            |          | ISO timestamp when the invitation expires                                                                              |
| `source`                  | `string \| undefined`                                                                                            |          | Source identifier (e.g., campaign name)                                                                                |
| `subtype`                 | `string \| null \| undefined`                                                                                    |          | Customer-defined subtype for categorizing this invitation (e.g., pymk, find-friends, profile-button)                   |
| `creatorName`             | `string \| null \| undefined`                                                                                    |          | Display name of the invitation creator                                                                                 |
| `creatorAvatarUrl`        | `string \| null \| undefined`                                                                                    |          | Avatar URL of the invitation creator                                                                                   |
| `target`                  | `InvitationTarget[]`                                                                                             | ✓        | List of invitation targets (recipients)                                                                                |

### `AcceptUser`

User type for accepting invitations
Requires either email or phone (or both)

| Field        | Type                   | Required | Description                                                                                                                                                                                                                                                                         |
| ------------ | ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`      | `string \| undefined`  |          | Email address of the accepting user                                                                                                                                                                                                                                                 |
| `phone`      | `string \| undefined`  |          | Phone number of the accepting user                                                                                                                                                                                                                                                  |
| `name`       | `string \| undefined`  |          | Display name of the accepting user                                                                                                                                                                                                                                                  |
| `isExisting` | `boolean \| undefined` |          | Whether the accepting user is an existing user in your system. Set to true if the user was already registered before accepting the invitation. Set to false if this is a new user signup. Leave undefined if unknown. Used for analytics to track new vs existing user conversions. |

### `AcceptInvitationRequest`

Request body for accepting invitations

| Field           | Type         | Required | Description                                          |
| --------------- | ------------ | -------- | ---------------------------------------------------- |
| `invitationIds` | `string[]`   | ✓        | Array of invitation IDs to accept                    |
| `user`          | `AcceptUser` | ✓        | Information about the user accepting the invitations |

### `AcceptInvitationRequestLegacy`

Legacy request body for accepting invitations

| Field           | Type               | Required | Description                        |
| --------------- | ------------------ | -------- | ---------------------------------- |
| `invitationIds` | `string[]`         | ✓        | Array of invitation IDs to accept  |
| `target`        | `InvitationTarget` | ✓        | Target information (legacy format) |

### `SyncInternalInvitationRequest`

Request body for syncing an internal invitation action

| Field         | Type                       | Required | Description                                |
| ------------- | -------------------------- | -------- | ------------------------------------------ |
| `creatorId`   | `string`                   | ✓        | The inviter's user ID                      |
| `targetValue` | `string`                   | ✓        | The invitee's user ID                      |
| `action`      | `"accepted" \| "declined"` | ✓        | The action taken: "accepted" or "declined" |
| `componentId` | `string`                   | ✓        | The widget component UUID                  |

### `SyncInternalInvitationResponse`

Response from syncing an internal invitation action

| Field           | Type       | Required | Description                                |
| --------------- | ---------- | -------- | ------------------------------------------ |
| `processed`     | `number`   | ✓        | Number of invitations processed            |
| `invitationIds` | `string[]` | ✓        | IDs of the invitations that were processed |

### `User`

User type for JWT generation
Only `id` is required. Email is optional but recommended for invitation attribution.

| Field                 | Type                    | Required | Description                                                                                                                                                                                                                                |
| --------------------- | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                  | `string`                | ✓        | Unique user identifier in your system                                                                                                                                                                                                      |
| `email`               | `string \| undefined`   |          | User's email address (optional, used for reply-to in invitation emails)                                                                                                                                                                    |
| `name`                | `string \| undefined`   |          | User's display name (preferred)                                                                                                                                                                                                            |
| `avatarUrl`           | `string \| undefined`   |          | User's avatar URL (preferred)                                                                                                                                                                                                              |
| `userName`            | `string \| undefined`   |          | ⚠️ **Deprecated**: Use `name` instead                                                                                                                                                                                                      |
| `userAvatarUrl`       | `string \| undefined`   |          | ⚠️ **Deprecated**: Use `avatarUrl` instead                                                                                                                                                                                                 |
| `adminScopes`         | `string[] \| undefined` |          | Admin scope permissions (e.g., ['autojoin'])                                                                                                                                                                                               |
| `allowedEmailDomains` | `string[] \| undefined` |          | Optional list of allowed email domains for invitation restrictions. When present, email invitations will only be allowed to addresses matching one of these domains (e.g., ['acme.com', 'acme.org']). Domain matching is case-insensitive. |

### `AutojoinDomain`

Autojoin domain configuration
Allows users with matching email domains to automatically join a scope

| Field    | Type     | Required | Description                     |
| -------- | -------- | -------- | ------------------------------- |
| `id`     | `string` | ✓        | Unique domain configuration ID  |
| `domain` | `string` | ✓        | Email domain (e.g., 'acme.com') |

### `AutojoinDomainsResponse`

Response from autojoin API endpoints

| Field             | Type                       | Required | Description                                           |
| ----------------- | -------------------------- | -------- | ----------------------------------------------------- |
| `autojoinDomains` | `AutojoinDomain[]`         | ✓        | List of configured autojoin domains                   |
| `invitation`      | `InvitationResult \| null` | ✓        | The autojoin invitation if one exists, null otherwise |

### `ConfigureAutojoinRequest`

Request body for configuring autojoin domains

| Field         | Type                               | Required | Description                                                              |
| ------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------ |
| `scope`       | `string`                           | ✓        | Scope ID in your system                                                  |
| `scopeType`   | `string`                           | ✓        | Type of scope (e.g., 'team', 'organization')                             |
| `scopeName`   | `string \| undefined`              |          | Display name for the scope                                               |
| `domains`     | `string[]`                         | ✓        | List of email domains that can autojoin (e.g., ['acme.com', 'acme.org']) |
| `componentId` | `string`                           | ✓        | Component ID to use for autojoin invitations                             |
| `metadata`    | `Record<string, any> \| undefined` |          | Custom metadata to attach to autojoin invitations                        |

### `Inviter`

Information about the user creating the invitation (the inviter)

| Field           | Type                  | Required | Description                                                                   |
| --------------- | --------------------- | -------- | ----------------------------------------------------------------------------- |
| `userId`        | `string`              | ✓        | The internal user ID of the person creating the invitation (from your system) |
| `userEmail`     | `string \| undefined` |          | The email address of the person creating the invitation                       |
| `name`          | `string \| undefined` |          | The display name of the person creating the invitation (preferred)            |
| `avatarUrl`     | `string \| undefined` |          | Avatar URL for the person creating the invitation (preferred)                 |
| `userName`      | `string \| undefined` |          | ⚠️ **Deprecated**: Use `name` instead                                         |
| `userAvatarUrl` | `string \| undefined` |          | ⚠️ **Deprecated**: Use `avatarUrl` instead                                    |

### `GenerateTokenUser`

User object for generateToken - flexible structure
Only `id` is required for secure attribution

| Field       | Type                  | Required | Description                               |
| ----------- | --------------------- | -------- | ----------------------------------------- |
| `id`        | `string \| number`    | ✓        | User ID - required for secure attribution |
| `email`     | `string \| undefined` |          | User's email address                      |
| `name`      | `string \| undefined` |          | User's display name                       |
| `phone`     | `string \| undefined` |          | User's phone number                       |
| `avatarUrl` | `string \| undefined` |          | User's avatar URL                         |

### `GenerateTokenData`

Payload structure for generateToken method
All fields are optional - sign only what you need

| Field       | Type                               | Required | Description                                            |
| ----------- | ---------------------------------- | -------- | ------------------------------------------------------ |
| `component` | `string \| undefined`              |          | Widget component ID                                    |
| `trigger`   | `string \| undefined`              |          | DOM selector for trigger button                        |
| `embed`     | `string \| undefined`              |          | DOM selector for embed container                       |
| `user`      | `GenerateTokenUser \| undefined`   |          | User information - include `id` for secure attribution |
| `scope`     | `string \| undefined`              |          | Scope/workspace identifier                             |
| `vars`      | `Record<string, any> \| undefined` |          | Template variables for customization                   |

### `GenerateJwtOptions`

Options for generateJwt method

| Field       | Type                            | Required | Description                                                                                                                                       |
| ----------- | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expiresIn` | `string \| number \| undefined` |          | JWT expiration time - String format: '5m', '1h', '24h', '7d' (minutes, hours, days) - Number format: seconds - Default: 30 days (2592000 seconds) |

### `GenerateTokenOptions`

Options for generateToken method

| Field       | Type                            | Required | Description                                                                                                                               |
| ----------- | ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `expiresIn` | `string \| number \| undefined` |          | Token expiration time - String format: '5m', '1h', '24h', '7d' (minutes, hours, days) - Number format: seconds - Default: '30d' (30 days) |

</details>

## Webhooks

Webhooks let your server receive real-time notifications when events happen in Vortex. Use them to sync invitation state with your database, trigger onboarding flows, update your CRM, or send internal notifications.

### Setup

1. Go to your Vortex dashboard → Integrations → Webhooks tab
2. Click "Add Webhook"
3. Enter your endpoint URL (must be HTTPS in production)
4. Copy the signing secret — you'll use this to verify webhook signatures
5. Select which events you want to receive

### Verifying Webhooks

Always verify webhook signatures using `VortexWebhooks.constructEvent()` to ensure requests are from Vortex.
The signature is sent in the `X-Vortex-Signature` header.

### Example: Express.js webhook handler

```typescript
import express from 'express';
import { VortexWebhooks, isWebhookEvent } from '@teamvortexsoftware/vortex-node-22-sdk';

const app = express();
const webhooks = new VortexWebhooks({
  secret: process.env.VORTEX_WEBHOOK_SECRET!,
});

// Important: Use raw body for signature verification
app.post('/webhooks/vortex', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = webhooks.constructEvent(req.body, req.headers['x-vortex-signature'] as string);

    if (isWebhookEvent(event)) {
      switch (event.type) {
        case 'invitation.accepted':
          // User accepted an invitation — activate their account
          console.log('Invitation accepted:', event.data.targetEmail);
          break;
        case 'member.created':
          // New member joined via invitation
          console.log('New member:', event.data);
          break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send('Webhook Error');
  }
});
```

### Common Use Cases

**Activate users on acceptance**

When invitation.accepted fires, mark the user as active in your database and trigger your onboarding flow.

**Track invitation performance**

Monitor email.delivered, email.opened, and link.clicked events to measure invitation funnel metrics.

**Sync team membership**

Use member.created and group.member.added to keep your internal membership records in sync.

**Alert on delivery issues**

Watch for email.bounced events to proactively reach out via alternative channels.

### Supported Events

| Event                        | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `invitation.created`         | A new invitation was created                         |
| `invitation.accepted`        | An invitation was accepted by the recipient          |
| `invitation.deactivated`     | An invitation was deactivated (revoked or expired)   |
| `invitation.email.delivered` | Invitation email was successfully delivered          |
| `invitation.email.bounced`   | Invitation email bounced (invalid address)           |
| `invitation.email.opened`    | Recipient opened the invitation email                |
| `invitation.link.clicked`    | Recipient clicked the invitation link                |
| `invitation.reminder.sent`   | A reminder email was sent for a pending invitation   |
| `member.created`             | A new member was created from an accepted invitation |
| `group.member.added`         | A member was added to a scope/group                  |
| `deployment.created`         | A new deployment configuration was created           |
| `deployment.deactivated`     | A deployment was deactivated                         |
| `abtest.started`             | An A/B test was started                              |
| `abtest.winner_declared`     | An A/B test winner was declared                      |
| `email.complained`           | Recipient marked the email as spam                   |

## Error Handling

All SDK errors extend `Error`.

| Error                         | Description                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VortexWebhookSignatureError` | Thrown when webhook signature verification fails. Check that you are using the raw request body (not parsed JSON) and the correct signing secret from your Vortex dashboard. |
| `Error`                       | Thrown for validation errors (e.g., missing API key, invalid user ID in generateToken/generateJwt)                                                                           |

---

<!-- Generated from SDK v0.20.0 manifest -->
