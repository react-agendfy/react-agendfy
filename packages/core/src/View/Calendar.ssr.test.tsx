/**
 * @jest-environment node
 */
// Server render (Inertia/Next SSR): no window/document at render time.
import React from "react";
import { renderToString } from "react-dom/server";
import { Calendar } from "../index";

describe("Calendar SSR", () => {
  it("renders to a string in a non-DOM environment", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(
      <Calendar
        events={[
          {
            id: "1",
            title: "Consulta",
            start: "2026-03-11T14:00:00Z",
            end: "2026-03-11T15:00:00Z",
            rrule: { freq: "weekly", count: 3 },
          },
        ]}
        config={{ timeZone: "Europe/Lisbon", lang: "pt", defaultView: "month" }}
      />
    );
    expect(html).toContain("react-agendfy-header-toolbar");
  });
});
