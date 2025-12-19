# Vortex Node.js 22 SDK Implementation Guide

**Package:** `@teamvortexsoftware/vortex-node-22-sdk`
**Type:** Base SDK (Core library for Node.js-based integrations)
**Requires:** Node.js 22+

## Prerequisites
From integration contract you need: API endpoint prefix, scope entity, authentication pattern
From discovery data you need: Web framework (if any), database ORM, auth middleware pattern

## Key Facts
- Base SDK for framework-agnostic Node.js integration
- Client-based: instantiate `Vortex` class and call methods
- All methods are async and return promises
- Accept invitations requires custom database logic (must implement)
- Use framework-specific SDKs (Express, Fastify, Next.js) when possible for easier integration

---

## Step 1: Install

```bash
npm install @teamvortexsoftware/vortex-node-22-sdk
# or
pnpm add @teamvortexsoftware/vortex-node-22-sdk
```

---

## Step 2: Set Environment Variable

Add to `.env`:

```bash
VORTEX_API_KEY=VRTX.your-api-key-here.secret
```

**Never commit API key to version control.**

---

## Step 3: Create Vortex Client Instance

**TypeScript** (`src/lib/vortex-client.ts`):
```typescript
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';

if (!process.env.VORTEX_API_KEY) {
  throw new Error('VORTEX_API_KEY environment variable is required');
}

export const vortexClient = new Vortex(process.env.VORTEX_API_KEY);
```

**JavaScript** (`src/lib/vortex-client.js`):
```javascript
const { Vortex } = require('@teamvortexsoftware/vortex-node-22-sdk');

if (!process.env.VORTEX_API_KEY) {
  throw new Error('VORTEX_API_KEY environment variable is required');
}

module.exports.vortexClient = new Vortex(process.env.VORTEX_API_KEY);
```

---

## Step 4: Extract Authenticated User

Create `src/lib/auth-helpers.ts`:

```typescript
import type { Request } from 'your-framework';

export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin?: boolean;
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  // JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = await verifyJwt(token); // Your JWT logic
    return {
      id: decoded.userId,
      email: decoded.email,
      isAdmin: decoded.role === 'admin'
    };
  }

  // Session cookie
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    const session = await getSession(sessionId);
    return session?.user || null;
  }

  return null;
}

export function toVortexUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    adminScopes: user.isAdmin ? ['autojoin'] : undefined
  };
}
```

**Adapt to their patterns:**
- Match their auth mechanism (JWT, sessions, custom)
- Match their user structure
- Match their admin detection logic

---

## Step 5: Implement JWT Generation Endpoint

```typescript
// src/handlers/jwt-handler.ts
import { vortexClient } from '../lib/vortex-client';
import { getAuthenticatedUser, toVortexUser } from '../lib/auth-helpers';
import type { IncomingMessage, ServerResponse } from 'http';

export async function handleJwtGeneration(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }));
    return;
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
      return;
    }

    // Parse request body for optional context
    let body = '';
    req.on('data', chunk => body += chunk);
    await new Promise(resolve => req.on('end', resolve));

    const context = body ? JSON.parse(body) : {};

    const jwt = await vortexClient.generateJwt({
      user: toVortexUser(user),
      ...context // Optional: componentId, scope, scopeType
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jwt }));
  } catch (error) {
    console.error('JWT generation error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}
```

---

## Step 6: Implement Invitation Query Endpoints

```typescript
// src/handlers/invitation-handlers.ts
import { vortexClient } from '../lib/vortex-client';
import { getAuthenticatedUser } from '../lib/auth-helpers';
import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export async function handleGetInvitationsByTarget(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
      return;
    }

    const url = new URL(req.url!, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    const value = url.searchParams.get('value');

    if (!type || !value) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing type or value parameter', code: 'INVALID_REQUEST' }));
      return;
    }

    const invitations = await vortexClient.getInvitationsByTarget({
      type: type as 'email' | 'sms',
      value
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(invitations));
  } catch (error) {
    console.error('Get invitations error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}

export async function handleGetInvitation(
  req: IncomingMessage,
  res: ServerResponse,
  invitationId: string
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
      return;
    }

    const invitation = await vortexClient.getInvitation(invitationId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(invitation));
  } catch (error) {
    console.error('Get invitation error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}
```

---

## Step 7: Implement Accept Invitations Endpoint (CRITICAL)

