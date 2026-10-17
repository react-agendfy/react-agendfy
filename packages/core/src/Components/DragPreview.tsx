import BaseEvent from "./BaseEvent";
import type { Config, EventProps } from "../types/types";

/**
 * The copy of a timed event that follows the pointer inside a DragOverlay
 * (week/day views). DragOverlay sizes its wrapper to the dragged element, so
 * the preview just fills it.
 */
const DragPreview = ({ event, config }: { event: EventProps; config?: Config }) => (
  <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <BaseEvent
      // Distinct id: the preview must not register as a second draggable
      // for the event being dragged.
      event={{ ...event, id: `${event.id}::overlay` }}
      config={config}
      positionStyle={{ top: 0, left: 0, width: "100%", height: "100%" }}
      isDraggable={false}
      customClassName="react-agendfy-baseevent--dragging"
    />
  </div>
);

export default DragPreview;
