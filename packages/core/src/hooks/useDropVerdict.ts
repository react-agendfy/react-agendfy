import { useCallback, useContext, useRef, useState } from "react";
import type { ChangeRejection, EventChange, EventProps } from "../types/types";
import { CalendarContext } from "../context/CalendarContext";

/**
 * Live validation while dragging (RFC 001, layer 2): views call `check`
 * with the drop they would make at the current position; `verdict` is the
 * rejection to paint on the drag preview, or null. Re-renders only when the
 * outcome changes, not on every pointer move. Standalone views (no
 * calendar) never reject.
 */
export function useDropVerdict() {
  // `previewChange` of the enclosing calendar; undefined for a standalone view.
  const preview = useContext(CalendarContext)?.previewChange;
  const [verdict, setVerdict] = useState<ChangeRejection | null>(null);
  const lastKey = useRef("");

  const update = useCallback((next: ChangeRejection | null) => {
    const key = next ? `${next.reason}|${next.message ?? ""}|${next.conflicts?.map((e) => e.id).join(",") ?? ""}` : "";
    if (key === lastKey.current) return;
    lastKey.current = key;
    setVerdict(next);
  }, []);

  const check = useCallback(
    (candidate: EventProps | null, before?: EventProps, kind: EventChange["kind"] = "move") => {
      const result = candidate && preview ? preview({ kind, event: candidate, before, source: "user" }) : true;
      update(result === true ? null : result);
    },
    [preview, update]
  );

  const clear = useCallback(() => update(null), [update]);

  return { verdict, check, clear };
}
