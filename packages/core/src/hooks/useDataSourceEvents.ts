import { useState, useCallback, useEffect } from "react";
import { EventProps, Config } from "../types/types";
import { DataSourcePlugin, ConfigLike } from "../types/plugins";
import { getNewDate } from "../Utils/calendarNavigation";

const useDataSourceEvents = (
  dataSourcePlugins: DataSourcePlugin[],
  localeConfig: Partial<Config>,
  currentDate: Date
) => {
  const [dataSourceEvents, setDataSourceEvents] = useState<EventProps[]>([]);
  const [isDataSourceLoading, setIsDataSourceLoading] = useState(false);
  const [dataSourceError, setDataSourceError] = useState<string | null>(null);

  const fetchEventsFromDataSources = useCallback(
    async (startDate: Date, endDate: Date) => {
      setIsDataSourceLoading(true);
      setDataSourceError(null);
      const fetchedEvents: EventProps[] = [];
      for (const plugin of dataSourcePlugins) {
        try {
          const eventsFromSource = await plugin.fetchEvents(startDate, endDate, localeConfig as ConfigLike);
          fetchedEvents.push(...eventsFromSource);
        } catch (error: any) {
          console.error(`Error fetching events from ${plugin.key}:`, error);
          setDataSourceError(`Error fetching events from ${plugin.key}: ${error.message}`);
        }
      }
      setDataSourceEvents(fetchedEvents);
      setIsDataSourceLoading(false);
    },
    [dataSourcePlugins, localeConfig]
  );

  const activeView = localeConfig.defaultView || "week";
  useEffect(() => {
    const startDate = getNewDate(currentDate, activeView, -1);
    const endDate = getNewDate(currentDate, activeView, 1);
    fetchEventsFromDataSources(startDate, endDate);
  }, [currentDate, activeView, fetchEventsFromDataSources]);

  return { dataSourceEvents, isDataSourceLoading, dataSourceError };
};

export default useDataSourceEvents;
