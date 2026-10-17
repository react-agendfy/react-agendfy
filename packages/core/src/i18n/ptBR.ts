import type { CalendarMessages } from "./index";

/** Brazilian Portuguese (pt-BR). */
const ptBR: CalendarMessages = {
  today: "Hoje",
  monthView: "Mês",
  weekView: "Semana",
  dayView: "Dia",
  listView: "Lista",
  agenda: "Agenda",
  all_day: "Dia inteiro",
  clear_filter: "Limpar filtros",
  filter_resources: "Filtrar recursos",
  calendar_export: "Exportar",
  loading: "Carregando eventos",
  export_error: "Falha ao exportar",
  back: "Anterior",
  next: "Próximo",
  go_to_today: "Ir para hoje",
  unsupported_view: "Visualização não suportada",
  no_events: "Não há eventos para este período.",
  agenda_no_events: "Não há eventos para os próximos {days} dias.",
  untitled_event: "Evento",
  tooltip_start: "Início",
  tooltip_end: "Fim",
  invalid_slot_duration:
    "Duração de intervalo inválida ({duration}). Certifique-se de que a hora final é posterior à hora inicial e de que ambas são válidas.",
  hidden_events: "+{count} eventos ocultos",
  more_events: "+{count} mais",
  week_number_label: "S",
  close: "Fechar",
  notification_title: "Próximo evento",
  alert_title: "Alerta de Evento",
  event_starts_at: "{title} começa às {time}",
  email_alert_subject: "Alerta: {title}",
  email_alert_body:
    'O evento "{title}" começará às {time}. Por favor, verifique sua agenda.',
  data_source_error: "Erro ao buscar eventos de {source}: {message}",
};

export default ptBR;
