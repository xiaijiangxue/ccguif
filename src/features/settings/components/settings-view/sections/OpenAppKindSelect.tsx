"use client";

import { Portal } from "@ark-ui/react/portal";
import { Select, createListCollection } from "@ark-ui/react/select";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import * as React from "react";

import { cn } from "@/lib/utils";

type OpenAppKindOption = {
  value: string;
  label: string;
};

type OpenAppKindSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly OpenAppKindOption[];
  ariaLabel: string;
  className?: string;
};

export function OpenAppKindSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: OpenAppKindSelectProps) {
  const collection = React.useMemo(
    () =>
      createListCollection({
        items: [...options],
        itemToString: (item) => item.label,
        itemToValue: (item) => item.value,
      }),
    [options],
  );
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  return (
    <Select.Root
      collection={collection}
      positioning={{ sameWidth: true, gutter: 6 }}
      value={value ? [value] : []}
      onValueChange={(details) => {
        onValueChange(details.value[0] ?? "");
      }}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "relative inline-flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input/80 bg-background/95 px-3 text-left text-sm text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.03)] outline-none transition-[border-color,box-shadow,background-color] hover:border-input hover:bg-background focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/14",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{selectedLabel}</span>
        <Select.Indicator className="shrink-0 text-muted-foreground/78 transition-transform duration-150 data-[state=open]:rotate-180">
          <ChevronsUpDownIcon className="size-4" />
        </Select.Indicator>
      </Select.Trigger>

      <Portal>
        <Select.Positioner className="z-50 outline-none">
          <Select.Content
            style={{ width: "var(--reference-width)" }}
            className="origin-[var(--transform-origin)] overflow-hidden rounded-2xl border border-border/70 bg-white/96 p-1.5 text-foreground shadow-[0_18px_50px_rgba(15,23,42,0.12),0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur-xl outline-none dark:bg-popover/96"
          >
            <Select.List className="w-full overflow-y-auto">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  item={option}
                  className="group flex min-h-9 w-full min-w-0 cursor-default items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-accent/72 data-[state=checked]:bg-[color-mix(in_srgb,var(--accent-primary,#4d8ff0)_12%,white)]"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <Select.ItemIndicator className="flex size-4 items-center justify-center text-[color:var(--accent-primary,#4d8ff0)]">
                      <CheckIcon className="size-3.5" />
                    </Select.ItemIndicator>
                  </span>
                  <Select.ItemText className="min-w-0 flex-1 whitespace-nowrap text-left font-medium text-foreground/92">
                    {option.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
