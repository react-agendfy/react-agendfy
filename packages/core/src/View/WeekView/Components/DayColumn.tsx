import React, { memo, useMemo } from 'react';
import {
  differenceInMinutes,
  format,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
  addMinutes,
} from "date-fns";
import { WeekTimeSlot } from "./WeekTimeSlot";
import { useBusinessHours } from "../../../Utils/businessHours";
import { DayColumnProps, EventProps } from "../../../types/types";
import { TZDate } from "@date-fns/tz";
import { getLocale } from "../../../Utils/locate";
import { computeDayLayout } from "../../../Utils/positionedEventsHelper";
import { nowLineOffset } from "../../../Utils/calculateRedLineOffset";
import { useMinuteTick } from "../../../hooks/useMinuteTick";
import { getSlotHeight } from "../../../Utils/slotHeight";
import { cx, useDayCellClassNames } from "../../../context/ClassNamesContext";

export const DayColumn = memo(
  ({
    dayDate,
    timeSlots,
    parsedSlotMin, 
    onEventClick,
    onSlotClick,
    getEventsForDay,
    parsedSlotMax, 
    onEventResize,
    redLineOffset,
    config,
    isDraggable,
    isDisabled = false,
    onSelectionMouseDown,
    onSelectionMouseMove,
    isSlotSelected,
  }: DayColumnProps) => {
    const isToday = isSameDay(dayDate, new TZDate(new Date(), config?.timeZone));
    // Current-time line: only in today's column, at the real current time.
    const showNow = isToday && config?.nowIndicator !== false;
    useMinuteTick(showNow);
    const slotHeight = getSlotHeight(config);
    const nowOffset = showNow
      ? nowLineOffset(
          dayDate,
          parsedSlotMin,
          parsedSlotMax,
          config?.slotDuration || 30,
          config?.timeZone,
          new Date(),
          slotHeight
        )
      : null;
    const extraClassNames = useDayCellClassNames({
      date: dayDate,
      view: config?.defaultView ?? "week",
      isToday,
      isDisabled,
    });
    const dayStart = startOfDay(dayDate);
    
    const eventsMapping = useMemo(() => {
      const mapping: Record<string, EventProps[]> = {};
      timeSlots.forEach((index) => {
        const minutes = index * (config?.slotDuration || 30);
        const hour = parsedSlotMin + Math.floor(minutes / 60);
        const minute = minutes % 60;
        const slotDate = setMinutes(setHours(dayStart, hour), minute);
        const slotKey = slotDate.toISOString();
        const slotEvents = getEventsForDay(slotKey) || [];
        mapping[slotKey] = slotEvents;
      });
      return mapping;
    }, [dayStart, parsedSlotMin, timeSlots, getEventsForDay, config?.slotDuration]);

    // Overlap columns are decided for the whole day, not per slot.
    const dayLayout = useMemo(
      () => computeDayLayout(Object.values(eventsMapping).flat(), config?.timeZone),
      [eventsMapping, config?.timeZone]
    );

    const businessIntervals = useBusinessHours(dayDate, config?.businessHours);

    const startHour = parsedSlotMin;
    const endHour = parsedSlotMax;
    const slotDuration = config?.slotDuration || 30;
    const pixelsPerMinute = slotHeight / slotDuration;
    const totalMinutes = (endHour - startHour) * 60;

    const hourLines = useMemo(() => {
      const lines: { top: number }[] = [];
      for (let minutes = 60; minutes < totalMinutes; minutes += 60) {
        const top = minutes * pixelsPerMinute;
        lines.push({ top });
      }
      return lines;
    }, [totalMinutes, pixelsPerMinute]);

    const quarterLines = useMemo(() => {
      const lines: { top: number }[] = [];
      const startTime = setHours(dayStart, startHour);
      for (let minutes = 15; minutes < totalMinutes; minutes += 15) {
        const time = addMinutes(startTime, minutes);
        if (time.getMinutes() === 0) continue;
        const top = minutes * pixelsPerMinute;
        lines.push({ top });
      }
      return lines;
    }, [dayStart, startHour, totalMinutes, pixelsPerMinute]);

    return (
      <div
        className={cx(
          "react-agendfy-daycolumn-container react-agendfy-today",
          isToday && "react-agendfy-daycolumn-today",
          isDisabled && "react-agendfy-day-disabled",
          extraClassNames
        )}
        data-date={format(dayDate, "yyyy-MM-dd")}
        data-today={isToday || undefined}
        data-disabled={isDisabled || undefined}
        aria-disabled={isDisabled || undefined}
      >
        <div
          className={`react-agendfy-daycolumn-header  react-agendfy-header-today ${
            isToday ? "react-agendfy-daycolumn-header-today" : ""
          }`}
          onClick={() => {
            if (!isDisabled && typeof onSlotClick === "function") onSlotClick(dayDate);
          }}
          role="columnheader"
          tabIndex={!isDisabled && typeof onSlotClick === "function" ? 0 : undefined}
          aria-label={format(dayDate, "EEEE dd/MM", { locale: getLocale(config?.lang) })}
          aria-current={isToday ? "date" : undefined}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isDisabled && typeof onSlotClick === "function") {
              e.preventDefault();
              onSlotClick(dayDate);
            }
          }}
        >
          <div className="react-agendfy-daycolumn-header-text">
            <div className="react-agendfy-daycolumn-weekday">
              {format(dayDate, "EEE", { locale: getLocale(config?.lang) })}
            </div>
            <div className="react-agendfy-daycolumn-date">
              {format(dayDate, "dd/MM", { locale: getLocale(config?.lang) })}
            </div>
          </div>
        </div>
        <div
          className="react-agendfy-daycolumn-slot-container"
          style={{ minHeight: timeSlots.length * slotHeight }}
        >
          {businessIntervals.map((interval, idx) => {
            // Offsets are relative to the grid's first slot (slotMin), not
            // midnight, and clipped to the rendered [slotMin, slotMax] window.
            const gridStart = addMinutes(dayStart, startHour * 60);
            const fromMin = Math.max(0, differenceInMinutes(interval.start, gridStart));
            const toMin = Math.min(totalMinutes, differenceInMinutes(interval.end, gridStart));
            if (toMin <= fromMin) return null;
            const top = fromMin * pixelsPerMinute;
            const height = (toMin - fromMin) * pixelsPerMinute;
            return (
              <div
                key={idx}
                className="react-agendfy-business-hours"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                }}
              />
            );
          })}

          {hourLines.map((line, idx) => (
            <div
              key={`hour-line-${idx}`}
              className="react-agendfy-grid-line react-agendfy-grid-line--hour"
              style={{ top: `${line.top}px` }}
            />
          ))}

          {quarterLines.map((line, idx) => (
            <div
              key={`quarter-line-${idx}`}
              className="react-agendfy-grid-line react-agendfy-grid-line--minor"
              style={{ top: `${line.top}px` }}
            />
          ))}

          {timeSlots.map((index) => {
            const minutes = index * (config?.slotDuration || 30);
            const hour = parsedSlotMin + Math.floor(minutes / 60);
            const minute = minutes % 60;
            const slotTime = setMinutes(setHours(dayStart, hour), minute).toISOString();
            return (
              <WeekTimeSlot
                key={`${format(dayDate, "yyyy-MM-dd")}-${index}`}
                index={index}
                dayDate={dayDate}
                slotEvents={eventsMapping[slotTime]}
                onEventClick={onEventClick}
                onSlotClick={onSlotClick}
                slotMin={parsedSlotMin}
                config={config}
                parsedSlotMax={parsedSlotMax}
                onEventResize={onEventResize}
                isDraggable={isDraggable}
                isDisabled={isDisabled}
                dayLayout={dayLayout}
                onSelectionMouseDown={onSelectionMouseDown}
                onSelectionMouseMove={onSelectionMouseMove}
                isSelected={isSlotSelected(new TZDate(slotTime, config?.timeZone))}
              />
            );
          })}
          {nowOffset !== null && (
            <div
              className="react-agendfy-now-line"
              style={{
                top: `${nowOffset}px`,
                zIndex: 1,
              }}
            />
          )}
        </div>
      </div>
    );
  }
);