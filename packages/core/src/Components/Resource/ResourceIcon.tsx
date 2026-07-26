import React from 'react';
import { Resource } from '../../types/types';

export const ResourceIcon = ({ resource }: {resource: Resource} ) => {
  const getIcon = (type?: string) => {
    switch (type) {
      case 'person':
        return '👤';
      case 'room':
        return '🏢';
      case 'equipment':
        return '🔧';
      default:
        return '📌';
    }
  };

  return (
    <span
      title={`${resource.name} (${resource.type})`}
      className="react-agendfy-resourceicon"
    >
      {getIcon(resource.type)}
    </span>
  );
};