```typescript
// src/handlers/accept-invitations-handler.ts
import { vortexClient } from '../lib/vortex-client';
import { getAuthenticatedUser } from '../lib/auth-helpers';
import type { IncomingMessage, ServerResponse } from 'http';

export async function handleAcceptInvitations(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
      return;
    }

    // Parse request body
    let body = '';
    req.on('data', chunk => body += chunk);
    await new Promise(resolve => req.on('end', resolve));

    const { invitationIds, target } = JSON.parse(body);

    // 1. Mark invitations as accepted in Vortex
    await vortexClient.acceptInvitations({ invitationIds, target });

    // 2. CRITICAL - Add to your database
    const invitations = await Promise.all(
      invitationIds.map(id => vortexClient.getInvitation(id))
    );

    for (const invitation of invitations) {
      if (invitation.group) {
        // Prisma example:
        // await prisma.groupMembership.create({
        //   data: {
        //     userId: user.id,
        //     groupId: invitation.group.id,
        //     groupType: invitation.group.type,
        //     role: invitation.role || 'member',
        //     joinedAt: new Date()
        //   }
        // });

        // TypeORM example:
        // await groupMembershipRepository.save({
        //   userId: user.id,
        //   groupId: invitation.group.id,
        //   groupType: invitation.group.type,
        //   role: invitation.role || 'member',
        //   joinedAt: new Date()
        // });

        // Sequelize example:
        // await GroupMembership.create({
        //   userId: user.id,
        //   groupId: invitation.group.id,
        //   groupType: invitation.group.type,
        //   role: invitation.role || 'member',
        //   joinedAt: new Date()
        // });

        // Raw SQL example:
        // await query(
        //   'INSERT INTO group_memberships (user_id, group_type, group_id, role) VALUES ($1, $2, $3, $4)',
        //   [user.id, invitation.group.type, invitation.group.id, invitation.role || 'member']
        // );
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      acceptedCount: invitationIds.length
    }));
  } catch (error) {
    console.error('Accept invitations error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}
```

**Critical - Adapt database logic:**
- Use their actual table/model names (from discovery)
- Use their actual field names
- Use their ORM pattern (Prisma, TypeORM, Sequelize, raw SQL)
- Handle duplicate memberships if needed

---

## Step 8: Implement Delete/Revoke Endpoints

```typescript
// src/handlers/delete-handlers.ts
import { vortexClient } from '../lib/vortex-client';
import { getAuthenticatedUser } from '../lib/auth-helpers';
import type { IncomingMessage, ServerResponse } from 'http';

export async function handleRevokeInvitation(
  req: IncomingMessage,
  res: ServerResponse,
  invitationId: string
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
      return;
    }

    await vortexClient.revokeInvitation(invitationId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Revoke invitation error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}

export async function handleReinvite(
  req: IncomingMessage,
  res: ServerResponse,
  invitationId: string
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
      return;
    }

    await vortexClient.reinvite(invitationId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Reinvite error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}
```

---

## Step 9: Set Up Routing

```typescript
// src/server.ts
import { createServer } from 'http';
import { handleJwtGeneration } from './handlers/jwt-handler';
import { handleGetInvitationsByTarget, handleGetInvitation } from './handlers/invitation-handlers';
import { handleAcceptInvitations } from './handlers/accept-invitations-handler';
import { handleRevokeInvitation, handleReinvite } from './handlers/delete-handlers';

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/api/vortex/jwt' && req.method === 'POST') {
    return handleJwtGeneration(req, res);
  }

  if (path === '/api/vortex/invitations' && req.method === 'GET') {
    return handleGetInvitationsByTarget(req, res);
  }

  if (path === '/api/vortex/invitations/accept' && req.method === 'POST') {
    return handleAcceptInvitations(req, res);
  }

  const invitationMatch = path.match(/^\/api\/vortex\/invitations\/([^/]+)$/);
  if (invitationMatch) {
    const invitationId = invitationMatch[1];
    if (req.method === 'GET') return handleGetInvitation(req, res, invitationId);
    if (req.method === 'DELETE') return handleRevokeInvitation(req, res, invitationId);
  }

  const reinviteMatch = path.match(/^\/api\/vortex\/invitations\/([^/]+)\/reinvite$/);
  if (reinviteMatch && req.method === 'POST') {
    return handleReinvite(req, res, reinviteMatch[1]);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

---

## Step 10: Build and Test

```bash
# TypeScript
npx tsc --noEmit

# Start
npm run dev

# Test JWT endpoint
curl -X POST http://localhost:3000/api/vortex/jwt \
  -H "Authorization: Bearer your-auth-token"
```

Expected response:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Common Errors

**"VORTEX_API_KEY is not defined"** → Add `import 'dotenv/config'` at entry point

**"Cannot read property 'user' of undefined"** → Auth middleware not extracting user correctly

**User not added to database** → Must implement database logic in accept handler (see Step 7)

**TypeScript errors with Vortex types** → Import types explicitly:
```typescript
import type { User, InvitationTarget } from '@teamvortexsoftware/vortex-node-22-sdk';
```

**CORS errors** → Add CORS headers to responses:
```typescript
res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
res.setHeader('Access-Control-Allow-Credentials', 'true');
```

---

## After Implementation Report

List files created/modified:
- Client: src/lib/vortex-client.ts
- Auth: src/lib/auth-helpers.ts
- Handlers: src/handlers/*.ts (jwt, invitation, accept, delete)
- Routes: src/server.ts
- Database: Accept endpoint creates memberships in [table name]

Confirm:
- Vortex client instance created
- All handler functions implemented
- Accept invitations includes database logic
- JWT endpoint returns valid JWT
- Routes registered at correct prefix
- Build succeeds with `npx tsc --noEmit`

## Endpoints Registered

All endpoints at `/api/vortex`:
- `POST /jwt` - Generate JWT for authenticated user
- `GET /invitations` - Get invitations by target
- `GET /invitations/:id` - Get invitation by ID
- `POST /invitations/accept` - Accept invitations (custom DB logic)
- `DELETE /invitations/:id` - Revoke invitation
- `POST /invitations/:id/reinvite` - Resend invitation
