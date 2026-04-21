#!/usr/bin/env npx ts-node

/**
 * SDK Manifest Extractor
 *
 * Extracts method signatures, types, and documentation from the SDK source code
 * to produce a manifest.json for documentation generation.
 *
 * Usage:
 *   npx ts-node bin/extract-manifest.ts > manifest.json
 *   npx ts-node bin/extract-manifest.ts --pretty
 */

import { Project, MethodDeclaration, JSDoc, Type, ParameterDeclaration } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SDK_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(SDK_DIR, 'src');

interface Param {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  default?: string;
}

interface ReturnType {
  type: string;
  description?: string;
}

interface CodeExample {
  code: string;
  description?: string;
}

interface Method {
  name: string;
  category: string;
  signature: string;
  params: Param[];
  returns: ReturnType;
  description: string;
  example?: CodeExample;
  since: string;
  deprecated?: boolean;
  deprecationMessage?: string;
}

interface TypeDef {
  name: string;
  description?: string;
  fields: Param[];
  deprecated?: boolean;
  deprecationMessage?: string;
}

/**
 * Extract @example code block from JSDoc
 */
function extractExample(jsdoc: JSDoc | undefined): CodeExample | undefined {
  if (!jsdoc) return undefined;

  const exampleTag = jsdoc.getTags().find((tag) => tag.getTagName() === 'example');
  if (!exampleTag) return undefined;

  const text = exampleTag.getCommentText() || '';
  // Extract code from markdown code block
  const codeMatch = text.match(/```(?:typescript|ts)?\n?([\s\S]*?)```/);
  if (codeMatch) {
    return { code: codeMatch[1].trim() };
  }
  return { code: text.trim() };
}

/**
 * Extract parameter description from JSDoc @param tag
 */
