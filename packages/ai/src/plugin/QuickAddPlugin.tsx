/**
 * "✨ Quick add" — calendar header plugin.
 *
 * Mirrors the shape used by the standalone filter plugin: a plain object
 * `{ key, type, location, component, props }` accepted by core's `plugins`
 * prop. The calendar header injects `events`, `config`, `resources`, etc.
 * into header plugin components; there is no injected create-event callback,
 * so the factory takes `{ adapter, onEventCreate }` at construction time and
 * forwards them via `props` (which core spreads onto the component).
 *
 * Works offline out of the box: with no adapter the deterministic local
 * parser handles the input (confidence "low").
 */
import React, { FC, useCallback, useRef, useState } from 'react';
import { AIAdapter, AgendfyEvent, ParsedEventResult } from '../types';
import { useAIEventParser } from '../hooks';
import './quickAdd.css';

export interface QuickAddPluginOptions {
  /** Optional LLM adapter; omit to use the deterministic local parser. */
  adapter?: AIAdapter;
  /** Called with a full event (id included) when the user confirms. */
  onEventCreate?: (event: AgendfyEvent) => void;
  timeZone?: string;
  locale?: string;
  placeholder?: string;
}

export interface QuickAddComponentProps extends QuickAddPluginOptions {
  /** Injected by the calendar header (locale strings). */
  config?: Record<string, any>;
  /** Injected by the calendar header. */
  events?: AgendfyEvent[];
}

let idCounter = 0;
function generateEventId(): string {
  idCounter += 1;
  return `ai-${Date.now().toString(36)}-${idCounter}`;
}

function formatRange(result: ParsedEventResult, locale?: string, timeZone?: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(locale ?? 'en', {
      timeZone: timeZone ?? 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const timeFmt = new Intl.DateTimeFormat(locale ?? 'en', {
      timeZone: timeZone ?? 'UTC',
      timeStyle: 'short',
    });
    return `${fmt.format(new Date(result.event.start))} – ${timeFmt.format(
      new Date(result.event.end)
    )}`;
  } catch {
    return `${result.event.start} – ${result.event.end}`;
  }
}

export const QuickAddComponent: FC<QuickAddComponentProps> = ({
  adapter,
  onEventCreate,
  timeZone,
  locale,
  placeholder,
  config,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { parse, loading, error, result, reset } = useAIEventParser(adapter, {
    timeZone,
    locale,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim() && !loading) {
        void parse(value.trim());
      } else if (e.key === 'Escape') {
        reset();
      }
    },
    [value, loading, parse, reset]
  );

  const handleConfirm = useCallback(() => {
    if (!result) return;
    onEventCreate?.({ id: generateEventId(), ...result.event });
    reset();
    setValue('');
    inputRef.current?.focus();
  }, [result, onEventCreate, reset]);

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  const strings = config ?? {};

  return (
    <div className="react-agendfy-ai-quickadd">
      <input
        ref={inputRef}
        type="text"
        className="react-agendfy-ai-quickadd-input"
        placeholder={placeholder ?? strings.ai_quick_add ?? '✨ Quick add'}
        aria-label={strings.ai_quick_add ?? 'Quick add event'}
        value={value}
        disabled={loading}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {error && (
        <div className="react-agendfy-ai-quickadd-preview" role="alert">
          <span className="react-agendfy-ai-quickadd-error">
            {strings.ai_quick_add_error ?? 'Could not parse that — try again.'}
          </span>
        </div>
      )}
      {result && !error && (
        <div className="react-agendfy-ai-quickadd-preview" role="dialog" aria-label="Parsed event preview">
          <div className="react-agendfy-ai-quickadd-preview-title">{result.event.title}</div>
          <div className="react-agendfy-ai-quickadd-preview-time">
            {formatRange(result, locale, timeZone)}
          </div>
          <div className="react-agendfy-ai-quickadd-preview-confidence">
            {(strings.ai_confidence ?? 'confidence') + ': ' + result.confidence}
          </div>
          {result.missing && result.missing.length > 0 && (
            <div className="react-agendfy-ai-quickadd-preview-missing">
              {(strings.ai_missing ?? 'missing') + ': ' + result.missing.join(', ')}
            </div>
          )}
          <div className="react-agendfy-ai-quickadd-actions">
            <button
              type="button"
              className="react-agendfy-ai-quickadd-confirm react-agendfy-button"
              onClick={handleConfirm}
            >
              {strings.ai_add_event ?? 'Add'}
            </button>
            <button
              type="button"
              className="react-agendfy-ai-quickadd-cancel react-agendfy-button"
              onClick={handleCancel}
            >
              {strings.ai_cancel ?? 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Plugin factory. The returned object is structurally a core
 * `HeaderControlPlugin` (`type: 'search'`, `location: 'right'`).
 */
export function createQuickAddPlugin(options: QuickAddPluginOptions = {}) {
  return {
    key: 'ai-quick-add',
    type: 'search' as const,
    location: 'right' as const,
    description: 'AI-powered natural-language quick add',
    component: QuickAddComponent,
    props: { ...options },
  };
}

export default createQuickAddPlugin;
