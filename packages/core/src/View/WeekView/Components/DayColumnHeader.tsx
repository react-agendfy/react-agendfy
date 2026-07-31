import React from 'react';
import { format, isToday } from 'date-fns';
import { getLocale } from '../../../Utils/locate';

interface DayColumnHeaderProps {
    dayDate: Date;
    config: any;
}

export const DayColumnHeader: React.FC<DayColumnHeaderProps> = ({ dayDate, config }) => {
  const locale = getLocale(config?.lang || 'en');
  const isCurrentDay = isToday(dayDate);

  const headerClass = `react-agendfy-daycolumn-header ${isCurrentDay ? 'react-agendfy-daycolumn-header-today' : ''}`;
  
  return (
    <div className={headerClass}>
      <div className="react-agendfy-daycolumn-header-text">
        <div className="react-agendfy-daycolumn-weekday">
          {format(dayDate, 'EEE', { locale })}
        </div>
        <div className="react-agendfy-daycolumn-date">
          {format(dayDate, 'd', { locale })}
        </div>
      </div>
    </div>
  );
};