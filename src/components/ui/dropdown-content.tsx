"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * DropdownContent - 统一下拉弹窗容器
 *
 * 使用 portal 渲染到 document.body，避免 overflow 裁剪。
 * 支持两种定位模式：
 *   1. anchorEl — 基于 DOM 元素定位（适用 selector 下拉）
 *   2. position — 基于固定坐标定位（适用 autocomplete 下拉）
 *
 * 视觉上与 shadcn/ui 的 SelectPopup / DropdownMenuContent 一致。
 */
export interface DropdownContentPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

type DropdownContentProps = {
  /** 定位锚点（与 position 二选一） */
  anchorEl?: HTMLElement | null;
  /** 固定坐标（与 anchorEl 二选一） */
  position?: DropdownContentPosition | null;
  /** 是否可见 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 对齐方式 */
  align?: "start" | "center" | "end";
  /** 弹出方向 */
  side?: "top" | "bottom";
  /** 间距 */
  sideOffset?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 最大宽度 */
  maxWidth?: number | string;
  /** 最大高度 */
  maxHeight?: number | string;
  /** 额外 CSS 类名 */
  className?: string;
  children: ReactNode;
};

const VIEWPORT_MARGIN = 8;
const DEFAULT_DROPDOWN_HEIGHT = 300;
const DEFAULT_DROPDOWN_WIDTH = 180;

function clampToViewport(value: number, size: number, viewportSize: number) {
  const max = Math.max(VIEWPORT_MARGIN, viewportSize - size - VIEWPORT_MARGIN);
  return Math.min(Math.max(VIEWPORT_MARGIN, value), max);
}

export function DropdownContent({
  anchorEl,
  position,
  open,
  onClose,
  align = "start",
  side = "top",
  sideOffset = 4,
  minWidth,
  maxWidth,
  maxHeight,
  className,
  children,
}: DropdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });
  const [mounted, setMounted] = useState(false);
  const [effectiveSide, setEffectiveSide] = useState<"top" | "bottom">(side);

  // 挂载标记（确保只在客户端渲染 portal）
  useEffect(() => {
    setMounted(true);
  }, []);

  /** 计算定位 */
  const updatePosition = useCallback(() => {
    if (!open) return;

    const containerRect = containerRef.current?.getBoundingClientRect() ?? null;

    if (position) {
      const measuredWidth = containerRect?.width ?? minWidth ?? Math.max(200, position.width);
      const measuredHeight = containerRect?.height ?? DEFAULT_DROPDOWN_HEIGHT;
      const clampedLeft = clampToViewport(position.left, measuredWidth, window.innerWidth);
      const preferredTop =
        side === "top"
          ? position.top - measuredHeight - sideOffset
          : position.top + position.height + sideOffset;
      const fallbackTop =
        side === "top"
          ? position.top + position.height + sideOffset
          : position.top - measuredHeight - sideOffset;
      const shouldFlip =
        side === "top"
          ? preferredTop < VIEWPORT_MARGIN
          : preferredTop + measuredHeight > window.innerHeight - VIEWPORT_MARGIN;
      const resolvedSide = shouldFlip ? (side === "top" ? "bottom" : "top") : side;
      const rawTop = shouldFlip ? fallbackTop : preferredTop;
      const clampedTop = clampToViewport(rawTop, measuredHeight, window.innerHeight);

      setEffectiveSide(resolvedSide);
      setStyle({
        position: "fixed",
        left: clampedLeft,
        top: clampedTop,
        zIndex: 9999,
        minWidth: minWidth ?? Math.max(200, position.width),
        maxWidth: maxWidth ?? "min(90vw, 480px)",
        maxHeight: maxHeight ?? "min(50vh, 400px)",
        visibility: "visible",
      });
      return;
    }

    if (!anchorEl) {
      setStyle({ visibility: "hidden" });
      return;
    }

    const anchorRect = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const measuredWidth = containerRect?.width ?? minWidth ?? Math.max(DEFAULT_DROPDOWN_WIDTH, anchorRect.width);
    const measuredHeight = containerRect?.height ?? DEFAULT_DROPDOWN_HEIGHT;

    const preferredTop =
      side === "top"
        ? anchorRect.top - measuredHeight - sideOffset
        : anchorRect.bottom + sideOffset;
    const fallbackTop =
      side === "top"
        ? anchorRect.bottom + sideOffset
        : anchorRect.top - measuredHeight - sideOffset;
    const shouldFlip =
      side === "top"
        ? preferredTop < VIEWPORT_MARGIN
        : preferredTop + measuredHeight > vh - VIEWPORT_MARGIN;
    const resolvedSide = shouldFlip ? (side === "top" ? "bottom" : "top") : side;
    const rawTop = shouldFlip ? fallbackTop : preferredTop;
    const top = clampToViewport(rawTop, measuredHeight, vh);

    let left: number;
    if (align === "center") {
      left = anchorRect.left + (anchorRect.width - measuredWidth) / 2;
    } else if (align === "end") {
      left = anchorRect.right - measuredWidth;
    } else {
      left = anchorRect.left;
    }

    left = clampToViewport(left, measuredWidth, vw);

    setEffectiveSide(resolvedSide);
    setStyle({
      position: "fixed",
      left,
      top,
      zIndex: 9999,
      minWidth: minWidth ?? Math.max(DEFAULT_DROPDOWN_WIDTH, anchorRect.width),
      maxWidth: maxWidth ?? "min(90vw, 480px)",
      maxHeight: maxHeight ?? "min(50vh, 400px)",
      visibility: "visible",
    });
  }, [anchorEl, position, open, align, side, sideOffset, minWidth, maxWidth, maxHeight]);

  // 位置更新
  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  // 窗口变化时重算位置
  useEffect(() => {
    if (!open) return;
    const handleResize = () => updatePosition();
    const scrollOptions = { capture: true, passive: true } as const;
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, scrollOptions);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, scrollOptions);
    };
  }, [open, updatePosition]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={containerRef}
      data-state={open ? "open" : "closed"}
      data-side={effectiveSide}
      className={cn(
        // shadcn 弹出层基础样式
        "z-50 min-w-[8rem] overflow-y-auto rounded-[14px] border border-[color:color-mix(in_srgb,var(--border)_74%,#dce5f2_26%)] bg-[color:color-mix(in_srgb,white_96%,var(--accent)_4%)] p-1.5 text-popover-foreground shadow-[0_14px_34px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)] backdrop-blur-[10px]",
        // 入场/出场动画
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
