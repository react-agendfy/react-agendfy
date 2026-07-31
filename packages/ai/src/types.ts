/**
 * @react-agendfy/ai — type surface.
 *
 * The whole package is built around ONE seam: {@link AIAdapter}. Every
 * feature (NL parsing, scheduling, insights, hooks, the Quick Add plugin)
 * depends only on that interface — never on a concrete LLM vendor. Vendor
 * code lives exclusively under `src/adapters/`.
 */

/* -------------------------------------------------------------------------- */
/* Adapter seam                                                               */
/* -------------------------------------------------------------------------- */

/** Loose JSON-Schema shape. Kept minimal on purpose — adapters forward it. */
export interface JSONSchema {
  type?: string;
  [key: string]: unknown;
}

export interface AICompletionRequest {
  /** Optional system prompt. */
  system?: string;
  /** The user prompt. */
  prompt: string;
  /**
   * When present, the adapter MUST return validated JSON matching this
   * schema in `AICompletionResult.json`.
   */
  schema?: JSONSchema;
  /** Max output tokens hint. */
  maxTokens?: number;
  /** Abort in-flight requests (hooks abort on unmount). */
  signal?: AbortSignal;
}

export interface AICompletionResult {
  text?: string;
  json?: unknown;
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * The bring-your-own-LLM seam. Implementations: `claudeAdapter` (official
 * Anthropic SDK, dev/server), `httpAdapter` (your own backend proxy —
 * recommended for production), `customAdapter` (any function).
 */
export interface AIAdapter {
  complete(req: AICompletionRequest): Promise<AICompletionResult>;
}

export type AIAdapterErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'invalid_request'
  | 'network'
  | 'unknown';

/**
 * Vendor-neutral error thrown by adapters so UI code can react to failures
 * (`kind`) without importing any vendor SDK.
 */
export class AIAdapterError extends Error {
  readonly kind: AIAdapterErrorKind;
  readonly cause?: unknown;

  constructor(kind: AIAdapterErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'AIAdapterError';
    this.kind = kind;
    this.cause = cause;
  }
}

/* -------------------------------------------------------------------------- */
/* Calendar event shapes (structurally compatible with @react-agendfy/core)   */
/* -------------------------------------------------------------------------- */

/**
 * Structural mirror of core's `EventProps` (id, title, ISO start/end, …).
 * Defined locally so this package has zero runtime/compile dependency on
 * `@react-agendfy/core` while remaining assignable to it.
 */
export interface AgendfyEvent {
  id: string;
  title: string;
  start: Date | string;
  end: Date | string;
  allDay?: boolean;
  color?: string;
  resourceId?: string | number;
  resourceIds?: (string | number)[];
  [key: string]: any;
}

/** A parsed event draft — everything except the id (ISO string dates). */
export interface ParsedEventDraft {
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  color?: string;
  resourceId?: string | number;
  [key: string]: any;
}

/* -------------------------------------------------------------------------- */
/* Domain results                                                             */
/* -------------------------------------------------------------------------- */

export type ParseConfidence = 'high' | 'medium' | 'low';

export interface ParsedEventResult {
  event: ParsedEventDraft;
  confidence: ParseConfidence;
  /** Fields the parser could not derive from the input (e.g. 'time'). */
  missing?: string[];
  /** The original natural-language input. */
  raw: string;
}

export interface ConflictReport {
  type: 'overlap' | 'resource-double-booking';
  /** The two conflicting event ids. */
  eventIds: [string, string];
  /** Set when both events share a resource. */
  resourceId?: string;
  /** ISO start of the overlapping span. */
  overlapStart: string;
  /** ISO end of the overlapping span. */
  overlapEnd: string;
}

export interface FreeSlot {
  /** ISO start of the free span. */
  start: string;
  /** ISO end of the free span. */
  end: string;
  /** Whole minutes available in the span. */
  durationMinutes: number;
}

export interface BusinessHours {
  /** "HH:mm" — window start (interpreted in the provided timeZone, UTC by default). */
  start: string;
  /** "HH:mm" — window end. */
  end: string;
}

export interface SchedulingConstraints {
  durationMinutes: number;
  /** ISO datetime lower bound. */
  earliest: string;
  /** ISO datetime upper bound. */
  latest: string;
  /** Free-text preferences the LLM extracted (informational). */
  preferences?: string;
}

export interface SchedulingSuggestion {
  slots: FreeSlot[];
  constraints: SchedulingConstraints;
  /** 'llm' when the adapter interpreted the request, 'fallback' otherwise. */
  source: 'llm' | 'fallback';
}

export interface CalendarStats {
  eventCount: number;
  /** Sum of timed (non all-day) event durations, in hours (2 decimals). */
  totalMeetingHours: number;
  /** "yyyy-MM-dd" of the day with the most meeting hours. */
  busiestDay?: string;
  /** Meeting hours keyed by "yyyy-MM-dd". */
  perDayHours: Record<string, number>;
}

export interface CalendarInsights {
  summary: string;
  busiestDay?: string;
  totalMeetingHours?: number;
  eventCount?: number;
  /** Optional event-count per category (when categorization was requested). */
  categories?: Record<string, number>;
}
