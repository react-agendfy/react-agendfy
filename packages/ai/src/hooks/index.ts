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
