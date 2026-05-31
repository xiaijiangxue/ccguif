"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-px text-transparent outline-none transition-all duration-200 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[checked]:bg-primary/80 data-[unchecked]:bg-[color:color-mix(in_srgb,var(--input)_88%,var(--background)_12%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_1px_3px_rgba(15,23,42,0.28)] data-[checked]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_1px_3px_rgba(15,23,42,0.3),0_6px_18px_rgba(37,99,235,0.18)]",
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-[rgba(246,247,250,0.98)] shadow-[0_1px_4px_rgba(15,23,42,0.28)] ring-1 ring-black/5 transition-[translate,transform,background-color,box-shadow] duration-200 motion-reduce:transition-none will-change-transform data-[checked]:translate-x-5 in-[[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-[disabled]:scale-[0.97]",
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
