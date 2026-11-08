import React, { useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { useVirtualRange, type VirtualRangeOptions } from "./useVirtualRange";

const List = (props: Omit<VirtualRangeOptions, "viewportRef"> & { extent?: number; scroll?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { items, totalSize } = useVirtualRange({ ...props, viewportRef: ref });
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el && props.extent !== undefined) {
          const dim = props.axis === "x" ? "clientWidth" : "clientHeight";
          Object.defineProperty(el, dim, { configurable: true, value: props.extent });
        }
      }}
      data-testid="viewport"
    >
      <span data-testid="total">{totalSize}</span>
      <span data-testid="items">{items.map((i) => `${i.index}@${i.offset}`).join(",")}</span>
    </div>
  );
};

const items = () => screen.getByTestId("items").textContent;

beforeAll(() => {
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 1;
  });
});

it("renders every item without layout (SSR, jsdom)", () => {
  render(<List count={5} size={10} />);
  expect(items()).toBe("0@0,1@10,2@20,3@30,4@40");
  expect(screen.getByTestId("total").textContent).toBe("50");
});

it("renders only the visible items plus overscan, and follows the scroll", () => {
  render(<List count={100} size={20} extent={100} overscan={1} />);
  // 0–100px: items 0..5 (5 starts at 100), +1 overscan.
  expect(items()).toBe("0@0,1@20,2@40,3@60,4@80,5@100,6@120");
  const viewport = screen.getByTestId("viewport");
  act(() => {
    viewport.scrollTop = 1000;
    viewport.dispatchEvent(new Event("scroll"));
  });
  expect(items()).toBe("49@980,50@1000,51@1020,52@1040,53@1060,54@1080,55@1100,56@1120");
});

it("handles variable sizes", () => {
  const sizes = [50, 10, 10, 200, 10];
  render(<List count={5} size={(i) => sizes[i]} extent={60} overscan={0} />);
  expect(items()).toBe("0@0,1@50,2@60");
  expect(screen.getByTestId("total").textContent).toBe("280");
});

it("horizontal RTL: a negative scrollLeft counts from the start", () => {
  render(<List count={50} size={100} axis="x" extent={250} overscan={0} />);
  const viewport = screen.getByTestId("viewport");
  act(() => {
    viewport.scrollLeft = -1000;
    viewport.dispatchEvent(new Event("scroll"));
  });
  expect(items()).toBe("10@1000,11@1100,12@1200");
});

it("startOffset: a label column before the list", () => {
  render(<List count={20} size={100} extent={150} overscan={0} startOffset={64} />);
  // Viewport 0–150 covers list 0–86: items 0 only… and item 0 starts at 0.
  expect(items()).toBe("0@0");
});
