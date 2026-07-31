/**
 * @react-agendfy/ai — provider-agnostic AI layer for react-agendfy.
 *
 * Everything here depends on ONE seam: the {@link AIAdapter} interface
 * (bring-your-own-LLM). Vendor code exists only inside `adapters/`.
 */

// Types (the adapter seam + domain results)
export * from './types';

// Adapters
export {
  claudeAdapter,
  DEFAULT_CLAUDE_MODEL,
  type ClaudeAdapterOptions,
} from './adapters/claude';
export { httpAdapter, type HttpAdapterOptions } from './adapters/http';
export { customAdapter } from './adapters/custom';

// Natural language → event
export {
  parseNaturalEvent,
  parseNaturalEventLocal,
  buildParseSystemPrompt,
  PARSED_EVENT_SCHEMA,
  type ParseEventOptions,
} from './nl/parseEvent';
export { type LocalParseOptions } from './nl/localParser';

// Smart scheduling (deterministic core + one LLM-assisted wrapper)
export {
  detectConflicts,
  findFreeSlots,
  suggestSchedulingTimes,
  SCHEDULING_CONSTRAINTS_SCHEMA,
  type DetectConflictsOptions,
  type FindFreeSlotsOptions,
  type SuggestSchedulingOptions,
} from './scheduling';

// Insights (deterministic stats + LLM prose)
export {
  computeCalendarStats,
  summarizeCalendar,
  categorizeEvents,
  buildCategorizeSchema,
  type StatsOptions,
  type SummarizeOptions,
  type CategorizeOptions,
} from './insights';

// React hooks
export {
  useAIEventParser,
  useSmartScheduling,
  useCalendarInsights,
  type UseAIEventParserOptions,
  type UseSmartSchedulingOptions,
  type UseCalendarInsightsOptions,
} from './hooks';

// Header plugin
export {
  createQuickAddPlugin,
  QuickAddComponent,
  type QuickAddPluginOptions,
  type QuickAddComponentProps,
} from './plugin/QuickAddPlugin';
