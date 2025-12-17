# Vortex Node.js 22 SDK Integration Guide

## SDK Information

**Package**: `@teamvortexsoftware/vortex-node-22-sdk`
**Type**: Base SDK (Core library for Node.js-based integrations)
**Framework**: Framework-agnostic Node.js 22+
**Integration Style**: Direct client instantiation with manual route/handler setup

This is the **base SDK** that other Node-based SDKs (Express, Fastify, Next.js) depend on. Use this SDK when:
- You're using a custom or unsupported web framework
- You need direct control over API endpoints and routing
- You're building a framework wrapper for another Node.js framework
- You want to use Vortex functionality outside of HTTP handlers (background jobs, CLI tools, etc.)

**Note**: If you're using Express, Fastify, or Next.js, prefer the framework-specific SDKs (`vortex-express-5-sdk`, `vortex-fastify-5-sdk`, `vortex-nextjs-15-sdk`) which provide pre-built route handlers and simpler integration.

---

## Expected Input Context

When this guide is invoked by the orchestrator, expect:

### Integration Contract
```typescript
{
  backend: {
    framework: 'node-22',
    packageManager: 'npm' | 'pnpm' | 'yarn',
    typescript: boolean,
    srcDirectory: string  // e.g., 'src' or 'lib'
  }
}
```

### Discovery Data
```typescript
{
  projectRoot: string,
  existingFiles: string[],  // Relevant files like server.ts, app.ts, etc.
  packageJson: object,
  hasTypeScript: boolean
}
```

---

## Implementation Overview

The Node.js 22 SDK provides the core `Vortex` class for:
1. **JWT Generation**: Generate JWTs for authenticated users with custom attributes
2. **Invitation Management**: Create, accept, revoke, and query invitations
3. **Autojoin Management**: Configure domain-based auto-join rules (admin-only)

Integration involves:
1. Installing the SDK package
2. Creating a `Vortex` client instance with your API key
3. Implementing HTTP handlers that call Vortex methods
4. Extracting authenticated user from your auth system
5. **Critical**: Implementing custom database logic for accepting invitations

---

## Critical SDK Specifics

### 1. Client Instantiation
```typescript
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';

const vortex = new Vortex(process.env.VORTEX_API_KEY!, {
  baseUrl: 'https://api.vortexsoftware.com' // optional, defaults to production
});
```

### 2. JWT Generation - Current Format (Recommended)
```typescript
const jwt = await vortex.generateJwt({
  user: {
    id: 'user-123',
    email: 'user@example.com',
    adminScopes: ['autojoin'], // Optional: grant admin capabilities
  },
  // Optional: additional JWT claims
  componentId: 'optional-component-id',
  scope: 'optional-scope',
  scopeType: 'optional-scope-type',
});
```

### 3. JWT Generation - Legacy Format (Deprecated but supported)
```typescript
const jwt = await vortex.generateJwt({
  user: {
    id: 'user-123',
    identifiers: [{ type: 'email', value: 'user@example.com' }],
    groups: [
      { type: 'team', groupId: 'team-123', name: 'Engineering' }
    ],
    role: 'admin',
    attributes: { customField: 'value' }
  }
});
```

### 4. Invitation Queries
```typescript
// Get invitations by target (email/phone)
const invitations = await vortex.getInvitationsByTarget({
  type: 'email',
  value: 'user@example.com'
});

// Get single invitation
const invitation = await vortex.getInvitation('invitation-id');

// Get invitations by group
const groupInvitations = await vortex.getInvitationsByGroup('team', 'team-123');
```

### 5. Invitation Operations
```typescript
// Revoke invitation
await vortex.revokeInvitation('invitation-id');

// Resend invitation
await vortex.reinvite('invitation-id');

// Delete all invitations for a group
await vortex.deleteInvitationsByGroup('team', 'team-123');
```

### 6. Accept Invitations - REQUIRES DATABASE OVERRIDE
```typescript
// This SDK method just marks invitations as accepted in Vortex
// YOU MUST implement database logic to actually add user to groups
await vortex.acceptInvitations({
  invitationIds: ['inv-1', 'inv-2'],
  target: { type: 'email', value: 'user@example.com' }
});

// After calling this, you MUST implement your own database logic:
// - Add user to teams/organizations
// - Grant permissions/roles
// - Create user records if needed
// - Update user metadata
```

### 7. Autojoin Management (Admin Only)
```typescript
// Get autojoin domains for a group
const domains = await vortex.getAutojoinDomains('team', 'team-123');

// Configure autojoin domains
await vortex.configureAutojoin('team', 'team-123', {
  domains: ['example.com', 'company.org'],
  enabled: true
});
```

---

## Step-by-Step Implementation

### Step 1: Install Package

