import { FC } from 'react';
import { Config, EventProps } from './types';

export interface EventLike extends EventProps {
  [k: string]: any;
}

export interface ConfigLike extends Config {
  [k: string]: any;
}

export type PluginLocation =
  | 'header' | 'left' | 'right' | 'view' | 'event' | 'slot'
  | 'data-source' | 'theme' | 'export' | 'filter' | 'interaction';

export type PluginType =
  | 'filter' | 'search' | 'data-source' | 'view' | 'event-rendering'
  | 'interaction' | 'theme' | 'export' | 'custom-filter' | 'ui';

export interface BaseCalendarPlugin {
  key: string;
  location?: PluginLocation;
  type: PluginType;
  component?: FC<any>;
  props?: Record<string, any>;
  /** Optional human-readable description shown in tooling. */
  description?: string;
  /** Optional lifecycle hook invoked when the plugin is activated. */
  activate?: () => void | Promise<void>;
  /** Optional lifecycle hook invoked when the plugin is deactivated. */
  deactivate?: () => void | Promise<void>;
}

export interface ViewPlugin extends BaseCalendarPlugin {
  type: 'view';
  viewName: string;
  component: FC<any>;
  props?: { label?: string; [key: string]: any };
}

export interface HeaderControlPlugin extends BaseCalendarPlugin {
  type: 'filter' | 'search';
  location: 'header' | 'left' | 'right';
  component: FC<any>;
  onFilterChange?: (filteredEvents: EventProps[]) => void;
  onSearch?: (searchTerm: string, results: EventProps[]) => void;
  events?: EventProps[];
  config?: Config;
}

export interface DataSourcePlugin extends BaseCalendarPlugin {
  type: 'data-source';
  fetchEvents: (startDate: Date, endDate: Date, config?: ConfigLike) => Promise<EventLike[]>;
}

export interface EventRenderingPlugin extends BaseCalendarPlugin {
  type: 'event-rendering';
  component: FC<any>;
}

export interface InteractionPlugin extends BaseCalendarPlugin {
  type: 'interaction';
  viewName: string;
  component: FC<any>;
}

export interface ThemePlugin extends BaseCalendarPlugin {
  type: 'theme';
  themeName: string;
  cssVariables?: Record<string, string>;
  component?: FC<{ children: React.ReactNode }>;
}

export interface ExportPlugin extends BaseCalendarPlugin {
  type: 'export';
  formatName: string;
  label: string;
  exportFunction: (events: EventLike[], config?: ConfigLike) => Promise<Blob | string>;
  mimeType: string;
  fileExtension: string;
}

export interface CustomFilterPlugin extends BaseCalendarPlugin {
  type: 'custom-filter';
  filterName: string;
  applyFilter: (events: EventProps[], config: Config, filterValue: any) => EventProps[];
  component?: FC<any>;
}

export interface UIPlugin extends BaseCalendarPlugin {
  type: 'ui' | 'search' | 'filter';
  component: FC<any>;
}

export type CalendarPlugin =
  | ViewPlugin | HeaderControlPlugin | DataSourcePlugin | EventRenderingPlugin
  | InteractionPlugin | ThemePlugin | ExportPlugin | CustomFilterPlugin | UIPlugin;