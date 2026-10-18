import React, { createContext, ReactNode, useContext, useMemo } from "react";
import type {
  ClassNamesInput,
  DayCellClassNamesArg,
  DayCellClassNamesGenerator,
  EventClassNamesGenerator,
  EventContentView,
  EventProps,
} from "../types/types";

/*
 * Styling hooks (FullCalendar's `eventClassNames` / `dayCellClassNames`):
 * extra class names computed per event / per day cell, provided once by
 * <Calendar> and read by every view. Outside a provider (views rendered
 * standalone) they resolve to "".
 */

interface ClassNamesValue {
  eventClassNames?: EventClassNamesGenerator;
  dayCellClassNames?: DayCellClassNamesGenerator;
}

const ClassNamesContext = createContext<ClassNamesValue>({});

export const ClassNamesProvider = ({
  eventClassNames,
  dayCellClassNames,
  children,
}: ClassNamesValue & { children: ReactNode }) => {
  const value = useMemo(
    () => ({ eventClassNames, dayCellClassNames }),
    [eventClassNames, dayCellClassNames]
  );
  return <ClassNamesContext.Provider value={value}>{children}</ClassNamesContext.Provider>;
};

/** Normalizes a string / string[] / falsy result into one class string. */
export const toClassName = (input: ClassNamesInput | undefined | null | false): string => {
  if (!input) return "";
  const list = Array.isArray(input) ? input : [input];
  return list
    .filter((c): c is string => typeof c === "string" && c.trim() !== "")
    .map((c) => c.trim())
    .join(" ");
};

/** Joins class fragments, dropping empty ones. */
export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(" ");

const safeCall = <A,>(fn: ((arg: A) => ClassNamesInput) | undefined, arg: A): string => {
  if (!fn) return "";
  try {
    return toClassName(fn(arg));
  } catch (error) {
    console.error("[react-agendfy] class name callback threw:", error);
    return "";
  }
};

/**
 * Id written to `data-event-id`: the rendered event's id without the
 * internal rendering suffixes (`::cont` midnight segments, `::overlay` drag
 * copy), so CSS/tests can target an event by the id the app gave it.
 * Recurring occurrences keep their occurrence id (`<id>-<start ISO>`).
 */
export const publicEventId = (event: EventProps): string =>
  String(event.id).replace(/::(cont|overlay)$/, "");

/** Resolver for places that render many events in a loop. */
export const useEventClassNamesResolver = () => {
  const { eventClassNames } = useContext(ClassNamesContext);
  return useMemo(
    () => (event: EventProps, view: EventContentView) => safeCall(eventClassNames, { event, view }),
    [eventClassNames]
  );
};

/** Extra classes from the `eventClassNames` prop for one event element. */
export const useEventClassNames = (event: EventProps, view: EventContentView): string =>
  useEventClassNamesResolver()(event, view);

/** Extra classes from the `dayCellClassNames` prop for one day cell / column. */
export const useDayCellClassNames = (arg: DayCellClassNamesArg | null): string => {
  const { dayCellClassNames } = useContext(ClassNamesContext);
  return arg ? safeCall(dayCellClassNames, arg) : "";
};
