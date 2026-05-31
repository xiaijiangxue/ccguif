"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

  // 挂载标记（确保只在客户端渲染 portal）
  useEffect(() => {
    setMounted(true);
  }, []);

  /** 计算定位 */
  const updatePosition = useCallback(() => {
    if (!open) return;

    if (position) {
      // 坐标模式：给 position 加一个 safe 内边距
      setStyle({
        position: "fixed",
        left: Math.max(8, position.left),
        top: position.top,
        zIndex: 9999,
        minWidth: minWidth ?? Math.max(200, position.width),
        maxWidth: maxWidth ?? "min(90vw, 480px)",
        maxHeight: maxHeight ?? "min(50vh, 400px)",
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

    let top: number;
    if (side === "top") {
      top = anchorRect.top - sideOffset;
    } else {
      top = anchorRect.bottom + sideOffset;
    }

    let left: number;
    if (align === "center") {
      left = anchorRect.left + anchorRect.width / 2;
    } else if (align === "end") {
      left = anchorRect.right;
    } else {
      left = anchorRect.left;
    }

    // 自适应边界
    const estimatedWidth = minWidth ?? Math.max(180, anchorRect.width);
    const estimatedHeight = 300;

    // 水平边界修正
    if (left + estimatedWidth > vw - 8) {
      left = vw - estimatedWidth - 8;
    }
    if (left < 8) {
      left = 8;
    }

    // 垂直边界修正
    if (side === "top" && top < 8) {
      top = anchorRect.bottom + sideOffset;
    } else if (side === "bottom" && top + estimatedHeight > vh - 8) {
      top = anchorRect.top - sideOffset;
    }

    setStyle({
      position: "fixed",
      left,
      top,
      zIndex: 9999,
      minWidth: minWidth ?? Math.max(180, anchorRect.width),
      maxWidth: maxWidth ?? "min(90vw, 480px)",
      maxHeight: maxHeight ?? "min(50vh, 400px)",
    });
  }, [anchorEl, position, open, align, side, sideOffset, minWidth, maxWidth, maxHeight]);

  // 位置更新
  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  // 窗口变化时重算位置
  useEffect(() => {
    if (!open) return;
    const handleResize = () => updatePosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
      className={cn(
        // shadcn 弹出层基础样式
        "z-50 min-w-[8rem] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
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
