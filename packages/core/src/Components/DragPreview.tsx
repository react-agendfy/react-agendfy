import type { ReactNode } from "react";
import BaseEvent from "./BaseEvent";
import type { ChangeRejection, Config, EventProps } from "../types/types";
import { cx } from "../context/ClassNamesContext";

/**
 * Wrapper of every drag preview. `invalid` (the live verdict of the drop at
 * the current position) marks it as refused, with the reason as a data
 * attribute for styling.
 */
export const DragPreviewFrame = ({
  invalid,
  children,
}: {
  invalid?: ChangeRejection | null;
  children: ReactNode;
}) => (
  <div
    className={cx("react-agendfy-drag-preview", !!invalid && "react-agendfy-drag-preview--invalid")}
    data-invalid-reason={invalid?.reason}
    style={{ position: "relative", width: "100%", height: "100%" }}
  >
    {children}
  </div>
);

/**
 * The copy of a timed event that follows the pointer inside a DragOverlay
 * (week/day views). DragOverlay sizes its wrapper to the dragged element, so
 * the preview just fills it.
 */
const DragPreview = ({
  event,
  config,
  invalid,
}: {
  event: EventProps;
  config?: Config;
  invalid?: ChangeRejection | null;
}) => (
  <DragPreviewFrame invalid={invalid}>
    <BaseEvent
      // Distinct id: the preview must not register as a second draggable
      // for the event being dragged.
      event={{ ...event, id: `${event.id}::overlay` }}
      config={config}
      positionStyle={{ top: 0, left: 0, width: "100%", height: "100%" }}
      isDraggable={false}
      customClassName="react-agendfy-baseevent--dragging"
    />
  </DragPreviewFrame>
);

export default DragPreview;
