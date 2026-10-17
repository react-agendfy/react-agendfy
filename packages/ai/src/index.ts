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
export {
  go4aiAdapter,
  DEFAULT_GO4AI_MODEL,
  type Go4AIAdapterOptions,
} from './adapters/go4ai';

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

// NL Event Editing
export {
  parseEditRequest,
  type ParseEditOptions,
} from './editing';

// Agenda Generation
export {
  generateAgenda,
  type GenerateAgendaOptions,
} from './agenda';

// Conflict Resolution
export {
  suggestConflictResolutions,
  type SuggestResolutionOptions,
} from './resolution';

// Batch Event Parsing
export {
  parseMultipleEvents,
  type BatchParseOptions,
} from './batch';

// Smart Reminders
export {
  suggestReminders,
  type SuggestRemindersOptions,
} from './reminders';

// Availability Check
export {
  parseAvailabilityRequest,
  type ParseAvailabilityOptions,
} from './availability';

// React hooks
export {
  useAIEventParser,
  useSmartScheduling,
  useCalendarInsights,
  useEventEditing,
  useAgenda,
  useConflictResolution,
  useBatchParser,
  useSmartReminders,
  useAvailability,
  type UseAIEventParserOptions,
  type UseSmartSchedulingOptions,
  type UseCalendarInsightsOptions,
  type UseEventEditingOptions,
  type UseAgendaOptions,
  type UseConflictResolutionOptions,
  type UseBatchParserOptions,
  type UseSmartRemindersOptions,
  type UseAvailabilityOptions,
} from './hooks';

// Header plugin
export {
  createQuickAddPlugin,
  QuickAddComponent,
  type QuickAddPluginOptions,
  type QuickAddComponentProps,
} from './plugin/QuickAddPlugin';
