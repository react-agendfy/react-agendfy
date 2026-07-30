/**
 * English message catalog — the source of truth for every message key.
 * All other catalogs are typed against this object, so adding a key here
 * forces every locale to provide a translation.
 *
 * Templates use `{placeholder}` tokens resolved by `formatMessage`.
 */
const en = {
  today: "Today",
  monthView: "Month",
  weekView: "Week",
  dayView: "Day",
  listView: "List",
  agenda: "Agenda",
  all_day: "All Day",
  clear_filter: "Clear Filters",
  filter_resources: "Filter Resources",
  calendar_export: "Export",
  loading: "Loading events",
  export_error: "Failed to export",
  back: "Back",
  next: "Next",
  go_to_today: "Go to today",
  unsupported_view: "Unsupported view",
  no_events: "There are no events for this period.",
  agenda_no_events: "There are no events for the next {days} days.",
  untitled_event: "Event",
  tooltip_start: "Start",
  tooltip_end: "End",
  invalid_slot_duration:
    "Invalid slot duration ({duration}). Make sure the end time is later than the start time and that both are valid.",
  hidden_events: "+{count} hidden events",
  notification_title: "Upcoming event",
  alert_title: "Event Alert",
  event_starts_at: "{title} starts at {time}",
  email_alert_subject: "Alert: {title}",
  email_alert_body:
    'The event "{title}" will start at {time}. Please check your calendar.',
  data_source_error: "Error fetching events from {source}: {message}",
} as const satisfies Record<string, string>;

export default en;