```bash
# npm
npm install @teamvortexsoftware/vortex-node-22-sdk

# pnpm
pnpm add @teamvortexsoftware/vortex-node-22-sdk

# yarn
yarn add @teamvortexsoftware/vortex-node-22-sdk
```

### Step 2: Set Environment Variables

Add to `.env` or `.env.local`:
```bash
VORTEX_API_KEY=your_api_key_here
```

### Step 3: Create Vortex Client Instance

**TypeScript Example** (`src/lib/vortex-client.ts`):
```typescript
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';

if (!process.env.VORTEX_API_KEY) {
  throw new Error('VORTEX_API_KEY environment variable is required');
}

export const vortexClient = new Vortex(process.env.VORTEX_API_KEY);
```

**JavaScript Example** (`src/lib/vortex-client.js`):
```javascript
const { Vortex } = require('@teamvortexsoftware/vortex-node-22-sdk');

if (!process.env.VORTEX_API_KEY) {
  throw new Error('VORTEX_API_KEY environment variable is required');
}

module.exports.vortexClient = new Vortex(process.env.VORTEX_API_KEY);
```

### Step 4: Extract Authenticated User

Create a helper function to extract user from your auth system:

```typescript
// src/lib/auth-helpers.ts
import type { Request } from 'your-framework'; // Adjust import for your framework

export interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin?: boolean;
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  // Option 1: JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = await verifyJwt(token); // Your JWT verification logic
    return {
      id: decoded.userId,
      email: decoded.email,
      isAdmin: decoded.role === 'admin'
    };
  }

  // Option 2: Session cookie
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    const session = await getSession(sessionId); // Your session logic
    return session?.user || null;
  }

  // Option 3: Custom authentication
  // Implement your auth logic here

  return null;
}

// Helper to convert to Vortex user format
export function toVortexUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    adminScopes: user.isAdmin ? ['autojoin'] : undefined
  };
}
```

### Step 5: Implement JWT Generation Endpoint

**Example with plain Node.js http server**:
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

### Step 6: Implement Invitation Query Endpoints

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

    // Parse query parameters
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

