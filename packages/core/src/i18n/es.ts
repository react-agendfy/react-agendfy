import type { CalendarMessages } from "./index";

/** Spanish (es). */
const es: CalendarMessages = {
  today: "Hoy",
  monthView: "Mes",
  weekView: "Semana",
  dayView: "Día",
  listView: "Lista",
  agenda: "Agenda",
  all_day: "Todo el día",
  clear_filter: "Limpiar filtros",
  filter_resources: "Filtrar recursos",
  calendar_export: "Exportar",
  loading: "Cargando eventos",
  export_error: "Error al exportar",
  back: "Anterior",
  next: "Siguiente",
  go_to_today: "Ir a hoy",
  unsupported_view: "Vista no compatible",
  no_events: "No hay eventos para este período.",
  agenda_no_events: "No hay eventos para los próximos {days} días.",
  untitled_event: "Evento",
  tooltip_start: "Inicio",
  tooltip_end: "Fin",
  invalid_slot_duration:
    "Duración de intervalo no válida ({duration}). Asegúrese de que la hora final sea posterior a la inicial y de que ambas sean válidas.",
  hidden_events: "+{count} eventos ocultos",
  more_events: "+{count} más",
  week_number_label: "S",
  close: "Cerrar",
  notification_title: "Próximo evento",
  alert_title: "Alerta de evento",
  event_starts_at: "{title} comienza a las {time}",
  email_alert_subject: "Alerta: {title}",
  email_alert_body:
    'El evento "{title}" comenzará a las {time}. Por favor, revise su agenda.',
  data_source_error: "Error al obtener eventos de {source}: {message}",
};

export default es;
