import React from 'react';
import { ResourceIcon } from "./ResourceIcon";
import { Resource } from '../../types/types';

/**
 * Shows an event's resources. Nothing when there are none — including the
 * "default" placeholder that normalizeEvents assigns for resource filtering
 * (it used to render a 📌 on every event).
 */
const ResourceDisplay = ({ resources, maxVisible = 2 }: { resources: Resource[], maxVisible: number}) => {
  const resourceList = (resources ?? []).filter((r) => r && r.id !== "default");
  if (resourceList.length === 0) return null;

  const visibleResources = resourceList.slice(0, maxVisible);
  const hiddenCount = resourceList.length - maxVisible;

  return (
    <div data-testid="resource-display-container" className="react-agendfy-resource-display-container">
      {visibleResources.map((resource: Resource, index: number) => (
        <ResourceIcon key={resource.id || index} resource={resource} />
      ))}
      {hiddenCount > 0 && (
        <span title={`${hiddenCount} more resources`} className="react-agendfy-resource-display-hidden-text">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};

export default ResourceDisplay;