export async function handleGetInvitationsByGroup(
  req: IncomingMessage,
  res: ServerResponse,
  groupType: string,
  groupId: string
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }));
      return;
    }

    const invitations = await vortexClient.getInvitationsByGroup(groupType, groupId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(invitations));
  } catch (error) {
    console.error('Get invitations by group error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}
```

### Step 7: Implement Accept Invitations Endpoint (CRITICAL)

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

    // Step 1: Mark invitations as accepted in Vortex
    await vortexClient.acceptInvitations({ invitationIds, target });

    // Step 2: CRITICAL - Implement YOUR database logic here
    // Get invitation details to know what groups to add user to
    const invitations = await Promise.all(
      invitationIds.map(id => vortexClient.getInvitation(id))
    );

    // Example database logic (adapt to your ORM/database)
    for (const invitation of invitations) {
      if (invitation.group) {
        // Add user to the group in your database
        await addUserToGroup({
          userId: user.id,
          groupType: invitation.group.type,
          groupId: invitation.group.id,
          role: invitation.role || 'member'
        });

        // Example with Prisma:
        // await prisma.groupMembership.create({
        //   data: {
        //     userId: user.id,
        //     groupId: invitation.group.id,
        //     groupType: invitation.group.type,
        //     role: invitation.role || 'member',
        //     joinedAt: new Date()
        //   }
        // });
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

// Example database function (implement based on your ORM)
async function addUserToGroup(params: {
  userId: string;
  groupType: string;
  groupId: string;
  role: string;
}): Promise<void> {
  // Option 1: Prisma
  // await prisma.groupMembership.create({ data: params });

  // Option 2: TypeORM
  // await groupMembershipRepository.save(params);

  // Option 3: Sequelize
  // await GroupMembership.create(params);

  // Option 4: Raw SQL
  // await query(
  //   'INSERT INTO group_memberships (user_id, group_type, group_id, role) VALUES ($1, $2, $3, $4)',
  //   [params.userId, params.groupType, params.groupId, params.role]
  // );

  throw new Error('addUserToGroup not implemented - replace with your database logic');
}
```

### Step 8: Implement Delete/Revoke Endpoints

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

    // Optional: Add authorization check
    // if (!user.isAdmin) {
    //   res.writeHead(403, { 'Content-Type': 'application/json' });
    //   res.end(JSON.stringify({ error: 'Forbidden' }));
    //   return;
    // }

    await vortexClient.revokeInvitation(invitationId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Revoke invitation error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
  }
}

export async function handleDeleteInvitationsByGroup(
  req: IncomingMessage,
  res: ServerResponse,
  groupType: string,
  groupId: string
): Promise<void> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || !user.isAdmin) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    await vortexClient.deleteInvitationsByGroup(groupType, groupId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Delete invitations by group error:', error);
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

### Step 9: Set Up Routing

**Example with plain Node.js http server**:
```typescript
// src/server.ts
import { createServer } from 'http';
import { handleJwtGeneration } from './handlers/jwt-handler';
import {
  handleGetInvitationsByTarget,
  handleGetInvitation,
  handleGetInvitationsByGroup
} from './handlers/invitation-handlers';
import { handleAcceptInvitations } from './handlers/accept-invitations-handler';
import {
  handleRevokeInvitation,
  handleDeleteInvitationsByGroup,
  handleReinvite
} from './handlers/delete-handlers';

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  // JWT endpoint
  if (path === '/api/vortex/jwt' && req.method === 'POST') {
    return handleJwtGeneration(req, res);
  }

  // Get invitations by target
  if (path === '/api/vortex/invitations' && req.method === 'GET') {
    return handleGetInvitationsByTarget(req, res);
  }

  // Accept invitations
  if (path === '/api/vortex/invitations/accept' && req.method === 'POST') {
    return handleAcceptInvitations(req, res);
  }

  // Get/delete single invitation
  const invitationMatch = path.match(/^\/api\/vortex\/invitations\/([^/]+)$/);
  if (invitationMatch) {
    const invitationId = invitationMatch[1];
    if (req.method === 'GET') {
      return handleGetInvitation(req, res, invitationId);
    }
    if (req.method === 'DELETE') {
      return handleRevokeInvitation(req, res, invitationId);
    }
  }

  // Reinvite
  const reinviteMatch = path.match(/^\/api\/vortex\/invitations\/([^/]+)\/reinvite$/);
  if (reinviteMatch && req.method === 'POST') {
    const invitationId = reinviteMatch[1];
    return handleReinvite(req, res, invitationId);
  }

  // Get/delete invitations by group
  const groupMatch = path.match(/^\/api\/vortex\/invitations\/by-group\/([^/]+)\/([^/]+)$/);
  if (groupMatch) {
    const [, groupType, groupId] = groupMatch;
    if (req.method === 'GET') {
      return handleGetInvitationsByGroup(req, res, groupType, groupId);
    }
    if (req.method === 'DELETE') {
      return handleDeleteInvitationsByGroup(req, res, groupType, groupId);
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

### Step 10: Database Schema Example

Create tables/models for group memberships:

**Prisma Schema Example**:
```prisma
model GroupMembership {
  id        String   @id @default(uuid())
  userId    String
  groupType String
  groupId   String
  role      String   @default("member")
  joinedAt  DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])

  @@unique([userId, groupType, groupId])
  @@index([groupType, groupId])
}
```

**TypeORM Entity Example**:
```typescript
@Entity('group_memberships')
export class GroupMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  groupType: string;

  @Column()
  groupId: string;

  @Column({ default: 'member' })
  role: string;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne(() => User)
  user: User;
}
```

---

## Build and Validation

### Type Check (TypeScript)
```bash
npx tsc --noEmit
```

### Run Tests
```bash
npm test
```

### Start Development Server
```bash
npm run dev
```

### Test Endpoints

**1. Generate JWT**:
```bash
curl -X POST http://localhost:3000/api/vortex/jwt \
  -H "Authorization: Bearer your-auth-token" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**2. Get Invitations by Target**:
```bash
curl -X GET "http://localhost:3000/api/vortex/invitations?type=email&value=user@example.com" \
  -H "Authorization: Bearer your-auth-token"
```

**3. Accept Invitations**:
```bash
curl -X POST http://localhost:3000/api/vortex/invitations/accept \
  -H "Authorization: Bearer your-auth-token" \
  -H "Content-Type: application/json" \
  -d '{
    "invitationIds": ["inv-123"],
    "target": { "type": "email", "value": "user@example.com" }
  }'
```

**4. Get Invitations by Group**:
```bash
curl -X GET http://localhost:3000/api/vortex/invitations/by-group/team/team-123 \
  -H "Authorization: Bearer your-auth-token"
```

---

## Implementation Report

After implementing, provide this structured report:

