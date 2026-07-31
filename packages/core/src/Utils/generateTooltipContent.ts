import { format } from 'date-fns';
import { Config, EventProps, LocaleStrings } from '../types/types';

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


  const timeDisplay = isMultiDay
    ? isStart
      ? `${strings?.tooltip_start || 'Start'}: ${format(eventStart, 'HH:mm')}`
      : isEnd
        ? `${strings?.tooltip_end || 'End'}: ${format(eventEnd, 'HH:mm')}`
        : strings?.all_day || 'All day'
    : `${format(eventStart, 'HH:mm')} - ${format(eventEnd, 'HH:mm')}`;

  const displayTitle = event.title;

  const resourcesInfo = event.resources && event.resources.length > 0
    ? `\n\n: ${event.resources.map((r: { name?: string }) => r.name).join(', ')}`
    : '';

  const tooltipContent = `${displayTitle}\n\n${timeDisplay}${event?.isRecurrenceInstance ? '\n\n()' : ''}${resourcesInfo}`;

  return tooltipContent;
}

export default generateTooltipContent;
