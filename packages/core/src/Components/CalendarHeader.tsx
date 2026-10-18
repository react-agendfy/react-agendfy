import React, { useState, useEffect, useRef } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Download, Filter } from "lucide-react";
import { getLocale } from "../Utils/locate";
import { resolveWeekStartsOn } from "../Utils/calendarRange";
import { CalendarHeaderProps, Resource } from "../types/types";

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ 
  currentView,
  availableViews,
  onViewChange,
  currentDate,
  onNavigate,
  localeConfig, 
  onExport,
  exportOptions = [],
  headerLeftPlugins = [],
  headerRightPlugins = [],
  isPrevDisabled = false,
  isNextDisabled = false,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const formatTitle = () => {
    const locale = getLocale(localeConfig.lang);
    // The list view's title follows its span (listRange).
    const titleView = currentView === "list" ? (localeConfig.listRange ?? "month") : currentView;
    if (titleView === "week") {
      const weekStartsOn = resolveWeekStartsOn(localeConfig);
      const start = startOfWeek(currentDate, { weekStartsOn });
      const end = endOfWeek(currentDate, { weekStartsOn });
      return `${format(start, "d")} - ${format(end, "d MMM yyyy", { locale })}`;
    }
    if (titleView === "agenda") {
      const end = new Date(currentDate.getTime() + 6 * 86400000);
      return `${format(currentDate, "d")} - ${format(end, "d MMM yyyy", { locale })}`;
    }
    if (titleView === "day") {
      return format(currentDate, "d MMMM yyyy", { locale });
    }
    return format(currentDate, "MMMM yyyy", { locale });
  };

  return (
    <div className="react-agendfy-header-toolbar react-agendfy-toolbar">
      <div className="react-agendfy-toolbar-chunk">
        <div className="react-agendfy-button-group">
          <button
            type="button"
            className="react-agendfy-prev-button react-agendfy-button react-agendfy-button-primary"
            aria-label={`${localeConfig?.back || "Back"} ${currentView}`}
            onClick={() => onNavigate("prev")}
            disabled={isPrevDisabled}
          >
            <ChevronLeft className="react-agendfy-icon" />
          </button>
          <button
            type="button"
            className="react-agendfy-next-button react-agendfy-button react-agendfy-button-primary"
            aria-label={`${localeConfig?.next || "Next"} ${currentView}`}
            onClick={() => onNavigate("next")}
            disabled={isNextDisabled}
          >
            <ChevronRight className="react-agendfy-icon" />
          </button>
        </div>
        <div className="react-agendfy-button-group">
          <button
            type="button"
            className="react-agendfy-today-button react-agendfy-button react-agendfy-button-primary"
            aria-label={localeConfig?.go_to_today || "Go to today"}
            onClick={() => onNavigate("today")}
          >
            {localeConfig?.today || "Today"}
          </button>
        </div>
        <h2 className="react-agendfy-toolbar-title">{formatTitle()}</h2>
      </div>

      <div className="react-agendfy-toolbar-chunk">
        {headerLeftPlugins.map((plugin, i) => (
          <div key={i} className="react-agendfy-plugin-left">{plugin}</div>
        ))}
      </div>

      <div className="react-agendfy-toolbar-chunk">
        <div className="react-agendfy-button-group">
          {availableViews.map((view) => (
            <button
              key={view.name}
              type="button"
              className={`react-agendfy-${view.name}-button react-agendfy-button react-agendfy-button-primary ${currentView === view.name ? "react-agendfy-button-active" : ""}`}
              onClick={() => onViewChange(view.name)}
              aria-pressed={currentView === view.name}
            >
              {view.label}
            </button>
          ))}
        </div>

        {localeConfig?.export && exportOptions.length > 0 && onExport && (
          <div className="react-agendfy-export-container" ref={exportRef}>
            <button
              type="button"
              className="react-agendfy-export-button react-agendfy-button react-agendfy-button-primary"
              onClick={() => setIsExportOpen(!isExportOpen)}
              aria-haspopup="menu"
              aria-expanded={isExportOpen}
            >
              <Download className="react-agendfy-icon" size={16} />
              <span>{localeConfig?.calendar_export || "Export"}</span>
            </button>
            {isExportOpen && (
              <div className="react-agendfy-export-menu" role="menu">
                {exportOptions.map((opt) => (
                  <button
                    key={opt.formatName}
                    role="menuitem"
                    className="react-agendfy-export-option"
                    onClick={() => {
                      onExport(opt.formatName);
                      setIsExportOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {headerRightPlugins.map((plugin, i) => (
          <div key={i} className="react-agendfy-plugin-right">{plugin}</div>
        ))}
      </div>
    </div>
  );
};

export default CalendarHeader;