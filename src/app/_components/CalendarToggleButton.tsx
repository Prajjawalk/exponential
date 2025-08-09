"use client";

import { Button, Tooltip } from "@mantine/core";
import { IconCalendar } from "@tabler/icons-react";

interface CalendarToggleButtonProps {
  onClick: () => void;
  isConnected: boolean;
  hasEvents?: boolean;
}

export function CalendarToggleButton({ onClick, isConnected, hasEvents = false }: CalendarToggleButtonProps) {
  if (!isConnected) {
    return null; // Don't show button if calendar isn't connected
  }

  return (
    <Tooltip label="View calendar in detail" position="left">
      <Button
        onClick={onClick}
        leftSection={<IconCalendar size={16} />}
        variant="light"
        color="blue"
        size="sm"
      >
        Calendar
        {hasEvents && (
          <div className="ml-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </Button>
    </Tooltip>
  );
}