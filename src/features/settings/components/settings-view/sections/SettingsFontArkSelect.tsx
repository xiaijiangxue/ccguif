"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import * as React from "react";

type SettingsFontArkSelectProps = {
  id: string;
  value: string;
  options: readonly string[];
  ariaLabel: string;
  testId?: string;
  onValueChange: (value: string | null) => void;
};

export function SettingsFontArkSelect({
  id,
  value,
  options,
  ariaLabel,
  testId,
  onValueChange,
}: SettingsFontArkSelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(val) => onValueChange(val ?? null)}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        data-testid={testId}
        className="settings-font-ark-trigger"
      >
        <SelectPrimitive.Value className="settings-font-ark-value" placeholder="Select font..." />
        <SelectPrimitive.Icon className="settings-font-ark-indicator transition-transform duration-150 data-[state=open]:rotate-180">
          <ChevronsUpDownIcon className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner side="bottom" sideOffset={6} align="start" className="z-50 outline-none">
          <SelectPrimitive.Popup className="settings-font-ark-content origin-(--transform-origin)">
            <SelectPrimitive.ScrollUpArrow />
            <div className="settings-font-ark-list-wrap">
              <SelectPrimitive.List className="settings-font-ark-list">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option}
                    value={option}
                    className="settings-font-ark-item"
                  >
                    <SelectPrimitive.ItemText className="settings-font-ark-item-text">
                      {option}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </div>
            <SelectPrimitive.ScrollDownArrow />
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
