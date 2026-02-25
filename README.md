# Vortex NodeJS SDK

This package provides the Vortex Node/Typescript SDK.

With this module, you can both generate a JWT for use with the Vortex Widget and make API calls to the Vortex API.

## Features

### Invitation Delivery Types

Vortex supports multiple delivery methods for invitations:

- **`email`** - Email invitations sent by Vortex (includes reminders and nudges)
- **`phone`** - Phone invitations sent by the user/customer
- **`share`** - Shareable invitation links for social sharing
- **`internal`** - Internal invitations managed entirely by your application
  - No email/SMS communication triggered by Vortex
  - Target value can be any customer-defined identifier (UUID, string, number)
  - Useful for in-app invitation flows where you handle the delivery
  - Example use case: In-app notifications, dashboard invites, etc.

## Use Cases and Examples

### Install the NodeJS SDK

To install the SDK, simply run the following in your NodeJS backend repo:

```sh
cd your-repo
npm install --save @teamvortexsoftware/vortex-node-22-sdk
```

Once you have the SDK, [login](https://admin.vortexsoftware.com/signin) to Vortex and [create an API Key](https://admin.vortexsoftware.com/members/api-keys). Keep your API key safe! Vortex does not store the API key and it is not retrievable once it has been created. Also, it should be noted that the API key you use is scoped to the environment you're targeting. The environment is implied based on the API key used to sign JWTs and to make API requests.

Your API key is used to

- Sign JWTs for use with the Vortex Widget
- Make API calls against the [Vortex API](https://api.vortexsoftware.com/api)

### Generate a JWT for use with the Vortex Widget

Let's assume you have an express powered API and a user that is looking to invite others and you have a Vortex widget embedded on a component in your frontend codebase. Your frontend will need to provide a JWT to the Vortex widget which allows Vortex to validate the user making the request.

You could populate the JWT in some set of initial data that your application already provides (recommended) or you could create an endpoint specifically to fetch the JWT on demand for use with the widget. For the purposes of this example, we'll create an endpoint to fetch the JWT.

#### Current Format (Recommended)

```ts
const express = require('express');
const app = express();
const port = 3000;

// Provide your API key however you see fit.
const vortex = new Vortex(process.env.VORTEX_API_KEY);

app.get('/vortex-jwt', (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const token = vortex.generateJwt({
    user: {
      id: 'user-123',
      email: 'user@example.com',
      userName: 'Jane Doe',                                      // Optional: user's display name
      userAvatarUrl: 'https://example.com/avatars/jane.jpg',    // Optional: user's avatar URL
      adminScopes: ['autojoin'],                             // Optional: grants admin privileges for autojoining
    },
  });

  res.end(JSON.stringify({ jwt: token }));
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}. Fetch example JWT by hitting /vortex-jwt`);
});
```

#### User Profile Information (Optional)

You can optionally include the user's name and avatar URL in JWTs. This information will be stored and returned when fetching invitations created by this user.

```ts
const token = vortex.generateJwt({
  user: {
    id: 'user-123',
    email: 'user@example.com',
    userName: 'Jane Doe',                                    // Optional
    userAvatarUrl: 'https://example.com/avatars/jane.jpg',  // Optional
  },
});
```

**Requirements:**
- `name`: Optional string (max 200 characters)
- `avatarUrl`: Optional HTTPS URL (max 2000 characters)
- Both fields are optional and can be omitted

**Validation:**
- Invalid or non-HTTPS avatar URLs will be ignored with a warning
- Authentication will succeed even with invalid avatar URLs

You can also add extra properties to the JWT payload:

```ts
const token = vortex.generateJwt({
  user: {
    id: 'user-123',
    email: 'user@example.com',
    adminScopes: ['autojoin'],
  },
  role: 'admin',
  department: 'Engineering',
});
```

#### Legacy Format (Deprecated)

The legacy format is still supported for backward compatibility but is deprecated. New integrations should use the simplified format above.

```ts
const express = require('express');
const app = express();
const port = 3000;

// This is the id of the user in your system.
const userId = 'users-id-in-my-system';

// These identifiers are associated with users in your system.
const identifiers = [
  { type: 'email', value: 'users@emailaddress.com' },
  { type: 'email', value: 'someother@address.com' },
  { type: 'phone', value: '18008675309' },
];

