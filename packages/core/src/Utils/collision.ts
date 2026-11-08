import { CollisionDetection, pointerWithin, rectIntersection } from "@dnd-kit/core";

/**
 * The droppable under the pointer; a keyboard drag has no pointer, so it
 * falls back to the droppable under the dragged element.
 */
export const pointerOrRect: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
