import type { CalendarMessages } from "./index";

/**
 * Arabic (ar) — RTL proof locale.
 * TODO(i18n): machine-translation quality; needs review by a native speaker.
 */
const ar: CalendarMessages = {
  today: "اليوم",
  monthView: "شهر",
  weekView: "أسبوع",
  dayView: "يوم",
  listView: "قائمة",
  agenda: "جدول الأعمال",
  all_day: "طوال اليوم",
  clear_filter: "مسح عوامل التصفية",
  filter_resources: "تصفية الموارد",
  calendar_export: "تصدير",
  loading: "جارٍ تحميل الأحداث",
  export_error: "فشل التصدير",
  back: "السابق",
  next: "التالي",
  go_to_today: "الانتقال إلى اليوم",
  unsupported_view: "عرض غير مدعوم",
  no_events: "لا توجد أحداث في هذه الفترة.",
  agenda_no_events: "لا توجد أحداث خلال الأيام الـ {days} القادمة.",
  untitled_event: "حدث",
  tooltip_start: "البداية",
  tooltip_end: "النهاية",
  invalid_slot_duration:
    "مدة الفترة غير صالحة ({duration}). تأكد من أن وقت النهاية بعد وقت البداية وأن كليهما صالح.",
  hidden_events: "+{count} أحداث مخفية",
  more_events: "+{count} المزيد",
  week_number_label: "أ",
  close: "إغلاق",
  notification_title: "حدث قادم",
  alert_title: "تنبيه حدث",
  event_starts_at: "{title} يبدأ في {time}",
  email_alert_subject: "تنبيه: {title}",
  email_alert_body:
    'سيبدأ الحدث "{title}" في {time}. يرجى مراجعة جدولك.',
  data_source_error: "خطأ في جلب الأحداث من {source}: {message}",
};

export default ar;