function extractParamDescription(jsdoc: JSDoc | undefined, paramName: string): string | undefined {
  if (!jsdoc) return undefined;

  for (const tag of jsdoc.getTags()) {
    if (tag.getTagName() !== 'param') continue;

    const fullText = tag.getText();
    // Match patterns like:
    // @param paramName - description
    // @param paramName description
    // @param {Type} paramName - description
    // @param params.field - description (for nested)

    // Check if this tag is for our parameter
    // Use word boundary (\b) to avoid matching prefixes (e.g., 'scope' matching 'scopeType')
    const paramMatch = fullText.match(
      new RegExp(
        `@param\\s+(?:\\{[^}]+\\}\\s+)?(?:${paramName}\\b|${paramName}\\.\\w+)\\s*[-–—]?\\s*(.*)`,
        's'
      )
    );

    if (paramMatch) {
      // If it's a nested param (like params.user), extract that specific description
      if (fullText.includes(`${paramName}.`)) {
        continue; // Skip nested params, we want the main param
      }
      let desc = paramMatch[1]?.trim();
      // Clean up JSDoc artifacts
      if (desc) {
        desc = desc
          .replace(/\n\s*\*\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return desc;
      }
    }

    // Also check comment text directly
    const commentText = tag.getCommentText() || '';
    // Use word boundary regex for startsWith check too (e.g., 'scopeType'.startsWith('scope') is true but shouldn't match)
    const startsWithParam = new RegExp(`^${paramName}\\b`).test(commentText);
    const containsParam =
      commentText.includes(`${paramName} `) && !new RegExp(`\\w${paramName}`).test(commentText);
    if (startsWithParam || containsParam) {
      // Extract description after param name (with word boundary to avoid prefix matches)
      const descMatch = commentText.match(new RegExp(`^${paramName}\\b\\s*[-–—]?\\s*(.+)`, 's'));
      if (descMatch) {
        let desc = descMatch[1].trim();
        desc = desc
          .replace(/\n\s*\*\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return desc;
      }
    }
  }

  return undefined;
}

/**
 * Extract @returns description from JSDoc
 */
function extractReturnsDescription(jsdoc: JSDoc | undefined): string | undefined {
  if (!jsdoc) return undefined;

  const returnsTag = jsdoc
    .getTags()
    .find((tag) => tag.getTagName() === 'returns' || tag.getTagName() === 'return');

  return returnsTag?.getCommentText()?.trim();
}

/**
 * Get decorator argument value by name
 */
function getDecoratorArg(
  method: MethodDeclaration,
  decoratorName: string,
  argName: string
): string | boolean | undefined {
  const decorator = method.getDecorator(decoratorName);
  if (!decorator) return undefined;

  const args = decorator.getArguments();
  if (args.length === 0) return undefined;

  // For decorators like @VortexMethod({ category: 'auth', since: '0.5.0' })
  const objArg = args[0];
  const text = objArg.getText();

  // Parse the object literal
  const match = text.match(new RegExp(`${argName}:\\s*['"]([^'"]+)['"]`));
  if (match) return match[1];

  // Check for boolean values
  const boolMatch = text.match(new RegExp(`${argName}:\\s*(true|false)`));
  if (boolMatch) return boolMatch[1] === 'true';

  return undefined;
}

/**
 * Check if method has a specific decorator
 */
function hasDecorator(method: MethodDeclaration, decoratorName: string): boolean {
  return method.getDecorator(decoratorName) !== undefined;
}

/**
 * Format a type for display, simplifying complex types
 */
function formatType(type: Type): string {
  const text = type.getText();
  // Simplify import paths
  return text.replace(/import\([^)]+\)\./g, '');
}

/**
 * Extract method information
 */
function extractMethod(method: MethodDeclaration): Method | null {
  const name = method.getName();

  // Skip private methods and implementation signatures for overloads
  if (name.startsWith('_') || method.getScope() === 'private') {
    return null;
  }

  // Skip methods without our decorator (internal helpers)
  if (!hasDecorator(method, 'VortexMethod')) {
    return null;
  }

  // Skip internal methods (not for public docs)
  const isInternal = getDecoratorArg(method, 'VortexMethod', 'internal') as boolean | undefined;
  if (isInternal) {
    return null;
  }

  const jsdoc = method.getJsDocs()[0];
  const isPrimary = hasDecorator(method, 'VortexPrimary');

  // Get decorator metadata
  const category = getDecoratorArg(method, 'VortexMethod', 'category') as string;
  const since = getDecoratorArg(method, 'VortexMethod', 'since') as string;
  const deprecated = getDecoratorArg(method, 'VortexMethod', 'deprecated') as boolean | undefined;
  const deprecationMessage = getDecoratorArg(method, 'VortexMethod', 'deprecationMessage') as
    | string
    | undefined;

  // Extract parameters
  const params: Param[] = method.getParameters().map((param: ParameterDeclaration) => {
    const paramType = param.getType();
    return {
      name: param.getName(),
      type: formatType(paramType),
      required: !param.isOptional() && !param.hasInitializer(),
      description: extractParamDescription(jsdoc, param.getName()),
      default: param.getInitializer()?.getText(),
    };
  });

  // Extract return type
  const returnType = method.getReturnType();
  const returns: ReturnType = {
    type: formatType(returnType),
    description: extractReturnsDescription(jsdoc),
  };

  // Build signature
  const signature = `${name}(${params.map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ')}): ${returns.type}`;

  // Extract description from JSDoc
  const description = jsdoc?.getDescription()?.trim() || '';

  const methodData: Method = {
    name,
    category: category || 'uncategorized',
    signature,
    params,
    returns,
    description,
    example: extractExample(jsdoc),
    since: since || '0.0.0',
  };

  if (deprecated) {
    methodData.deprecated = true;
    if (deprecationMessage) {
      methodData.deprecationMessage = deprecationMessage;
    }
  }

  return methodData;
}

/**
 * Extract types from types.ts
 */
function extractTypes(project: Project): TypeDef[] {
  const typesFile = project.getSourceFile(path.join(SRC_DIR, 'types.ts'));
  if (!typesFile) return [];

  const types: TypeDef[] = [];

  // Internal types to exclude from public docs
  const internalTypePatterns = ['CreateInvitation', 'Unfurl'];

  // Extract interfaces
  for (const iface of typesFile.getInterfaces()) {
    const name = iface.getName();
    // Only include "public" types (not internal helpers)
    if (name.startsWith('_') || name.endsWith('Internal')) continue;
    // Skip internal types
    if (internalTypePatterns.some((pattern) => name.startsWith(pattern))) continue;

    const jsdoc = iface.getJsDocs()[0];
    const fields: Param[] = iface.getProperties().map((prop) => ({
      name: prop.getName(),
      type: formatType(prop.getType()),
      required: !prop.hasQuestionToken(),
      description: prop.getJsDocs()[0]?.getDescription()?.trim(),
    }));

    types.push({
      name,
      description: jsdoc?.getDescription()?.trim(),
      fields,
    });
  }

  // Extract type aliases that represent objects
  for (const typeAlias of typesFile.getTypeAliases()) {
    const name = typeAlias.getName();
    if (name.startsWith('_')) continue;
    // Skip internal types
    if (internalTypePatterns.some((pattern) => name.startsWith(pattern))) continue;

    const type = typeAlias.getType();
    // Handle both plain object types and intersection types (e.g., InvitationResult = InvitationResultBase & {...})
    if (!type.isObject() && !type.isIntersection()) continue;

    const jsdoc = typeAlias.getJsDocs()[0];
    const fields: Param[] = type.getProperties().map((prop) => {
      const decl = prop.getValueDeclaration();
      // Extract JSDoc description from the property declaration
      let description: string | undefined;
      let isDeprecated = false;
      if (decl && 'getJsDocs' in decl) {
        const propJsdoc = (decl as any).getJsDocs?.()[0];
        description = propJsdoc?.getDescription?.()?.trim();
        // Check for @deprecated tag
        const deprecatedTag = propJsdoc
          ?.getTags?.()
          ?.find((t: any) => t.getTagName() === 'deprecated');
        if (deprecatedTag) {
          isDeprecated = true;
          const deprecatedText = deprecatedTag.getCommentText?.()?.trim() || '';
          description = `⚠️ **Deprecated**${deprecatedText ? `: ${deprecatedText}` : ''}`;
        }
      }
      return {
        name: prop.getName(),
        type: formatType(prop.getTypeAtLocation(typeAlias)),
        required: !(decl && 'hasQuestionToken' in decl && (decl as any).hasQuestionToken()),
        description,
      };
    });

    if (fields.length > 0) {
      const typeDef: TypeDef = {
        name,
        description: jsdoc?.getDescription()?.trim(),
        fields,
      };

      // Check for @deprecated tag on the type itself
      const deprecatedTag = jsdoc?.getTags()?.find((t) => t.getTagName() === 'deprecated');
      if (deprecatedTag) {
        typeDef.deprecated = true;
        const deprecatedText = deprecatedTag.getCommentText()?.trim();
        if (deprecatedText) {
          typeDef.deprecationMessage = deprecatedText;
        }
      }

      types.push(typeDef);
    }
  }

  return types;
}

/**
 * Main extraction function
 */
function extractManifest() {
  // Read package.json for SDK metadata
  const packageJson = JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf-8'));

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: path.join(SDK_DIR, 'tsconfig.json'),
  });

  // Get the main Vortex class
  const vortexFile = project.getSourceFile(path.join(SRC_DIR, 'vortex.ts'));
  if (!vortexFile) {
    throw new Error('Could not find vortex.ts');
  }

  const vortexClass = vortexFile.getClass('Vortex');
  if (!vortexClass) {
    throw new Error('Could not find Vortex class');
  }

  // Extract methods
  const methods = vortexClass
    .getMethods()
    .map(extractMethod)
    .filter((m): m is Method => m !== null);

  // Separate primary and secondary methods
  const primaryMethods = methods.filter((m) => {
    const method = vortexClass.getMethod(m.name);
    return method && hasDecorator(method, 'VortexPrimary');
  });

  const secondaryMethods = methods.filter((m) => {
    const method = vortexClass.getMethod(m.name);
    return method && !hasDecorator(method, 'VortexPrimary');
  });

  // Extract types
  const types = extractTypes(project);

  // Build manifest
  const manifest = {
    sdk: {
      name: packageJson.name,
      language: 'typescript' as const,
      version: packageJson.version,
      repository: 'https://github.com/teamvortexsoftware/vortex-node-22-sdk',
      package: {
        name: packageJson.name,
        registry: 'npm' as const,
      },
    },
    overview: {
      product: {
        name: 'Vortex',
        tagline: 'Invitation infrastructure for modern apps',
        description:
          'Vortex handles the complete invitation lifecycle — sending invites via email/SMS/share links, ' +
          'tracking clicks and conversions, managing referral programs, and optimizing your invitation flows with A/B testing. ' +
          'You focus on your product; Vortex handles the growth mechanics.',
        learnMoreUrl: 'https://tryvortex.com',
      },
      sdkPurpose: {
        summary:
          'This backend SDK securely signs user data for Vortex components. Your API key stays on your server, ' +
          'while the signed token is passed to the frontend where Vortex components render the invitation UI.',
        keyBenefits: [
          'Keep your API key secure — it never touches the browser',
          'Sign user identity for attribution — know who sent each invitation',
          'Control what data components can access via scoped tokens',
          'Verify webhook signatures for secure event handling',
        ],
      },
      architecture: {
        summary:
          'Vortex uses a split architecture: your backend signs tokens with the SDK, ' +
          'and your frontend renders components that use those tokens to securely interact with Vortex.',
        flow: [
          {
            step: '1. Install the backend SDK',
            description: 'Add this SDK to your Node.js server',
            location: 'backend' as const,
            code: `npm install @teamvortexsoftware/vortex-node-22-sdk`,
          },
          {
            step: '2. Initialize the client',
            description: 'Create a Vortex client with your API key (keep this on the server!)',
            location: 'backend' as const,
            code: `import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';\n\nconst vortex = new Vortex(process.env.VORTEX_API_KEY);`,
          },
          {
            step: '3. Generate a token for the current user',
            description:
              'When a user loads a page with a Vortex component, generate a signed token on your server',
            location: 'backend' as const,
            code: `const token = vortex.generateToken({ user: { id: currentUser.id } });`,
          },
          {
            step: '4. Pass the token to your frontend',
            description: 'Include the token in your page response or API response',
            location: 'backend' as const,
            code: `res.json({ vortexToken: token, ...otherData });`,
          },
          {
            step: '5. Render a Vortex component with the token',
            description: 'Use the React/Angular/Web Component with the token',
            location: 'frontend' as const,
            code: `import { VortexInvite } from '@teamvortexsoftware/vortex-react';\n\n<VortexInvite token={vortexToken} />`,
          },
          {
            step: '6. Vortex handles the rest',
            description:
              'The component securely communicates with Vortex servers, displays the invitation UI, ' +
              'sends emails/SMS, tracks conversions, and reports analytics',
            location: 'vortex' as const,
          },
        ],
        diagram: `
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
`,
      },
      security: {
        summary:
          'Your Vortex API key is a secret that grants full access to your account. ' +
          'It must never be exposed to browsers or client-side code.',
        whyBackendSigning:
          'By signing tokens on your server, you:\n\n' +
          '- Keep your API key secret (it never leaves your server)\n' +
          '- Control exactly what user data is shared with components\n' +
          '- Ensure invitations are attributed to real, authenticated users\n' +
          '- Prevent abuse — users can only send invitations as themselves',
        optional:
          'Token signing is controlled by your component configuration in the Vortex dashboard. ' +
          'If "Require Secure Token" is enabled, requests without a valid token will be rejected. ' +
          'If disabled (e.g., for public referral programs), components work without backend signing. ' +
          'The SDK is still useful for server-side operations like verifying webhooks regardless of this setting.',
      },
    },
    install: {
      command: `npm install ${packageJson.name}`,
      alternates: [
        { tool: 'yarn', command: `yarn add ${packageJson.name}` },
        { tool: 'pnpm', command: `pnpm add ${packageJson.name}` },
      ],
    },
    quickstart: {
      description: 'Generate a secure token for Vortex components',
      code: `import { Vortex } from '${packageJson.name}';

const vortex = new Vortex(process.env.VORTEX_API_KEY!);

// Generate a token for the current user
const token = vortex.generateToken({
  user: { id: 'user-123', email: 'user@example.com' }
});

// Pass the token to your frontend component
// <VortexInvite token={token} />`,
    },
    initialization: {
      className: 'Vortex',
      constructor: {
        signature: 'new Vortex(apiKey: string)',
        params: [
          {
            name: 'apiKey',
            type: 'string',
            required: true,
            description: 'Your Vortex API key',
          },
        ],
        example: `const client = new Vortex(process.env.VORTEX_API_KEY!);`,
      },
      envVars: [
        {
          name: 'VORTEX_API_KEY',
          description: 'Your Vortex API key',
          required: true,
        },
      ],
    },
    methods: {
      primary: primaryMethods,
      secondary: secondaryMethods,
    },
    types,
    webhooks: {
      supported: true,
      description:
        'Webhooks let your server receive real-time notifications when events happen in Vortex. ' +
        'Use them to sync invitation state with your database, trigger onboarding flows, ' +
        'update your CRM, or send internal notifications.',
      setup: [
        '1. Go to your Vortex dashboard → Integrations → Webhooks tab',
        '2. Click "Add Webhook"',
        '3. Enter your endpoint URL (must be HTTPS in production)',
        "4. Copy the signing secret — you'll use this to verify webhook signatures",
        '5. Select which events you want to receive',
      ],
      verifyMethod: 'VortexWebhooks.constructEvent',
      signatureHeader: 'X-Vortex-Signature',
      example: {
        description: 'Express.js webhook handler',
        code: `import express from 'express';
import { VortexWebhooks, isWebhookEvent } from '@teamvortexsoftware/vortex-node-22-sdk';

const app = express();
const webhooks = new VortexWebhooks({
  secret: process.env.VORTEX_WEBHOOK_SECRET!,
});

// Important: Use raw body for signature verification
app.post('/webhooks/vortex', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = webhooks.constructEvent(
      req.body,
      req.headers['x-vortex-signature'] as string
    );

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
});`,
      },
      useCases: [
        {
          title: 'Activate users on acceptance',
          description:
            'When invitation.accepted fires, mark the user as active in your database and trigger your onboarding flow.',
        },
        {
          title: 'Track invitation performance',
          description:
            'Monitor email.delivered, email.opened, and link.clicked events to measure invitation funnel metrics.',
        },
        {
          title: 'Sync team membership',
          description:
            'Use member.created and group.member.added to keep your internal membership records in sync.',
        },
        {
          title: 'Alert on delivery issues',
          description:
            'Watch for email.bounced events to proactively reach out via alternative channels.',
        },
      ],
      events: [
        { name: 'invitation.created', description: 'A new invitation was created' },
        { name: 'invitation.accepted', description: 'An invitation was accepted by the recipient' },
        {
          name: 'invitation.deactivated',
          description: 'An invitation was deactivated (revoked or expired)',
        },
        {
          name: 'invitation.email.delivered',
          description: 'Invitation email was successfully delivered',
        },
        {
          name: 'invitation.email.bounced',
          description: 'Invitation email bounced (invalid address)',
        },
        { name: 'invitation.email.opened', description: 'Recipient opened the invitation email' },
        { name: 'invitation.link.clicked', description: 'Recipient clicked the invitation link' },
        {
          name: 'invitation.reminder.sent',
          description: 'A reminder email was sent for a pending invitation',
        },
        {
          name: 'member.created',
          description: 'A new member was created from an accepted invitation',
        },
        { name: 'group.member.added', description: 'A member was added to a scope/group' },
        { name: 'deployment.created', description: 'A new deployment configuration was created' },
        { name: 'deployment.deactivated', description: 'A deployment was deactivated' },
        { name: 'abtest.started', description: 'An A/B test was started' },
        { name: 'abtest.winner_declared', description: 'An A/B test winner was declared' },
        { name: 'email.complained', description: 'Recipient marked the email as spam' },
      ],
      methods: [
        {
          name: 'constructEvent',
          signature: 'constructEvent(payload: string | Buffer, signature: string): VortexEvent',
          description:
            'Verify and parse an incoming webhook payload. This is the primary method for webhook handling. ' +
            'It verifies the HMAC-SHA256 signature and returns a typed event object.',
          params: [
            {
              name: 'payload',
              type: 'string | Buffer',
              description:
                'The raw request body. Must be the raw bytes, not parsed JSON — signature verification requires the exact bytes that were signed.',
            },
            {
              name: 'signature',
              type: 'string',
              description: 'The value of the X-Vortex-Signature header',
            },
          ],
          returns: 'VortexEvent (either VortexWebhookEvent or VortexAnalyticsEvent)',
          throws: 'VortexWebhookSignatureError if the signature is invalid',
        },
        {
          name: 'verifySignature',
          signature: 'verifySignature(payload: string | Buffer, signature: string): boolean',
          description:
            'Verify the HMAC-SHA256 signature of an incoming webhook payload without parsing it. ' +
            'Use this if you need to verify the signature separately from parsing.',
          params: [
            {
              name: 'payload',
              type: 'string | Buffer',
              description: 'The raw request body',
            },
            {
              name: 'signature',
              type: 'string',
              description: 'The value of the X-Vortex-Signature header',
            },
          ],
          returns: 'true if the signature is valid, false otherwise',
        },
        {
          name: 'handleEvent',
          signature: 'handleEvent(event: VortexEvent, handlers: WebhookHandlers): Promise<void>',
          description:
            'Process a verified event through handler callbacks. Useful when building custom integrations ' +
            'or using the handler-based pattern with type-specific callbacks.',
          params: [
            {
              name: 'event',
              type: 'VortexEvent',
              description: 'A parsed and verified event (from constructEvent)',
            },
            {
              name: 'handlers',
              type: 'WebhookHandlers',
              description:
                'Handler configuration with on (type-specific handlers), onEvent (all events), onAnalyticsEvent, and onError callbacks',
            },
          ],
          returns: 'Promise that resolves when handlers complete',
        },
      ],
    },
    errors: {
      baseException: 'Error',
      types: [
        {
          name: 'VortexWebhookSignatureError',
          description:
            'Thrown when webhook signature verification fails. ' +
            'Check that you are using the raw request body (not parsed JSON) ' +
            'and the correct signing secret from your Vortex dashboard.',
          thrownBy: ['VortexWebhooks.constructEvent'],
        },
        {
          name: 'Error',
          description:
            'Thrown for validation errors (e.g., missing API key, invalid user ID in generateToken/generateJwt)',
        },
      ],
    },
    examples: {
      install: {
        npm: 'npm install @teamvortexsoftware/vortex-node-22-sdk',
        pnpm: 'pnpm add @teamvortexsoftware/vortex-node-22-sdk',
        yarn: 'yarn add @teamvortexsoftware/vortex-node-22-sdk',
      },
      import: `import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';

const vortex = new Vortex(process.env.VORTEX_API_KEY!);`,
      functions: {
        generateToken: `// Generate a signed token for Vortex components
const token = vortex.generateToken({
  user: {
    id: 'user-123',                                         // Required: user ID for attribution
    email: 'user@example.com',                              // Optional: user's email
    name: 'Jane Doe',                                       // Optional: user's display name
    avatarUrl: 'https://example.com/avatars/jane.jpg',     // Optional: user's avatar URL
  },
  scope: 'workspace-456',                                   // Optional: scope/workspace ID
  vars: { company_name: 'Acme Inc' },                       // Optional: template variables
});

// Pass token to your frontend for use with Vortex components
res.json({ token });`,
        generateTokenParts: {
          beforeUser: `// Generate a signed token for Vortex components
const token = vortex.generateToken({
  user: {
    id: 'user-123',                                         // Required: user ID for attribution
    email: 'user@example.com',                              // Optional: user's email
    name: 'Jane Doe',                                       // Optional: user's display name
    avatarUrl: 'https://example.com/avatars/jane.jpg',     // Optional: user's avatar URL
  },`,
          scopeLine: `  scope: 'workspace-456',                                   // Optional: scope/workspace ID`,
          varsLine: `  vars: { company_name: 'Acme Inc' },                       // Optional: template variables`,
          afterUser: `});

// Pass token to your frontend for use with Vortex components
res.json({ token });`,
        },
        generateJwt: `// Generate JWT (legacy - prefer generateToken for new integrations)
const jwt = vortex.generateJwt({
  user: {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Jane Doe',                                       // Optional: user's display name
    avatarUrl: 'https://example.com/avatars/jane.jpg',     // Optional: user's avatar URL
  },
});

console.log('JWT:', jwt);`,
        generateJwtParts: {
          beforeUser: `// Generate JWT (legacy - prefer generateToken for new integrations)
const jwt = vortex.generateJwt({
  user: {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Jane Doe',                                       // Optional: user's display name
    avatarUrl: 'https://example.com/avatars/jane.jpg',     // Optional: user's avatar URL`,
          adminScopesLine: `    adminScopes: ['autojoin'],                           // Optional: grants autojoin admin privileges`,
          allowedEmailDomainsLine: `    allowedEmailDomains: ['example.com'],                   // Optional: restrict by email domain`,
          afterUser: `  },
});

console.log('JWT:', jwt);`,
        },
        acceptInvitations: `// Accept one or more invitations for a user
const result = await vortex.acceptInvitations(
  ['invitation-id-1', 'invitation-id-2'],
  {
    email: 'user@example.com',
    name: 'John Doe' // Optional
  }
);

console.log('Accepted invitations:', result);`,
        getInvitations: `// Get a single invitation by ID
const invitation = await vortex.getInvitation('invitation-id');
console.log('Invitation:', invitation);`,
        getInvitationsByTarget: `// Get invitations by target
const invitations = await vortex.getInvitationsByTarget(
  'email',
  'user@example.com'
);

console.log('Invitations:', invitations);`,
      },
    },
  };

  return manifest;
}

// Main
const args = process.argv.slice(2);
const pretty = args.includes('--pretty');
const outIdx = args.indexOf('--out');
const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

try {
  const manifest = extractManifest();
  const json = JSON.stringify(manifest, null, pretty || outPath ? 2 : undefined);

  if (outPath) {
    fs.writeFileSync(outPath, json);
    console.log(`Manifest written to ${outPath}`);
  } else {
    console.log(json);
  }
} catch (error) {
  console.error('Error extracting manifest:', error);
  process.exit(1);
}
