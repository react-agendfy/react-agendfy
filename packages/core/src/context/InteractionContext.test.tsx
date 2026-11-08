/*
 * One DndContext per calendar: views register their handlers with the
 * InteractionProvider; a view without a provider creates its own context.
 */
import React from "react";
import { render } from "@testing-library/react";
import { InteractionProvider, ViewDndScope, type ViewDragOptions } from "./InteractionContext";

type Captured = { onDragEnd?: (e: unknown) => void; accessibility?: unknown };
const contexts: Captured[] = [];

jest.mock("@dnd-kit/core", () => {
  const actual = jest.requireActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: (props: Captured & { children: React.ReactNode }) => {
      contexts.push(props);
      return <div data-testid="dnd">{props.children}</div>;
    },
  };
});

const OPTIONS: ViewDragOptions = { instructions: "pick me up" };
const dragEnd = { active: { id: "a" }, over: { id: "slot" } };

beforeEach(() => {
  contexts.length = 0;
});

it("a view inside the provider adds no DndContext and receives the drag events", () => {
  const onDragEnd = jest.fn();
  const { getAllByTestId } = render(
    <InteractionProvider>
      <ViewDndScope handlers={{ onDragEnd }} options={OPTIONS}>
        <span>view</span>
      </ViewDndScope>
    </InteractionProvider>
  );
  expect(getAllByTestId("dnd")).toHaveLength(1);
  contexts[contexts.length - 1].onDragEnd?.(dragEnd);
  expect(onDragEnd).toHaveBeenCalledWith(dragEnd);
  // The registered view's options reach the shared context.
  expect(contexts[contexts.length - 1].accessibility).toEqual({ screenReaderInstructions: { draggable: "pick me up" } });
});

it("uses the latest handlers without re-registering", () => {
  const first = jest.fn();
  const second = jest.fn();
  const tree = (onDragEnd: jest.Mock) => (
    <InteractionProvider>
      <ViewDndScope handlers={{ onDragEnd }} options={OPTIONS}>
        <span>view</span>
      </ViewDndScope>
    </InteractionProvider>
  );
  const { rerender } = render(tree(first));
  rerender(tree(second));
  contexts[contexts.length - 1].onDragEnd?.(dragEnd);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it("the last mounted view wins; an unmounted view stops receiving events", () => {
  const month = jest.fn();
  const week = jest.fn();
  const { rerender } = render(
    <InteractionProvider>
      <ViewDndScope handlers={{ onDragEnd: month }} options={OPTIONS}>
        <span>month</span>
      </ViewDndScope>
    </InteractionProvider>
  );
  rerender(
    <InteractionProvider>
      <ViewDndScope handlers={{ onDragEnd: week }} options={OPTIONS}>
        <span>week</span>
      </ViewDndScope>
    </InteractionProvider>
  );
  contexts[contexts.length - 1].onDragEnd?.(dragEnd);
  expect(week).toHaveBeenCalledTimes(1);
  expect(month).not.toHaveBeenCalled();

  rerender(<InteractionProvider>{null}</InteractionProvider>);
  contexts[contexts.length - 1].onDragEnd?.(dragEnd);
  expect(week).toHaveBeenCalledTimes(1);
});

it("without a provider the view creates its own DndContext", () => {
  const onDragEnd = jest.fn();
  const { getAllByTestId } = render(
    <ViewDndScope handlers={{ onDragEnd }} options={OPTIONS}>
      <span>alone</span>
    </ViewDndScope>
  );
  expect(getAllByTestId("dnd")).toHaveLength(1);
  contexts[contexts.length - 1].onDragEnd?.(dragEnd);
  expect(onDragEnd).toHaveBeenCalledTimes(1);
});

it("a nested provider passes through: one DndContext spans both", () => {
  const { getAllByTestId } = render(
    <InteractionProvider>
      <span>external list</span>
      <InteractionProvider>
        <ViewDndScope handlers={{}} options={OPTIONS}>
          <span>calendar</span>
        </ViewDndScope>
      </InteractionProvider>
    </InteractionProvider>
  );
  expect(getAllByTestId("dnd")).toHaveLength(1);
});
