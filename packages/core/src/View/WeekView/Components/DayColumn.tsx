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
    eventRenderingPlugins,
    onSelectionMouseDown,
    onSelectionMouseMove,
    isSlotSelected,
  }: DayColumnProps) => {
    const isToday = isSameDay(dayDate, new TZDate(new Date(), config?.timeZone));
    const dayStart = startOfDay(dayDate);
    
    const eventsMapping = useMemo(() => {
      const mapping: Record<string, EventProps[]> = {};
      timeSlots.forEach((index) => {
        const minutes = index * (config?.slotDuration || 30);
        const hour = parsedSlotMin + Math.floor(minutes / 60);
        const minute = minutes % 60;
        const slotDate = setMinutes(setHours(dayStart, hour), minute);
        const slotKey = slotDate.toISOString();
        let slotEvents = getEventsForDay(slotKey) || [];
        mapping[slotKey] = slotEvents;
      });
      return mapping;
    }, [dayStart, parsedSlotMin, timeSlots, getEventsForDay, config?.slotDuration]);

    const businessIntervals = useBusinessHours(dayDate, config?.businessHours);

    const startHour = parsedSlotMin;
    const endHour = parsedSlotMax;
    const slotDuration = config?.slotDuration || 30;
    const slotHeight = 40;
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
        className={`react-agendfy-daycolumn-container react-agendfy-today ${
          isToday ? "react-agendfy-daycolumn-today" : ""
        }`}
      >
        <div
          className={`react-agendfy-daycolumn-header  react-agendfy-header-today ${
            isToday ? "react-agendfy-daycolumn-header-today" : ""
          }`}
          onClick={() => {
            if (typeof onSlotClick === "function") onSlotClick(dayDate);
          }}
          role="columnheader"
          tabIndex={typeof onSlotClick === "function" ? 0 : undefined}
          aria-label={format(dayDate, "EEEE dd/MM", { locale: getLocale(config?.lang) })}
          aria-current={isToday ? "date" : undefined}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && typeof onSlotClick === "function") {
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
          style={{ minHeight: timeSlots.length * 40 }}
        >
          {businessIntervals.map((interval, idx) => {
            const top =
              (differenceInMinutes(interval.start, dayStart) / config?.slotDuration!) *
              40;
            const height =
              (differenceInMinutes(interval.end, interval.start) / config?.slotDuration!) *
              40;
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
              style={{
                position: "absolute",
                top: `${line.top}px`,
                left: 0,
                right: 0,
                borderTop: "1px solid var(--color-border)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          ))}

          {quarterLines.map((line, idx) => (
            <div
              key={`quarter-line-${idx}`}
              style={{
                position: "absolute",
                top: `${line.top}px`,
                left: 0,
                right: 0,
                borderTop: "1px dashed var(--color-border-gray-300)",
                pointerEvents: "none",
                zIndex: 1,
              }}
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
                eventRenderingPlugins={eventRenderingPlugins}
                onSelectionMouseDown={onSelectionMouseDown}
                onSelectionMouseMove={onSelectionMouseMove}
                isSelected={isSlotSelected(new TZDate(slotTime, config?.timeZone))}
              />
            );
          })}
          <div
            className="react-agendfy-now-line"
            style={{
              top: `${redLineOffset}px`,
              zIndex: 1,
            }}
          />
        </div>
      </div>
    );
  }
);