import { useCallback, useMemo } from "react";
import { TZDate } from "@date-fns/tz";
import {
  clampToValidRange,
  CustomNavigation,
  DayRules,
  getDayRules,
  getNavigationTarget,
} from "../Utils/calendarRange";

interface UseCalendarNavigationProps {
  currentDate: Date;
  defaultView: string;
  timeZone: string;
  setCurrentDate: (date: Date) => void;
  /** Hidden days / valid range; defaults to no restrictions. */
  dayRules?: DayRules;
  /** Step/range of a custom view plugin (replaces the built-in rules). */
  custom?: CustomNavigation;
}

const useCalendarNavigation = ({
  currentDate,
  defaultView,
  timeZone,
  setCurrentDate,
  dayRules,
  custom,
}: UseCalendarNavigationProps) => {
  const rules = useMemo(() => dayRules ?? getDayRules({ timeZone }), [dayRules, timeZone]);

  const prevTarget = useMemo(
    () => getNavigationTarget(defaultView, currentDate, -1, rules, custom),
    [defaultView, currentDate, rules, custom]
  );
  const nextTarget = useMemo(
    () => getNavigationTarget(defaultView, currentDate, 1, rules, custom),
    [defaultView, currentDate, rules, custom]
  );

  const navigateToday = useCallback(() => {
    const today = clampToValidRange(new TZDate(new Date(), timeZone), rules.validRange);
    setCurrentDate(new TZDate(today, timeZone));
  }, [setCurrentDate, timeZone, rules]);

  const navigateBack = useCallback(() => {
    if (prevTarget) setCurrentDate(new TZDate(prevTarget, timeZone));
  }, [prevTarget, setCurrentDate, timeZone]);

  const navigateForward = useCallback(() => {
    if (nextTarget) setCurrentDate(new TZDate(nextTarget, timeZone));
  }, [nextTarget, setCurrentDate, timeZone]);

  return {
    navigateToday,
    navigateBack,
    navigateForward,
    canNavigateBack: prevTarget !== null,
    canNavigateForward: nextTarget !== null,
  };
};

export default useCalendarNavigation;