// groups are specific to your product. This list should be the groups that the current requesting user is a part of. It is up to you to define them if you so choose. Based on the values here, we can determine whether or not the user is allowed to invite others to a particular group
const groups = [
  {
    type: 'workspace',
    groupId: 'some-workspace-id',
    name: 'The greatest workspace...pause...in the world',
  },
  { type: 'document', groupId: 'some-document-id', name: "Ricky's grade 10 word papers" },
  { type: 'document', groupId: 'another-document-id', name: 'Sunnyvale bylaws' },
];

// If your product has the concept of user roles (admin, guest, member, etc), provide it here
const role = 'admin';

// Provide your API key however you see fit.
const vortex = new Vortex(process.env.VORTEX_API_KEY);

app.get('/vortex-jwt', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      jwt: vortex.generateJwt({
        userId,
        identifiers,
        groups,
        role,
      }),
    })
  );
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}. Fetch example JWT by hitting /vortex-jwt`);
});
```

Now, you can utilize that JWT endpoint in conjuction with the Vortex widget

Here's an example hook:

```ts
import { useEffect, useState } from 'react';

export function useVortexJwt() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchJwt() {
      try {
        const res = await fetch('/vortex-jwt');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchJwt();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
```

Now here is that hook in use in conjuction with a Vortex widget:

```ts
function InviteWrapperComponent() {
  const { data, loading, error } = useVortexJwt();

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  const widgetId = 'this-id-comes-from-the-widget-configurator';
  const { jwt } = data;
  return (<VortexInvite
    widgetId={widgetId}
    jwt={jwt}
    group={{ type: "workspace", groupId: "some-workspace-id", name: "The greatest workspace...pause...in the world" }}
    templateVariables={{
      group_name: "The greatest workspace...pause...in the world",
      inviter_name: "James Lahey",
      group_member_count: "23",
      company_name: "Sunnyvale, Inc"
    }}
  />);
}
```

### Fetch an invitation by ID

When a shared invitation link or an invitaion link sent via email is clicked, the user who clicks it is redirected to the landing page you set in the widget configurator. For instance, if you set http://localhost:3000/invite/landing as the landing page and the invitation being clicked has an id of deadbeef-dead-4bad-8dad-c001d00dc0de, the user who clicks the invitation link will land on http://localhost:3000/invite/landing?invitationId=deadbeef-dead-4bad-8dad-c001d00dc0de

Before the user signs up, you may want to display the invitation. To do this, your backend will need to fetch it from our API.

```ts
app.get('/invite/landing', async (req, res) => {
  const invitationId = req.query?.invitationId;
  if (!invitationId) {
    // gracefully handle this situation
    return res.status(400).send('Invitation ID required');
  }
  const invitation = await vortex.getInvitation(invitationId);

  if (!invitation) {
    return res.status(404).send('Not found');
  }

  // you probably want to do something with the invitation at this point.
  // For example, you could render the invitation as HTML and ask the user
  // to signup and then accept the invite automatically on join.
  // For the sake of simplicity, we'll simply return the raw JSON
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(invitation));
});
```

### View invitations by target (email address for example)

Depending on your use case, you may want to accept all outstanding invitations to a given user when they sign up for your service. If you don't want to auto accept, you may want to present the new user with a list of all invitations that target them. Either way, the example below shows how you fetch these invitations once you know how to identify (via email, phone or others in the future) a new user to your product.

```ts
app.get('/invitations/by-email', async (req, res) => {
  const email = req.query?.email;
  if (!email) {
    // gracefully handle this situation
    return res.status(400).send('Email is required');
  }
  const invitations = await vortex.getInvitationsByTarget('email', email);

  if (!invitations || !invitations.length) {
    return res.status(404).send('Not found');
  }

  // you probably want to do something with the invitation at this point.
  // For example, you could render the invitation as HTML and ask the user
  // to signup and then accept the invite automatically on join.
  // For the sake of simplicity, we'll simply return the raw JSON
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(invitations));
});
```

### Accept an invitation

This is how you'd accept an invitation with the SDK. You want this as part of your signup flow more than likely. When someone clicks on an invitation link, we redirect to the landing page you specified in the widget configuration. Ultimately, the user will sign up with your service and that is when you create the relationship between the newly created user in your system and whatever grouping is defined in the invitation itself.

