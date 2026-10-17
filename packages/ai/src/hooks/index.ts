/**
 * React hooks. All hooks share the same shape ({run, loading, error, result,
 * reset}), abort any in-flight request when a new one starts, and abort on
 * unmount via AbortSignal. Errors are surfaced through the `error` state
 * (never thrown into React).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AgendfyEvent,
  AIAdapter,
  CalendarInsights,
  ParsedEventResult,
  SchedulingSuggestion,
} from '../types';
import { parseNaturalEvent, ParseEventOptions } from '../nl/parseEvent';
import {
  detectConflicts,
  findFreeSlots,
  suggestSchedulingTimes,
  SuggestSchedulingOptions,
} from '../scheduling';
import { summarizeCalendar, SummarizeOptions } from '../insights';
import { parseEditRequest, ParseEditOptions } from '../editing';
import { generateAgenda, GenerateAgendaOptions } from '../agenda';
import { suggestConflictResolutions, SuggestResolutionOptions } from '../resolution';
import { parseMultipleEvents, BatchParseOptions } from '../batch';
import { suggestReminders, SuggestRemindersOptions } from '../reminders';
import { parseAvailabilityRequest, ParseAvailabilityOptions } from '../availability';
import type {
  AgendaResult,
  ConflictResolution,
  BatchParseResult,
  SmartReminder,
  AvailabilityResult,
  EventEditResult,
} from '../types';

interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  result: T | null;
}

/**
 * "Latest value" ref updated in an effect (never during render, per
 * rules-of-hooks). The value is only read inside user-triggered async
 * callbacks, so effect-time freshness is sufficient.
 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function useAIOperation<TArgs extends unknown[], TResult>(
  fn: (signal: AbortSignal, ...args: TArgs) => Promise<TResult>
): AsyncState<TResult> & {
  run: (...args: TArgs) => Promise<TResult | null>;
  reset: () => void;
} {
  const [state, setState] = useState<AsyncState<TResult>>({
    loading: false,
    error: null,
    result: null,
  });
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const fnRef = useLatest(fn);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fnRef.current(controller.signal, ...args);
      if (mountedRef.current && !controller.signal.aborted) {
        setState({ loading: false, error: null, result });
      }
      return result;
    } catch (err) {
      if (mountedRef.current && !controller.signal.aborted) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState({ loading: false, error: null, result: null });
  }, []);

  return { ...state, run, reset };
}

/* -------------------------------------------------------------------------- */
/* useAIEventParser                                                           */
/* -------------------------------------------------------------------------- */

export type UseAIEventParserOptions = Omit<ParseEventOptions, 'adapter' | 'signal'>;

export function useAIEventParser(
  adapter?: AIAdapter,
  options: UseAIEventParserOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (signal: AbortSignal, input: string): Promise<ParsedEventResult> =>
      parseNaturalEvent(input, {
        ...optionsRef.current,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { parse: run, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useSmartScheduling                                                         */
/* -------------------------------------------------------------------------- */

export type UseSmartSchedulingOptions = Omit<SuggestSchedulingOptions, 'adapter' | 'signal'>;

export function useSmartScheduling(
  adapter?: AIAdapter,
  options: UseSmartSchedulingOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (
      signal: AbortSignal,
      nlRequest: string,
      events: AgendfyEvent[]
    ): Promise<SchedulingSuggestion> =>
      suggestSchedulingTimes(nlRequest, events, {
        ...optionsRef.current,
        adapter: adapterRef.current,
        signal,
      })
  );

  // Deterministic helpers re-exported for convenience (stable identities).
  return { suggest: run, detectConflicts, findFreeSlots, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useCalendarInsights                                                        */
/* -------------------------------------------------------------------------- */

export type UseCalendarInsightsOptions = Omit<SummarizeOptions, 'adapter' | 'signal'>;

export function useCalendarInsights(
  adapter?: AIAdapter,
  options: UseCalendarInsightsOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (signal: AbortSignal, events: AgendfyEvent[]): Promise<CalendarInsights> =>
      summarizeCalendar(events, {
        ...optionsRef.current,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { summarize: run, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useEventEditing                                                             */
/* -------------------------------------------------------------------------- */

export type UseEventEditingOptions = Omit<ParseEditOptions, 'adapter' | 'signal' | 'events'>;

export function useEventEditing(
  adapter?: AIAdapter,
  options: UseEventEditingOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (
      signal: AbortSignal,
      input: string,
      events: AgendfyEvent[]
    ): Promise<EventEditResult | null> =>
      parseEditRequest(input, {
        ...optionsRef.current,
        events,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { edit: run, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useAgenda                                                                   */
/* -------------------------------------------------------------------------- */

export type UseAgendaOptions = Omit<GenerateAgendaOptions, 'adapter' | 'signal'>;

export function useAgenda(
  adapter?: AIAdapter,
  options: UseAgendaOptions = { period: 'day' }
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (
      signal: AbortSignal,
      events: AgendfyEvent[]
    ): Promise<AgendaResult> =>
      generateAgenda(events, {
        ...optionsRef.current,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { generate: run, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useConflictResolution                                                       */
/* -------------------------------------------------------------------------- */

export type UseConflictResolutionOptions = Omit<
  SuggestResolutionOptions,
  'adapter' | 'signal' | 'events' | 'conflicts'
>;

export function useConflictResolution(
  adapter?: AIAdapter,
  options: UseConflictResolutionOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (
      signal: AbortSignal,
      events: AgendfyEvent[],
      conflicts: import('../types').ConflictReport[]
    ): Promise<ConflictResolution[]> =>
      suggestConflictResolutions({
        ...optionsRef.current,
        events,
        conflicts,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { resolve: run, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useBatchParser                                                               */
/* -------------------------------------------------------------------------- */

export type UseBatchParserOptions = Omit<BatchParseOptions, 'adapter' | 'signal'>;

export function useBatchParser(
  adapter?: AIAdapter,
  options: UseBatchParserOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (signal: AbortSignal, input: string): Promise<BatchParseResult> =>
      parseMultipleEvents(input, {
        ...optionsRef.current,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { parse: run, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useSmartReminders                                                           */
/* -------------------------------------------------------------------------- */

export type UseSmartRemindersOptions = Omit<SuggestRemindersOptions, 'adapter' | 'signal' | 'events'>;

export function useSmartReminders(
  adapter?: AIAdapter,
  options: UseSmartRemindersOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (
      signal: AbortSignal,
      events: AgendfyEvent[]
    ): Promise<SmartReminder[]> =>
      suggestReminders({
        ...optionsRef.current,
        events,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { suggest: run, loading, error, result, reset };
}

/* -------------------------------------------------------------------------- */
/* useAvailability                                                             */
/* -------------------------------------------------------------------------- */

export type UseAvailabilityOptions = Omit<ParseAvailabilityOptions, 'adapter' | 'signal' | 'events'>;

export function useAvailability(
  adapter?: AIAdapter,
  options: UseAvailabilityOptions = {}
) {
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  const { run, loading, error, result, reset } = useAIOperation(
    (
      signal: AbortSignal,
      input: string,
      events: AgendfyEvent[]
    ): Promise<AvailabilityResult> =>
      parseAvailabilityRequest(input, {
        ...optionsRef.current,
        events,
        adapter: adapterRef.current,
        signal,
      })
  );

  return { check: run, loading, error, result, reset };
}
