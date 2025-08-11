import {
  Group,
  UnstyledButton,
  Text,
  Popover,
  Stack,
} from "@mantine/core";
import { DatePicker } from '@mantine/dates';
import {
  IconCalendar,
  IconX,
  IconClock,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

interface UnifiedDatePickerProps {
  // Core functionality
  value: Date | null;
  onChange: (date: Date | null) => void;
  
  // Display modes
  mode?: 'single' | 'bulk';
  
  // Bulk mode specific
  selectedCount?: number;
  
  // Customization
  triggerText?: string; // For bulk: "Reschedule Selected", for single: auto-generate from date
  disabled?: boolean;
  notificationContext?: string; // "task", "bulk actions", etc.
  
  // Legacy support
  onClear?: () => void; // For backwards compatibility
}

// Helper functions
const getNextWeekDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

const getNextWeekendDate = () => {
  const date = new Date();
  while (date.getDay() !== 6) {
    date.setDate(date.getDate() + 1);
  }
  return date;
};

const quickOptions = [
  { label: "Today", date: new Date(), icon: "📅", color: "#22c55e" },
  {
    label: "Tomorrow",
    date: new Date(Date.now() + 86400000),
    icon: "☀️",
    color: "#f97316",
  },
  { label: "Next week", date: getNextWeekDate(), icon: "📝", color: "#a855f7" },
  {
    label: "Next weekend",
    date: getNextWeekendDate(),
    icon: "🛋️",
    color: "#3b82f6",
  },
  { label: "No Date", date: null, icon: "⭕", color: "#6b7280" },
];

export function UnifiedDatePicker({ 
  value,
  onChange,
  mode = 'single',
  selectedCount = 1,
  triggerText,
  disabled = false,
  notificationContext = 'task',
  onClear
}: UnifiedDatePickerProps) {
  const [opened, setOpened] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);
  
  const isToday = value?.toDateString() === new Date().toDateString();
  const isBulkMode = mode === 'bulk';

  const handleDateSelect = (date: Date | null) => {
    onChange(date);
    setOpened(false);
    
    // Call legacy onClear callback if provided and date is null
    if (!date && onClear) {
      onClear();
    }
    
    // Show appropriate notifications based on mode
    if (isBulkMode) {
      if (date) {
        notifications.show({
          title: "Bulk Reschedule",
          message: `${selectedCount} ${notificationContext}${selectedCount !== 1 ? 's' : ''} will be rescheduled to ${date.toLocaleDateString(
            "en-US",
            {
              weekday: "long",
              day: "numeric",
              month: "long",
            },
          )}`,
          color: "blue",
          withBorder: true,
        });
      } else {
        notifications.show({
          title: "Date Removed",
          message: `Due date will be removed from ${selectedCount} ${notificationContext}${selectedCount !== 1 ? 's' : ''}`,
          color: "gray",
          withBorder: true,
        });
      }
    } else {
      // Single mode notifications
      notifications.show({
        title: "Date Updated",
        message: date
          ? `${notificationContext.charAt(0).toUpperCase() + notificationContext.slice(1)} scheduled for ${date.toLocaleDateString(
              "en-US",
              {
                weekday: "long",
                day: "numeric",
                month: "long",
              },
            )}`
          : `Date removed from ${notificationContext}`,
        color: date ? "blue" : "gray",
        icon: date ? "📅" : "⭕",
        withBorder: true,
      });
    }
  };

  const handleCalendarSelect = (date: Date | null) => {
    if (date) {
      handleDateSelect(date);
    }
  };

  // Generate trigger button content based on mode
  const getTriggerContent = () => {
    if (isBulkMode || triggerText) {
      // Bulk mode or custom text
      return (
        <Group gap="xs">
          <IconCalendar size={16} />
          <Text size="sm">{triggerText || "Reschedule Selected"}</Text>
        </Group>
      );
    }

    // Single mode - show selected date
    if (!value) {
      return (
        <Group gap="xs">
          <IconCalendar size={16} />
          <Text size="sm">Date</Text>
        </Group>
      );
    }

    if (isToday) {
      return (
        <Group gap="xs">
          <IconCalendar size={16} style={{ color: "#22c55e" }} />
          <Text size="sm" c="#22c55e">
            Today
          </Text>
          {onClear && <IconX size={14} />}
        </Group>
      );
    }

    return (
      <Group gap="xs">
        <IconCalendar size={16} />
        <Text size="sm">
          {value.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
          })}
        </Text>
        {onClear && <IconX size={14} />}
      </Group>
    );
  };

  return (
    <Popover 
      width={300} 
      position="bottom-start"
      opened={opened}
      onClose={() => setOpened(false)}
      disabled={disabled}
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened((o) => !o)}
          disabled={disabled}
          className={`rounded px-3 py-1.5 ${
            disabled 
              ? 'bg-surface-tertiary cursor-not-allowed opacity-50' 
              : isBulkMode 
                ? 'bg-surface-secondary hover:bg-surface-hover'
                : !value 
                  ? "bg-surface-secondary hover:bg-surface-hover" 
                  : "bg-surface-tertiary hover:bg-surface-hover"
          } flex items-center transition-colors`}
        >
          {getTriggerContent()}
        </UnstyledButton>
      </Popover.Target>
      
      <Popover.Dropdown p={0}>
        <Stack gap="xs" p="md">
          {quickOptions.map((option) => (
            <UnstyledButton
              key={option.label}
              onClick={() => handleDateSelect(option.date)}
              className="flex items-center justify-between rounded p-2 hover:bg-surface-hover"
            >
              <Group gap="sm">
                <Text size="lg" style={{ color: option.color }}>
                  {option.icon}
                </Text>
                <Text>{option.label}</Text>
              </Group>
              {option.date && (
                <Text size="sm" c="dimmed">
                  {option.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              )}
            </UnstyledButton>
          ))}

          <div className="mt-2 border-t border-border-primary pt-2">
            <DatePicker
              value={calendarDate}
              onChange={(date) => {
                setCalendarDate(date);
                if (date) {
                  handleCalendarSelect(date);
                }
              }}
              size="sm"
            />

            <UnstyledButton className="mt-2 flex w-full items-center justify-center gap-2 border-t border-border-primary p-3 hover:bg-surface-hover">
              <IconClock size={16} />
              <Text>Time</Text>
            </UnstyledButton>
          </div>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}