```ts
app.post('/signup', async (req, res) => {
  const email = req.body.email;
  const invitationId = req.body.invitationId;

  if (!email) {
    return res.status(400).send('Email is required');
  }

  // YOUR signup logic, whatever it may be
  await myApp.doSignupLogic(email);

  // Accept the invitation if one was provided
  if (invitationId) {
    await vortex.acceptInvitation(invitationId, { email });
  }

  // continue with post-signup activity
  res.redirect(302, '/app');
});
```

### Accept multiple invitations

If you need to accept multiple invitations at once (e.g., accepting all pending invitations for a user), use `acceptInvitations`:

```ts
app.post('/signup', async (req, res) => {
  const email = req.body.email;
  if (!email) {
    return res.status(400).send('Email is required');
  }

  // YOUR signup logic, whatever it may be
  await myApp.doSignupLogic(email);

  // Fetch all pending invitations for this email
  const invitations = await vortex.getInvitationsByTarget('email', email);

  // Accept all of them at once
  if (invitations.length > 0) {
    const invitationIds = invitations.map((inv) => inv.id);
    await vortex.acceptInvitations(invitationIds, { email });
  }

  res.redirect(302, '/app');
});
```

### Sync Internal Invitation

If you're using `internal` delivery type invitations and managing the invitation flow within your own application, you can sync invitation decisions back to Vortex when users accept or decline invitations in your system.

This is useful when:
- You handle invitation delivery through your own in-app notifications or UI
- Users accept/decline invitations within your application
- You need to keep Vortex updated with the invitation status

```ts
app.post('/invitations/sync-internal', async (req, res) => {
  const { creatorId, targetValue, action, componentId } = req.body;
  
  if (!creatorId || !targetValue || !action || !componentId) {
    return res.status(400).send('Required: creatorId, targetValue, action, componentId');
  }

  try {
    // Sync the invitation decision back to Vortex
    const result = await vortex.syncInternalInvitation({
      creatorId,      // The inviter's user ID in your system
      targetValue,    // The invitee's user ID in your system
      action,         // "accepted" or "declined"
      componentId     // The widget component UUID
    });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      processed: result.processed,           // Number of invitations processed
      invitationIds: result.invitationIds    // Array of processed invitation IDs
    }));
  } catch (error) {
    res.status(500).send('Failed to sync invitation');
  }
});
```

**Parameters:**
- `creatorId` (string) — The inviter's user ID in your system
- `targetValue` (string) — The invitee's user ID in your system
- `action` ("accepted" | "declined") — The invitation decision
- `componentId` (string) — The widget component UUID

**Response:**
- `processed` (number) — Count of invitations processed
- `invitationIds` (string[]) — IDs of processed invitations

### Fetch invitations by group

Perhaps you want to allow your users to see all outstanding invitations for a group that they are a member of. Or perhaps you want this exclusively for admins of the group. However you choose to do it, this SDK feature will allow you to fetch all outstanding invitations for a group.

```ts
app.get('/invitations/by-group', async (req, res) => {
  const { groupType, groupId } = req.query;
  if (!groupType || !groupId) {
    // gracefully handle this situation
    return res.status(400).send('Required: groupType and groupId');
  }

  const invitations = await vortex.getInvitationsByGroup(groupType, groupId);

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(invitations));
});
```

### Reinvite

You may want to allow your users to resend an existing invitation. Allowing for this will increase the conversion chances of a stale invitation. Perhaps you display a list of outstanding invites and allow for a reinvite based on that list.

```ts
app.post('/invitations/reinvite', async (req, res) => {
  const { invitationId } = req.body;
  if (!invitationId) {
    // gracefully handle this situation
    return res.status(400).send('Required: invitationId');
  }

  const invitation = await vortex.reinvite(invitationId);

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(invitation));
});
```

### Revoke invitation

In addition to reinvite, you may want to present your users (or perhaps just admins) with the ability to revoke outstanding invitations.

```ts
app.post('/invitations/revoke', async (req, res) => {
  const { invitationId } = req.body;
  if (!invitationId) {
    // gracefully handle this situation
    return res.status(400).send('Required: invitationId');
  }

  await vortex.revokeInvitation(invitationId);

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({}));
});
```

### Delete invitations by group

