import { Config, EventProps, LocaleStrings } from '../types/types';
import { formatEventTime } from './displayOptions';

/**
 * Generates the tooltip content for a calendar event.
 *
 * @param {Object} event - The event object.
 * @param {boolean} isMultiDay - Indicates if the event spans multiple days.
 * @param {boolean} isStart - Indicates if the event is the start of a multi-day event.
 * @param {boolean} isEnd - Indicates if the event is the end of a multi-day event.
 * @param {Object} [strings] - Locale strings used for the tooltip labels.
 * @returns {string} - tooltip content
 */

function generateTooltipContent(
  event: EventProps,
  isMultiDay: boolean,
  isStart: boolean,
  isEnd: boolean,
  strings?: LocaleStrings | Partial<Config>
): string {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);


  // Calendar time zone + eventTimeFormat (it used the host zone before).
  const config = strings as Partial<Config> | undefined;
  const time = (date: Date) => formatEventTime(date, config);
  const timeDisplay = isMultiDay
    ? isStart
      ? `${strings?.tooltip_start || 'Start'}: ${time(eventStart)}`
      : isEnd
        ? `${strings?.tooltip_end || 'End'}: ${time(eventEnd)}`
        : strings?.all_day || 'All day'
    : `${time(eventStart)} - ${time(eventEnd)}`;

  const displayTitle = event.title;

  const resourcesInfo = event.resources && event.resources.length > 0
    ? `\n\n: ${event.resources.map((r: { name?: string }) => r.name).join(', ')}`
    : '';

  const tooltipContent = `${displayTitle}\n\n${timeDisplay}${event?.isRecurrenceInstance ? '\n\n()' : ''}${resourcesInfo}`;

  return tooltipContent;
}

export default generateTooltipContent;
