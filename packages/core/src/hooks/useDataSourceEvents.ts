import { useState, useCallback, useEffect } from "react";
import { EventProps, Config } from "../types/types";
import { DataSourcePlugin, ConfigLike } from "../types/plugins";
import { getNewDate } from "../Utils/calendarNavigation";
import { formatMessage } from "../i18n";

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
          setDataSourceError(
            formatMessage(
              localeConfig.data_source_error,
              { source: plugin.key, message: error.message },
              "Error fetching events from {source}: {message}"
            )
          );
        }
      }
      setDataSourceEvents(fetchedEvents);
      setIsDataSourceLoading(false);
    },
    [dataSourcePlugins, localeConfig]
  );

  const activeView = localeConfig.defaultView || "week";
  // Bumped by refetch() (CalendarApi.refetchEvents) to re-run the fetch.
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);
  useEffect(() => {
    const startDate = getNewDate(currentDate, activeView, -1);
    const endDate = getNewDate(currentDate, activeView, 1);
    fetchEventsFromDataSources(startDate, endDate);
  }, [currentDate, activeView, fetchEventsFromDataSources, reloadToken]);

  return { dataSourceEvents, isDataSourceLoading, dataSourceError, refetch };
};

export default useDataSourceEvents;