Your product may allow for your users to delete the underlying resource that is tied to one or more invitations. For instance, say your product has the concept of a 'workspace' and your invitations are created specifying a particular workspace associated with each invitation. Then, at some point in the future, the admin of the workspace decides to delete it. This means all invitations associated with that workspace are now invalid and need to be removed so that reminders don't go out for any outstanding invite to the now deleted workspace.

Here is how to clean them up when the workspace is deleted.

```ts
app.delete('/workspace/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  if (!workspaceId) {
    // gracefully handle this situation
    return res.status(400).send('Required: workspaceId');
  }

  await vortex.deleteInvitationsByGroup('workspace', workspaceId);

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({}));
});
```

---

## Webhooks

Vortex can forward events to your server via webhooks. There are two categories of events:

- **Webhook events** — Server-side state changes (invitation accepted, member created, A/B test winner declared, etc.)
- **Analytics events** — Client-side behavioral telemetry (widget loaded, share triggered, etc.)

You configure webhook destinations and subscribe to specific event types in the [Vortex dashboard](https://admin.vortexsoftware.com/members/integrations). Each destination has a **signing secret** used to verify that incoming requests are genuinely from Vortex.

### Install

The webhook utilities are included in the Node SDK. For framework-specific helpers, install the corresponding framework SDK as well:

```sh
# Core (required)
npm install @teamvortexsoftware/vortex-node-22-sdk

# Pick your framework (optional — you can also use the core directly)
npm install @teamvortexsoftware/vortex-express-5-sdk    # Express 5
npm install @teamvortexsoftware/vortex-nextjs-15-sdk     # Next.js 15 (App Router)
npm install @teamvortexsoftware/vortex-fastify-5-sdk     # Fastify 5
```

### Setup

```typescript
import { VortexWebhooks } from '@teamvortexsoftware/vortex-node-22-sdk';

// The signing secret comes from your webhook destination in the Vortex dashboard
const webhooks = new VortexWebhooks({
  secret: process.env.VORTEX_WEBHOOK_SECRET!,
});
```

### Quick start with Express

The fastest way to get webhooks working. You define the route, we handle verification and routing:

```typescript
import express from 'express';
import { VortexWebhooks, WebhookEventTypes } from '@teamvortexsoftware/vortex-node-22-sdk';
import { createVortexWebhookHandler } from '@teamvortexsoftware/vortex-express-5-sdk';

const app = express();
const webhooks = new VortexWebhooks({ secret: process.env.VORTEX_WEBHOOK_SECRET! });

// IMPORTANT: Use express.raw() so the handler gets the raw body for signature verification.
// If you use express.json() globally, exclude this route or the signature check will fail.
app.post('/webhooks/vortex',
  express.raw({ type: 'application/json' }),
  createVortexWebhookHandler(webhooks, {
    // Handle specific event types
    on: {
      [WebhookEventTypes.INVITATION_ACCEPTED]: async (event) => {
        // event.data contains the invitation details
        const email = event.data.targetEmail as string;
        console.log(`Invitation accepted by ${email}`);
        await myApp.grantAccess(email, event.data.groups);
      },

      [WebhookEventTypes.INVITATION_EMAIL_BOUNCED]: async (event) => {
        // Mark the email as invalid in your system
        await myApp.flagInvalidEmail(event.data.targetEmail as string);
      },

      [WebhookEventTypes.MEMBER_CREATED]: async (event) => {
        // A new member was created (typically after accepting an invitation)
        await myApp.sendWelcomeNotification(event.data);
      },

      [WebhookEventTypes.ABTEST_WINNER_DECLARED]: async (event) => {
        // An A/B test resolved — you might want to log this
        console.log('A/B test winner:', event.data);
      },
    },

    // Optionally handle ALL webhook events (runs after the specific handler above)
    onEvent: async (event) => {
      // Good place for logging, audit trails, or forwarding to your own event bus
      console.log(`[vortex] ${event.type} (${event.id}) at ${event.timestamp}`);
      await myEventBus.publish('vortex.webhook', event);
    },

    // Handle analytics events separately (these are client-side telemetry, not state changes)
    onAnalyticsEvent: async (event) => {
      // Forward to your analytics warehouse
      await myWarehouse.ingest({
        source: 'vortex',
        event: event.name,
        userId: event.foreignUserId,
        properties: event.payload,
        timestamp: event.timestamp,
      });
    },

    // Optional error handler — if omitted, errors result in 401/500 responses
    onError: (err) => {
      console.error('Vortex webhook error:', err.message);
      myErrorTracker.captureException(err);
    },
  })
);

app.listen(3000);
```

### Quick start with Next.js (App Router)

Create a route handler file and export the POST handler:

```typescript
// app/api/webhooks/vortex/route.ts
import { VortexWebhooks, WebhookEventTypes } from '@teamvortexsoftware/vortex-node-22-sdk';
import { createVortexWebhookRouteHandler } from '@teamvortexsoftware/vortex-nextjs-15-sdk';

const webhooks = new VortexWebhooks({ secret: process.env.VORTEX_WEBHOOK_SECRET! });

export const POST = createVortexWebhookRouteHandler(webhooks, {
  on: {
    [WebhookEventTypes.INVITATION_ACCEPTED]: async (event) => {
      const email = event.data.targetEmail as string;

      // Grant access in your system
      await db.user.update({
        where: { email },
        data: { status: 'active', invitedAt: event.timestamp },
      });
    },

    [WebhookEventTypes.INVITATION_EMAIL_BOUNCED]: async (event) => {
      // Clean up invalid invitations
      await db.invitation.update({
        where: { vortexId: event.data.invitationId as string },
        data: { status: 'bounced' },
      });
    },
  },

  onEvent: async (event) => {
    // Log all events for debugging
    console.log(`[vortex webhook] ${event.type}`, event.id);
  },
});
```

**Note:** Next.js App Router route handlers automatically receive the raw request body, so no special body parser configuration is needed.

### Quick start with Fastify

```typescript
import Fastify from 'fastify';
import fastifyRawBody from 'fastify-raw-body';
import { VortexWebhooks, WebhookEventTypes } from '@teamvortexsoftware/vortex-node-22-sdk';
import { createVortexWebhookHandler } from '@teamvortexsoftware/vortex-fastify-5-sdk';

const app = Fastify();

// Register the raw body plugin so the handler can verify the signature
await app.register(fastifyRawBody);

const webhooks = new VortexWebhooks({ secret: process.env.VORTEX_WEBHOOK_SECRET! });

app.post('/webhooks/vortex', createVortexWebhookHandler(webhooks, {
  on: {
    [WebhookEventTypes.INVITATION_ACCEPTED]: async (event) => {
      await grantWorkspaceAccess(event.data);
    },
    [WebhookEventTypes.EMAIL_COMPLAINED]: async (event) => {
      // Someone marked your invitation email as spam — suppress future sends
      await suppressEmail(event.data.targetEmail as string);
    },
  },
  onEvent: async (event) => {
    app.log.info({ vortexEvent: event.type, eventId: event.id }, 'Vortex webhook received');
  },
}));

await app.listen({ port: 3000 });
```

### Using the core directly (no framework helper)

If you're using a framework we don't have a helper for, or you want full control, use `VortexWebhooks` directly. All you need is the raw request body and the signature header:

```typescript
import { VortexWebhooks, isWebhookEvent, isAnalyticsEvent } from '@teamvortexsoftware/vortex-node-22-sdk';

const webhooks = new VortexWebhooks({ secret: process.env.VORTEX_WEBHOOK_SECRET! });

// In whatever HTTP handler your framework gives you:
async function handleVortexWebhook(rawBody: string | Buffer, headers: Record<string, string>) {
  const signature = headers['x-vortex-signature'];

  // constructEvent() verifies the signature and parses the JSON in one step.
  // Throws VortexWebhookSignatureError if the signature is invalid.
  const event = webhooks.constructEvent(rawBody, signature);

  if (isWebhookEvent(event)) {
    // This is a server-side state change (invitation accepted, member created, etc.)
    console.log(`Webhook: ${event.type}`, event.data);

    switch (event.type) {
      case 'invitation.accepted':
        await handleInvitationAccepted(event.data);
        break;
      case 'member.created':
        await handleMemberCreated(event.data);
        break;
      // ... handle other event types
    }
  } else if (isAnalyticsEvent(event)) {
    // This is client-side behavioral telemetry (widget loaded, share triggered, etc.)
    console.log(`Analytics: ${event.name}`, event.payload);
    await forwardToWarehouse(event);
  }
}
```

### Webhook event payload shape

Every webhook event delivered to your endpoint follows this structure:

```typescript
{
  id: string;              // Unique event ID — use for idempotency
  type: string;            // Event type (e.g., 'invitation.accepted')
  timestamp: string;       // ISO-8601 timestamp of when the event occurred
  accountId: string;       // Your Vortex account ID
  environmentId: string;   // The environment (nullable)
  sourceTable: string;     // Internal: the DB table that triggered the event
  operation: string;       // 'insert' | 'update' | 'delete'
  data: object;            // Event-specific payload (invitation details, member info, etc.)
}
```

### Analytics event payload shape

```typescript
{
  id: string;                      // Unique event ID
  name: string;                    // Event name (e.g., 'widget_loaded')
  accountId: string;               // Your Vortex account ID
  organizationId: string;
  projectId: string;
  environmentId: string;
  deploymentId: string | null;     // Which deployment generated this event
  widgetConfigurationId: string | null;
  foreignUserId: string | null;    // The user in your system who triggered this
  sessionId: string | null;        // Analytics session
  payload: object | null;          // Event-specific data (variant, etc.)
  platform: string | null;         // 'web', 'ios', 'android'
  segmentation: string | null;     // A/B test segment label
  timestamp: string;               // ISO-8601
}
```

### Event types reference

Use the `WebhookEventTypes` constants for type-safe event matching:

```typescript
import { WebhookEventTypes } from '@teamvortexsoftware/vortex-node-22-sdk';

// WebhookEventTypes.INVITATION_ACCEPTED === 'invitation.accepted'
```

| Constant | Value | Description |
|----------|-------|-------------|
| `INVITATION_CREATED` | `invitation.created` | A new invitation was created and sent |
| `INVITATION_ACCEPTED` | `invitation.accepted` | An invitation was accepted by the recipient |
| `INVITATION_DEACTIVATED` | `invitation.deactivated` | An invitation was deactivated/cancelled |
| `INVITATION_EMAIL_DELIVERED` | `invitation.email.delivered` | Invitation email successfully delivered |
| `INVITATION_EMAIL_BOUNCED` | `invitation.email.bounced` | Invitation email bounced (hard bounce) |
| `INVITATION_EMAIL_OPENED` | `invitation.email.opened` | Invitation email was opened |
| `INVITATION_LINK_CLICKED` | `invitation.link.clicked` | Invitation link was clicked |
| `INVITATION_REMINDER_SENT` | `invitation.reminder.sent` | A reminder/nudge email was sent |
| `DEPLOYMENT_CREATED` | `deployment.created` | A new deployment was created/activated |
| `DEPLOYMENT_DEACTIVATED` | `deployment.deactivated` | A deployment was deactivated |
| `ABTEST_STARTED` | `abtest.started` | An A/B test experiment was started |
| `ABTEST_WINNER_DECLARED` | `abtest.winner_declared` | An A/B test winner was declared |
| `MEMBER_CREATED` | `member.created` | A new member was created (via invitation accept) |
| `GROUP_MEMBER_ADDED` | `group.member.added` | A member was added to a group |
| `EMAIL_COMPLAINED` | `email.complained` | A spam complaint was received |

### Signature verification details

Vortex signs every webhook payload with HMAC-SHA256 using your destination's signing secret. The hex-encoded signature is sent in the `X-Vortex-Signature` header.

The SDK verifies signatures using timing-safe comparison to prevent timing attacks.

**Important:** `constructEvent()` requires the **raw request body** (string or Buffer), not a parsed JSON object. If you pass `JSON.stringify(parsedBody)`, the signature check may fail because JSON serialization is not guaranteed to produce identical output. Make sure your body parser preserves the raw bytes:

- **Express:** Use `express.raw({ type: 'application/json' })` on the webhook route
- **Fastify:** Use the `fastify-raw-body` plugin
- **Next.js:** App Router route handlers receive raw text via `request.text()` automatically

### Best practices

1. **Return 200 quickly.** Process events asynchronously (e.g., queue them) if your handler logic is slow. Vortex may retry if your endpoint takes too long.
2. **Use the event `id` for idempotency.** Webhook deliveries can be retried, so your handler should be idempotent — store the event ID and skip duplicates.
3. **Subscribe only to events you need.** In the Vortex dashboard, select only the event types your application cares about to reduce noise.
4. **Keep your signing secret safe.** Treat it like an API key. Rotate it in the dashboard if compromised.