```markdown
## Vortex Node.js 22 SDK Integration Report

### Files Created/Modified
- [ ] `src/lib/vortex-client.ts` - Vortex client instance
- [ ] `src/lib/auth-helpers.ts` - Authentication utilities
- [ ] `src/handlers/jwt-handler.ts` - JWT generation handler
- [ ] `src/handlers/invitation-handlers.ts` - Invitation query handlers
- [ ] `src/handlers/accept-invitations-handler.ts` - Accept invitations handler with database logic
- [ ] `src/handlers/delete-handlers.ts` - Delete/revoke handlers
- [ ] `src/server.ts` - Route setup
- [ ] `prisma/schema.prisma` (or equivalent) - Database schema for group memberships

### Endpoints Implemented
- [x] `POST /api/vortex/jwt` - JWT generation
- [x] `GET /api/vortex/invitations` - Get invitations by target
- [x] `POST /api/vortex/invitations/accept` - Accept invitations (with database logic)
- [x] `GET /api/vortex/invitations/:id` - Get single invitation
- [x] `DELETE /api/vortex/invitations/:id` - Revoke invitation
- [x] `POST /api/vortex/invitations/:id/reinvite` - Resend invitation
- [x] `GET /api/vortex/invitations/by-group/:type/:id` - Get invitations by group
- [x] `DELETE /api/vortex/invitations/by-group/:type/:id` - Delete invitations by group

### Database Integration
- [x] Created `GroupMembership` model/table
- [x] Implemented `addUserToGroup()` function in accept handler
- [x] Added database indexes for performance
- [x] Tested database inserts with sample data

### Configuration
- [x] Set `VORTEX_API_KEY` environment variable
- [x] Created Vortex client instance
- [x] Implemented authentication extraction
- [x] Set up error handling

### Testing Results
- [ ] JWT generation: ✓ Working
- [ ] Get invitations by target: ✓ Working
- [ ] Accept invitations: ✓ Working (database inserts confirmed)
- [ ] Get single invitation: ✓ Working
- [ ] Revoke invitation: ✓ Working
- [ ] Reinvite: ✓ Working
- [ ] Get invitations by group: ✓ Working
- [ ] Delete invitations by group: ✓ Working

### Notes
- Using [web framework name] for HTTP server
- Using [ORM/database library] for database operations
- Authentication via [auth method]
- Custom authorization logic: [Yes/No]
```

---

## Common Issues and Solutions

### Issue 1: "VORTEX_API_KEY is not defined"
**Solution**: Ensure `.env` file exists and is loaded. Use `dotenv` package:
```typescript
import 'dotenv/config'; // Add at top of entry file
```

### Issue 2: "Cannot read property 'user' of undefined"
**Solution**: Authentication middleware/logic not extracting user correctly. Verify:
- Auth token is present in request
- Token verification logic is correct
- User object structure matches expected format

### Issue 3: Accept invitations succeeds but user not added to groups
**Solution**: Database logic in accept handler not implemented. Check:
- Database connection is working
- `addUserToGroup()` function is properly implemented
- Database schema matches invitation group structure
- Error logs for database insert failures

### Issue 4: TypeScript errors with Vortex types
**Solution**: Import types explicitly:
```typescript
import type { User, InvitationTarget } from '@teamvortexsoftware/vortex-node-22-sdk';
```

### Issue 5: Routing not matching endpoints
**Solution**: Check:
- URL path patterns match exactly
- HTTP methods match (GET, POST, DELETE)
- Route parameters are extracted correctly
- URL encoding for special characters

### Issue 6: CORS errors when calling from frontend
**Solution**: Add CORS headers to responses:
```typescript
res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
res.setHeader('Access-Control-Allow-Credentials', 'true');
```

---

## Best Practices

### 1. Environment Variables
- Always use environment variables for API keys
- Never commit `.env` files
- Use different keys for development/staging/production

### 2. Error Handling
- Catch all errors in handlers
- Log errors with context (user ID, endpoint, timestamp)
- Return appropriate HTTP status codes
- Don't expose internal error details to clients

### 3. Authentication
- Validate authentication on every protected endpoint
- Use secure token storage (httpOnly cookies or Authorization header)
- Implement token refresh logic
- Clear tokens on logout

### 4. Authorization
- Implement access control checks before operations
- Verify user has permission to access resources
- Check group membership before group operations
- Admin-only endpoints should verify admin scope

### 5. Database Operations
- Use transactions when accepting invitations (accept + insert)
- Add appropriate database indexes
- Handle duplicate key errors gracefully
- Validate data before inserting

### 6. Performance
- Cache JWT tokens on client (with expiration)
- Batch invitation queries when possible
- Use database indexes for group lookups
- Consider rate limiting for public endpoints

### 7. Security
- Validate all input data
- Sanitize user-provided values
- Use parameterized queries (prevent SQL injection)
- Implement CSRF protection for state-changing operations
- Use HTTPS in production

### 8. Testing
- Write unit tests for handlers
- Test authentication/authorization logic
- Test database operations with test database
- Test error cases (missing auth, invalid IDs, etc.)

---

## Additional Resources

- **Node.js 22 SDK README**: `packages/vortex-node-22-sdk/README.md`
- **Framework-Specific SDKs**: Consider using Express, Fastify, or Next.js SDKs for easier integration
- **TypeScript Types**: All types exported from main package
- **Example Implementation**: See `packages/vortex-express-5-sdk` for framework wrapper example
