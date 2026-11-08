import React, { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface ViewMenuProps {
  group: { label: string; views: { name: string; label: string }[] };
  currentView: string;
  onViewChange: (view: string) => void;
}

/**
 * A group of views in the header (`headerViews: [{ label, views }]`): one
 * button that shows the active view of the group, and a menu of its views.
 */
const ViewMenu: React.FC<ViewMenuProps> = ({ group, currentView, onViewChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = group.views.find((v) => v.name === currentView);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    // Focus the checked item (or the first) when the menu opens.
    const index = Math.max(0, group.views.findIndex((v) => v.name === currentView));
    itemRefs.current[index]?.focus();
    return () => document.removeEventListener("mousedown", close);
  }, [open, group.views, currentView]);

  const choose = (name: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    onViewChange(name);
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") focus(at + 1);
    else if (e.key === "ArrowUp") focus(at - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(items.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") buttonRef.current?.focus();
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div className="react-agendfy-view-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`react-agendfy-view-menu-button react-agendfy-button react-agendfy-button-primary ${active ? "react-agendfy-button-active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {active ? active.label : group.label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="react-agendfy-view-menu-list" role="menu" aria-label={group.label} onKeyDown={onMenuKeyDown}>
          {group.views.map((view, i) => (
            <button
              key={view.name}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={view.name === currentView}
              className="react-agendfy-view-menu-item"
              onClick={() => choose(view.name)}
            >
              {view.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewMenu;
