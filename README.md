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
