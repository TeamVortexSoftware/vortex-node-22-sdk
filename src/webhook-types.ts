/**
 * Vortex Webhook Types
 *
 * Self-contained type definitions for webhook event handling.
 * These mirror the server-side types from base-node/webhooks but are
 * kept independent so the SDK has no internal dependencies.
 *
 * @see DEV-1769
 */

// ─── Webhook Event Type Constants ──────────────────────────────────────

export const WebhookEventTypes = {
  // Invitation Lifecycle
  INVITATION_CREATED: 'invitation.created',
  INVITATION_ACCEPTED: 'invitation.accepted',
  INVITATION_DEACTIVATED: 'invitation.deactivated',
  INVITATION_EMAIL_DELIVERED: 'invitation.email.delivered',
  INVITATION_EMAIL_BOUNCED: 'invitation.email.bounced',
  INVITATION_EMAIL_OPENED: 'invitation.email.opened',
  INVITATION_LINK_CLICKED: 'invitation.link.clicked',
  INVITATION_REMINDER_SENT: 'invitation.reminder.sent',

  // Deployment Lifecycle
  DEPLOYMENT_CREATED: 'deployment.created',
  DEPLOYMENT_DEACTIVATED: 'deployment.deactivated',

  // A/B Testing
  ABTEST_STARTED: 'abtest.started',
  ABTEST_WINNER_DECLARED: 'abtest.winner_declared',

  // Member/Group
  MEMBER_CREATED: 'member.created',
  GROUP_MEMBER_ADDED: 'group.member.added',

  // Email
  EMAIL_COMPLAINED: 'email.complained',
} as const;

export type WebhookEventType = (typeof WebhookEventTypes)[keyof typeof WebhookEventTypes];

/** All webhook event type string values */
export const ALL_WEBHOOK_EVENT_TYPES: WebhookEventType[] = Object.values(WebhookEventTypes);

// ─── Analytics Event Type Constants ────────────────────────────────────

export const AnalyticsEventTypes = {
  /** Widget was loaded/rendered */
  WIDGET_LOADED: 'widget_loaded',
  /** Invitation was sent via widget */
  INVITATION_SENT: 'invitation_sent',
  /** Invitation link was clicked */
  INVITATION_CLICKED: 'invitation_clicked',
  /** Invitation was accepted via widget */
  INVITATION_ACCEPTED: 'invitation_accepted',
  /** Share action triggered */
  SHARE_TRIGGERED: 'share_triggered',
} as const;

export type AnalyticsEventType = (typeof AnalyticsEventTypes)[keyof typeof AnalyticsEventTypes];

// ─── Webhook Event Payload (Vortex state changes) ──────────────────────

/**
 * A Vortex webhook event representing a server-side state change.
 * Delivered to customer webhook endpoints when subscribed events occur.
 */
export interface VortexWebhookEvent {
  /** Unique event ID (for idempotency) */
  id: string;
  /** The semantic event type (e.g., 'invitation.accepted') */
  type: WebhookEventType;
  /** ISO-8601 timestamp of when the event occurred */
  timestamp: string;
  /** The account ID this event belongs to */
  accountId: string;
  /** The environment ID (if scoped) */
  environmentId: string | null;
  /** The source table that triggered this event */
  sourceTable: string;
  /** The database operation that triggered this event */
  operation: 'insert' | 'update' | 'delete';
  /** Event-specific payload data */
  data: Record<string, unknown>;
}

// ─── Analytics Event Payload (behavioral telemetry) ────────────────────

/**
 * An analytics event representing client-side behavioral telemetry.
 * Delivered to customer webhook endpoints when analytics forwarding is enabled.
 */
export interface VortexAnalyticsEvent {
  /** Unique event ID */
  id: string;
  /** The analytics event name */
  name: string;
  /** The account ID */
  accountId: string;
  /** Organization/project identifiers */
  organizationId: string;
  projectId: string;
  environmentId: string;
  /** Deployment that generated this event */
  deploymentId: string | null;
  /** Widget configuration ID */
  widgetConfigurationId: string | null;
  /** The user who triggered the event (customer's user ID) */
  foreignUserId: string | null;
  /** Analytics session ID */
  sessionId: string | null;
  /** Event-specific payload */
  payload: Record<string, unknown> | null;
  /** Client platform (web, ios, android) */
  platform: string | null;
  /** Segmentation label (e.g., A/B test variant) */
  segmentation: string | null;
  /** ISO-8601 timestamp */
  timestamp: string;
}

// ─── Union & Discriminator ─────────────────────────────────────────────

/** Any event delivered to a Vortex webhook endpoint */
export type VortexEvent = VortexWebhookEvent | VortexAnalyticsEvent;

/**
 * Type guard: returns true if the event is a Vortex webhook event (state change).
 */
export function isWebhookEvent(event: VortexEvent): event is VortexWebhookEvent {
  return 'type' in event && !('name' in event);
}

/**
 * Type guard: returns true if the event is an analytics event (telemetry).
 */
export function isAnalyticsEvent(event: VortexEvent): event is VortexAnalyticsEvent {
  return 'name' in event;
}
