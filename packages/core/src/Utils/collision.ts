import { CollisionDetection, pointerWithin, rectIntersection } from "@dnd-kit/core";

/**
 * The droppable under the pointer; a keyboard drag has no pointer, so it
 * falls back to the droppable under the dragged element.
 */
export const pointerOrRect: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

/**
 * The droppable under the pointer; without one (keyboard), the droppable
 * holding the dragged element's top-left corner. Unlike the overlap test,
 * a tall event spanning several slots still lands on the slot it starts in.
 */
export const pointerOrTopLeft: CollisionDetection = (args) => {
  if (args.pointerCoordinates) return pointerWithin(args);
  const { collisionRect, droppableRects, droppableContainers } = args;
  const x = collisionRect.left + 1;
  const y = collisionRect.top + 1;
  for (const container of droppableContainers) {
    const r = droppableRects.get(container.id);
    if (r && r.left <= x && x < r.right && r.top <= y && y < r.bottom) {
      return [{ id: container.id, data: { droppableContainer: container, value: 0 } }];
    }
  }
  return rectIntersection(args);
};
