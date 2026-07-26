import { format } from 'date-fns';
import React from 'react';
import { ensureDate } from '../../Utils/DateTrannforms';
import { ResourceIcon } from './ResourceIcon';
import { EventProps, Resource } from '../../types/types';

const ResourceView = ({ resources, events, currentDate }: any) => {
  return (
    <div className="react-agendfy-resourceview-container">
      <div className="react-agendfy-resourceview-header">
        <h3 className="react-agendfy-resourceview-header-title">Visualização por Recurso</h3>
      </div>
      <div className="react-agendfy-resourceview-content">
        {resources.map((resource: Resource) => (
          <div key={resource.id} className="react-agendfy-resourceview-item">
            <div className="react-agendfy-resourceview-item-header">
              <ResourceIcon resource={resource} />
              <span className="react-agendfy-resourceview-item-name">{resource.name}</span>
              <span className="react-agendfy-resourceview-item-type">({resource.type})</span>
            </div>
            <div className="react-agendfy-resourceview-item-events">
              {events
                .filter((event: EventProps) => 
                  event.resources && 
                  event.resources.some(r => r.id === resource.id)
                )
                .map((event: EventProps) => (
                  <div key={event.id} className="react-agendfy-resourceview-event">
                    {event.title} - {format(ensureDate(event.start), 'dd/MM HH:mm')} a {format(ensureDate(event.end), 'dd/MM HH:mm')}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResourceView;
