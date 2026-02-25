import crypto from 'node:crypto';
import {
  VortexWebhookEvent,
  VortexAnalyticsEvent,
  VortexEvent,
  WebhookEventType,
  isWebhookEvent,
  isAnalyticsEvent,
} from './webhook-types';

// ─── Errors ────────────────────────────────────────────────────────────

/**
 * Thrown when webhook signature verification fails.
 */
export class VortexWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VortexWebhookSignatureError';
  }
}

// ─── Handler Types ─────────────────────────────────────────────────────

/** Handler for a specific webhook event type */
export type WebhookEventTypeHandler = (event: VortexWebhookEvent) => void | Promise<void>;

/** Handler for any webhook event */
export type WebhookEventHandler = (event: VortexWebhookEvent) => void | Promise<void>;

/** Handler for analytics events */
export type AnalyticsEventHandler = (event: VortexAnalyticsEvent) => void | Promise<void>;

/**
 * Webhook handler configuration.
 * Customers pass this to framework-specific handler factories.
 */
export interface WebhookHandlers {
  /**
   * Handle specific webhook event types by name.
   * These run before `onEvent`.
   *
   * @example
   * ```typescript
   * on: {
   *   'invitation.accepted': async (event) => {
   *     await db.activateUser(event.data.targetEmail);
   *   },
   *   'member.created': async (event) => {
   *     await analytics.track('new_member', event.data);
   *   },
   * }
   * ```
   */
  on?: Partial<Record<WebhookEventType, WebhookEventTypeHandler>>;

  /**
   * Handle all Vortex webhook events (state changes).
   * Runs after any matching `on` handler.
   */
  onEvent?: WebhookEventHandler;

  /**
   * Handle analytics events (behavioral telemetry).
   */
  onAnalyticsEvent?: AnalyticsEventHandler;

  /**
   * Called when signature verification fails or handler throws.
   * If not provided, errors are thrown to the framework.
   */
  onError?: (error: Error) => void;
}

// ─── Core Webhooks Class ───────────────────────────────────────────────

export interface VortexWebhooksOptions {
  /** The webhook signing secret from your Vortex dashboard */
  secret: string;
}

/**
 * Core webhook verification and parsing.
 *
 * This class is framework-agnostic — use it directly or with
 * the framework-specific handler factories (Express, Next.js, Fastify).
 *
 * @example
 * ```typescript
 * import { VortexWebhooks } from '@teamvortexsoftware/vortex-node-22-sdk';
 *
 * const webhooks = new VortexWebhooks({
 *   secret: process.env.VORTEX_WEBHOOK_SECRET!,
 * });
 *
 * // In any HTTP handler:
 * const event = webhooks.constructEvent(rawBody, signatureHeader);
 * ```
 */
export class VortexWebhooks {
  private readonly secret: string;

  constructor(options: VortexWebhooksOptions) {
    if (!options.secret) {
      throw new Error('VortexWebhooks requires a secret');
    }
    this.secret = options.secret;
  }

  /**
   * Verify the HMAC-SHA256 signature of an incoming webhook payload.
   *
   * @param payload - The raw request body (string or Buffer)
   * @param signature - The value of the `X-Vortex-Signature` header
   * @returns `true` if the signature is valid
   */
  verifySignature(payload: string | Buffer, signature: string): boolean {
    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expected, 'utf8'),
      );
    } catch {
      // Lengths differ — not equal
      return false;
    }
  }

  /**
   * Verify and parse an incoming webhook payload.
   *
   * This is the primary method customers should use. It verifies the
   * signature and returns a typed event object.
   *
   * @param payload - The raw request body (string or Buffer). Must be the
   *   raw body, not a parsed JSON object — signature verification requires
   *   the exact bytes that were signed.
   * @param signature - The value of the `X-Vortex-Signature` header
   * @returns A typed `VortexWebhookEvent` or `VortexAnalyticsEvent`
   * @throws {VortexWebhookSignatureError} If the signature is invalid
   *
   * @example
   * ```typescript
   * const event = webhooks.constructEvent(req.body, req.headers['x-vortex-signature']);
   *
   * if (isWebhookEvent(event)) {
   *   console.log('Webhook event:', event.type, event.data);
   * } else {
   *   console.log('Analytics event:', event.name, event.payload);
   * }
   * ```
   */
  constructEvent(payload: string | Buffer, signature: string): VortexEvent {
    if (!this.verifySignature(payload, signature)) {
      throw new VortexWebhookSignatureError(
        'Webhook signature verification failed. Ensure you are using the raw request body and the correct signing secret.',
      );
    }

    const body = typeof payload === 'string' ? payload : payload.toString('utf8');
    const parsed = JSON.parse(body);
    return parsed as VortexEvent;
  }

  /**
   * Process an event through the handler configuration.
   *
   * Framework-specific handler factories call this internally.
   * You can also call it directly if building a custom integration.
   *
   * @param event - A parsed and verified event
   * @param handlers - The handler configuration
   */
  async handleEvent(event: VortexEvent, handlers: WebhookHandlers): Promise<void> {
    try {
      if (isWebhookEvent(event)) {
        // Run type-specific handler first
        const typeHandler = handlers.on?.[event.type];
        if (typeHandler) {
          await typeHandler(event);
        }
        // Then run the general webhook handler
        if (handlers.onEvent) {
          await handlers.onEvent(event);
        }
      } else if (isAnalyticsEvent(event) && handlers.onAnalyticsEvent) {
        await handlers.onAnalyticsEvent(event);
      }
    } catch (err) {
      if (handlers.onError) {
        handlers.onError(err as Error);
      }
      throw err;
    }
  }
}
