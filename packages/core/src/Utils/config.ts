import { Config, LocaleConfig } from "../types/types";
import { getMessages } from "../i18n";

  /** Locale-only subset, resolved from the bundled message catalog. */
  export const getLocaleConfig = (lang: string): LocaleConfig => {
    const messages = getMessages(lang);
    return {
      today: messages.today,
      monthView: messages.monthView,
      weekView: messages.weekView,
      dayView: messages.dayView,
    };
  };

 export  const config: Config = {
    timeZone: "America/Sao_Paulo",
    defaultView: "month",
    slotDuration: 15,
    slotLabelFormat: "HH:mm",
    slotMin: "00:00",
    slotMax: "24:00",
    lang: 'pt',
    today: 'Today',
    monthView: 'Month',
    weekView: 'Week',
    dayView: 'Day',
    listView: 'List',
    agenda: 'Agenda',
    all_day: 'All Day',
    filter_resources: 'Filter Resources',
    calendar_export: 'Export',
    businessHours: {
      enabled: true,
      intervals: [
        { daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" }
      ]
    },
    alerts: {
      enabled: true,          
      thresholdMinutes: 15,  
    },
  };
