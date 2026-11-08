import React, {
  createContext,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Active,
  CollisionDetection,
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
  KeyboardSensor,
  Over,
  PointerActivationConstraint,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { EventProps } from "../types/types";
import type { ExternalDragData } from "../Utils/externalDrag";

/*
 * One DndContext per calendar (RFC 001, layer 2). Views no longer own a
 * DndContext: they register their drag handlers with the InteractionProvider
 * at the calendar root. That shared context is what lets things outside a
 * view (an external list, a second calendar) take part in a drag.
 *
 * A view rendered on its own (unit tests, direct use) has no provider and
 * falls back to its own DndContext with the same handlers and options.
 */

/** What a view needs to resolve a drop: the dragged item and what it is over. */
export interface DragSnapshot {
  active: Active;
  over?: Over | null;
}

/**
 * A view's answer to "where would this drag land": the moved event, or the
 * new event an external item becomes (`external` set, no `dragged`).
 */
export interface DropResolution {
  dragged?: EventProps;
  updated: EventProps;
  external?: ExternalDragData;
}

export interface ViewDragHandlers {
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  /** The droppable under the drag changed (`onDragMove` still reports the previous one). */
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
  /**
   * Pixels one arrow key moves a keyboard drag: a slot, a column, a day
   * cell. Measured by the view when the drag starts. Default 25px.
   */
  keyboardStep?: () => { x: number; y: number } | null;
  /** One arrow key press of a keyboard drag (dx/dy are -1, 0 or 1). */
  onKeyboardStep?: (dx: number, dy: number) => void;
  /**
   * Keyboard drag by target: where an arrow key moves the dragged element
   * (its new top-left), or undefined to stay. Takes over from keyboardStep.
   */
  keyboardTarget?: (
    direction: KeyboardDirection,
    args: Parameters<KeyboardCoordinateGetter>[1]
  ) => { x: number; y: number } | undefined;
}

export type KeyboardDirection = "up" | "down" | "left" | "right";
const DIRECTIONS: Record<string, KeyboardDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const DEFAULT_STEP = 25;

/** Per-view DndContext settings. Pass stable objects (module constants). */
export interface ViewDragOptions {
  collisionDetection?: CollisionDetection;
  activationConstraint?: PointerActivationConstraint;
  /** Screen-reader instructions for picking up an event in this view. */
  instructions?: string;
}

interface InteractionContextValue {
  /** Makes these handlers the active ones; returns the unregister function. */
  register: (handlers: RefObject<ViewDragHandlers>, options: ViewDragOptions) => () => void;
}

const InteractionContext = createContext<InteractionContextValue | null>(null);

const accessibilityFor = (instructions?: string) =>
  instructions ? { screenReaderInstructions: { draggable: instructions } } : undefined;

/** The DndContext of a scope, wired to the latest handlers through a ref. */
const DndScope = ({
  handlers,
  options,
  children,
}: {
  handlers: RefObject<ViewDragHandlers | null>;
  options: ViewDragOptions;
  children: ReactNode;
}) => {
  // Arrow keys move by the view's own unit, so a keyboard drag lands on
  // slots/days instead of crawling 25px at a time.
  // Stable for the scope's lifetime: it only reads the handlers ref when a
  // key is pressed.
  const [coordinateGetter] = useState(
    (): KeyboardCoordinateGetter => (event, args) => {
      const c = args.currentCoordinates;
      const direction = DIRECTIONS[event.code];
      const byTarget = handlers.current?.keyboardTarget;
      if (byTarget) return direction ? byTarget(direction, args) ?? c : undefined;
      const step = handlers.current?.keyboardStep?.() ?? null;
      const x = step ? step.x : DEFAULT_STEP;
      const y = step ? step.y : DEFAULT_STEP;
      const move = (dx: number, dy: number) => {
        handlers.current?.onKeyboardStep?.(dx, dy);
        return { ...c, x: c.x + dx * x, y: c.y + dy * y };
      };
      switch (event.code) {
        case "ArrowRight":
          return move(1, 0);
        case "ArrowLeft":
          return move(-1, 0);
        case "ArrowDown":
          return move(0, 1);
        case "ArrowUp":
          return move(0, -1);
        default:
          return undefined;
      }
    }
  );
  const sensors = useSensors(
    useSensor(PointerSensor, options.activationConstraint ? { activationConstraint: options.activationConstraint } : undefined),
    useSensor(KeyboardSensor, { coordinateGetter })
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={options.collisionDetection}
      accessibility={accessibilityFor(options.instructions)}
      onDragStart={(e) => handlers.current?.onDragStart?.(e)}
      onDragMove={(e) => handlers.current?.onDragMove?.(e)}
      onDragOver={(e) => handlers.current?.onDragOver?.(e)}
      onDragEnd={(e) => handlers.current?.onDragEnd?.(e)}
      onDragCancel={(e) => handlers.current?.onDragCancel?.(e)}
    >
      {children}
    </DndContext>
  );
};

const RootDnd = ({ children }: { children: ReactNode }) => {
  // The registered view's handlers (a ref to a ref, so neither registering
  // nor a view's re-render re-renders the whole calendar).
  const active = useRef<RefObject<ViewDragHandlers> | null>(null);
  const handlers = useMemo<RefObject<ViewDragHandlers | null>>(
    () => ({
      get current() {
        return active.current?.current ?? null;
      },
    }),
    []
  );
  const [options, setOptions] = useState<ViewDragOptions>({});

  const register = useCallback((viewHandlers: RefObject<ViewDragHandlers>, viewOptions: ViewDragOptions) => {
    active.current = viewHandlers;
    setOptions(viewOptions);
    return () => {
      if (active.current === viewHandlers) active.current = null;
    };
  }, []);
  const value = useMemo(() => ({ register }), [register]);

  return (
    <InteractionContext.Provider value={value}>
      <DndScope handlers={handlers} options={options}>
        {children}
      </DndScope>
    </InteractionContext.Provider>
  );
};

/**
 * The calendar's shared drag context. Nested inside another provider it
 * passes through, so one DndContext can span several components.
 */
export const InteractionProvider = ({ children }: { children: ReactNode }) => {
  const outer = useContext(InteractionContext);
  return outer ? <>{children}</> : <RootDnd>{children}</RootDnd>;
};

/**
 * Wraps a view's drag-enabled content: registers the handlers with the
 * calendar's InteractionProvider, or creates a DndContext when there is none.
 */
export const ViewDndScope = ({
  handlers,
  options,
  children,
}: {
  handlers: ViewDragHandlers;
  options: ViewDragOptions;
  children: ReactNode;
}) => {
  const ctx = useContext(InteractionContext);
  const handlersRef = useRef(handlers);
  // Latest handlers for the drag callbacks (read in events, not in render).
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => ctx?.register(handlersRef, options), [ctx, options]);

  return ctx ? <>{children}</> : <DndScope handlers={handlersRef} options={options}>{children}</DndScope>;
};
