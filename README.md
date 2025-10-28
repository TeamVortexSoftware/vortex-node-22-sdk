# Vortex NodeJS SDK

This package provides the Vortex Node/Typescript SDK.

With this module, you can both generate a JWT for use with the Vortex Widget and make API calls to the Vortex API.

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
  { type: 'sms', value: '18008675309' }
];

// groups are specific to your product. This list should be the groups that the current requesting user is a part of. It is up to you to define them if you so choose. Based on the values here, we can determine whether or not the user is allowed to invite others to a particular group
const groups = [
  { type: 'workspace', groupId: 'some-workspace-id', name: 'The greatest workspace...pause...in the world' },
  { type: 'document', groupId: 'some-document-id', name: 'Ricky\'s grade 10 word papers' },
  { type: 'document', groupId: 'another-document-id', name: 'Sunnyvale bylaws' }
];

// If your product has the concept of user roles (admin, guest, member, etc), provide it here
const role = 'admin';

// Provide your API key however you see fit.
const vortex = new Vortex(process.env.VORTEX_API_KEY);

app.get('/vortex-jwt', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ jwt: vortex.generateJwt({
    userId,
    identifiers,
    groups,
    role
  })}));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}. Fetch example JWT by hitting /vortex-jwt`)
})
```

Now, you can utilize that JWT endpoint in conjuction with the Vortex widget

Here's an example hook:

```ts
import { useEffect, useState } from "react";

export function useVortexJwt() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchJwt() {
      try {
        const res = await fetch("/vortex-jwt");
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
})
```
### View invitations by target (email address for example)

Depending on your use case, you may want to accept all outstanding invitations to a given user when they sign up for your service. If you don't want to auto accept, you may want to present the new user with a list of all invitations that target them. Either way, the example below shows how you fetch these invitations once you know how to identify (via email, sms or others in the future) a new user to your product.

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
})
```
### Accept invitations

This is how you'd accept one or more invitations with the SDK. You want this as part of your signup flow more than likely. When someone clicks on an invitation link, we redirect to the landing page you specified in the widget configuration. Ultimately, the user will sign up with your service and that is when you create the relationship between the newly created user in your system and whatever grouping defined in the invitation itself.

Illustrated in the example below, you will see how to accept one or more invitations. For the sake of the example, we'll assume you want to accept all open invitations when a user signs up to your service. The example will leverage the previous example's call to getInvitationsByTarget with the acceptInvitations call.

```ts
app.post('/signup', async (req, res) => {
  const email = req.body.email;
  if (!email) {
    // gracefully handle this situation
    return res.status(400).send('Email is required');
  }

  // YOUR signup logic, whatever it may be
  await myApp.doSignupLogic(email); 

  // you may want to do this even if the user is signing up without clicking an invitaiton link
  const invitations = await vortex.getInvitationsByTarget('email', email);

  // Assume that your application may pass the original invitationId from the 
  // landing page registered with the configured widget
  const invitationId = req.body.invitationId;

  const uniqueInvitationIds = invitations.map((invitation) => invitation.id);
  if (invitationId && uniqueInvitationIds.indexOf(invitationId) === -1) {
    uniqueInvitationIds.push(invitationId);
  }

  const acceptedInvitations = await vortex.acceptInvitations(
    uniqueInvitationIds,
    { type: 'email', value: email }
  );
  
  // continue with post-signup activity. perhaps redirect to your logged in landing page

  res.redirect(302, '/app');
})
```
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
})
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
})
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
})
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
})
```