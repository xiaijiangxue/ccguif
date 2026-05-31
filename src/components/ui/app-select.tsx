"use client";

import type * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_VALUE_SENTINEL = "__app_select_empty__";

export type AppSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
};

type AppSelectProps = {
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  options: readonly AppSelectOption[];
  className?: string;
  popupClassName?: string;
  itemClassName?: string;
  placeholder?: React.ReactNode;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

function toInternalValue(value: string) {
  return value === "" ? EMPTY_VALUE_SENTINEL : value;
}

function fromInternalValue(value: string) {
  return value === EMPTY_VALUE_SENTINEL ? "" : value;
}

export function AppSelect({
  value,
  onValueChange,
  options,
  className,
  popupClassName,
  itemClassName,
  placeholder,
  ariaLabel,
  id,
  disabled = false,
  "data-testid": dataTestId,
}: AppSelectProps) {
  const normalizedValue = value ?? "";
  const selectedOption = options.find((option) => option.value === normalizedValue) ?? null;
  const selectedLabel = selectedOption?.label ?? placeholder ?? "";

  return (
    <Select
      disabled={disabled}
      value={toInternalValue(normalizedValue)}
      onValueChange={(nextValue) =>
        onValueChange(fromInternalValue(nextValue ?? EMPTY_VALUE_SENTINEL))
      }
    >
      <SelectTrigger
        id={id}
        className={className}
        aria-label={ariaLabel}
        data-testid={dataTestId}
      >
        <SelectValue>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent className={popupClassName}>
        {options.map((option) => (
          <SelectItem
            key={option.value || EMPTY_VALUE_SENTINEL}
            className={itemClassName}
            disabled={option.disabled}
            title={option.title}
            value={toInternalValue(option.value)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
