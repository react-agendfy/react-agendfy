import { format } from "date-fns";
import { EmailAdapter, NotificationServiceConfig } from "../types/notification";
import { Config, EventProps, LocaleStrings } from "../types/types";
import { formatMessage } from "../i18n";

export interface ToastProps {
  title: string;
  message: string;
  duration: number;
}

export class NotificationService {
  private emailAdapter?: EmailAdapter;
  private emailConfig?: { defaultRecipient: string };

  constructor(config: NotificationServiceConfig) {
    this.emailAdapter = config.emailAdapter;
    this.emailConfig = config.emailConfig;
  }

  public async notifyEvent(
    event: EventProps,
    addToast: (toast: ToastProps) => void,
    strings?: LocaleStrings | Partial<Config>
  ): Promise<void> {
    const eventStart = new Date(event.start);
    const formattedTime = format(eventStart, "HH:mm");
    // Fallbacks preserve the historical (pt) literals for callers that do not
    // route through the locale layer.
    const vars = { title: event.title, time: formattedTime };
    const startsAt = formatMessage(
      strings?.event_starts_at,
      vars,
      "{title} começa às {time}"
    );

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(strings?.notification_title || "Próximo evento", {
        body: startsAt,
      });
    } else {
      addToast({
        title: strings?.alert_title || "Alerta de Evento",
        message: startsAt,
        duration: 5000,
      });
    }

    if (this.emailAdapter) {
      const subject = formatMessage(
        strings?.email_alert_subject,
        vars,
        "Alerta: {title}"
      );
      const body = formatMessage(
        strings?.email_alert_body,
        vars,
        'O evento "{title}" começará às {time}. Por favor, verifique sua agenda.'
      );
      const recipient = this.emailConfig?.defaultRecipient;
      try {
        await this.emailAdapter.sendEmail(subject, body, recipient);
      } catch (err) {
        console.error("Erro ao enviar e-mail:", err);
      }
    }
  }
}
