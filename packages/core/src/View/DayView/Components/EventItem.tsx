import { Resizable } from "re-resizable";
import { BaseEventProps } from "../../../types/types";
import BaseEvent from "../../../Components/BaseEvent";
import { memo } from "react";

export const EventItemComponent: React.FC<BaseEventProps> = (props) => {
  return (
    // The day view has no resize handler yet: no handle that does nothing.
    <Resizable enable={{ bottom: false }}>
      <BaseEvent {...props} />
    </Resizable>
  );
};

export const EventItem = memo(EventItemComponent);