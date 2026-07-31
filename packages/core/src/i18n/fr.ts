import type { CalendarMessages } from "./index";

/** French (fr). */
const fr: CalendarMessages = {
  today: "Aujourd'hui",
  monthView: "Mois",
  weekView: "Semaine",
  dayView: "Jour",
  listView: "Liste",
  agenda: "Agenda",
  all_day: "Toute la journée",
  clear_filter: "Effacer les filtres",
  filter_resources: "Filtrer les ressources",
  calendar_export: "Exporter",
  loading: "Chargement des événements",
  export_error: "Échec de l'exportation",
  back: "Précédent",
  next: "Suivant",
  go_to_today: "Aller à aujourd'hui",
  unsupported_view: "Vue non prise en charge",
  no_events: "Aucun événement pour cette période.",
  agenda_no_events: "Aucun événement pour les {days} prochains jours.",
  untitled_event: "Événement",
  tooltip_start: "Début",
  tooltip_end: "Fin",
  invalid_slot_duration:
    "Durée de créneau non valide ({duration}). Vérifiez que l'heure de fin est postérieure à l'heure de début et que les deux sont valides.",
  hidden_events: "+{count} événements masqués",
  notification_title: "Événement à venir",
  alert_title: "Alerte d'événement",
  event_starts_at: "{title} commence à {time}",
  email_alert_subject: "Alerte : {title}",
  email_alert_body:
    "L'événement « {title} » commencera à {time}. Veuillez vérifier votre agenda.",
  data_source_error:
    "Erreur lors de la récupération des événements de {source} : {message}",
};

export default fr;
