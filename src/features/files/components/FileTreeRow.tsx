import { memo, type DragEvent, type MouseEvent } from "react";
import Plus from "lucide-react/dist/esm/icons/plus";
import FileIcon from "../../../components/FileIcon";
import type { FileTreeNode } from "../utils/treeModel";

export type FileTreeRowProps = {
  node: FileTreeNode;
  depth: number;
  isExpanded: boolean;
  canExpand: boolean;
  isLazyFolder: boolean;
  gitStatusClass: string;
  isGitignored: boolean;
  isSelected: boolean;
  isPrimarySelection: boolean;
  isEditorActive: boolean;
  mentionAriaLabel: string;
  mentionTitle: string;
  onSelect: (node: FileTreeNode, event: MouseEvent<HTMLButtonElement>) => void;
  onOpen: (
    node: FileTreeNode,
    event: MouseEvent<HTMLButtonElement>,
    canExpand: boolean,
    isLazyFolder: boolean,
  ) => void;
  onContextMenu: (node: FileTreeNode, event: MouseEvent<HTMLButtonElement>) => void;
  onToggleExpanded: (node: FileTreeNode, isLazyFolder: boolean) => void;
  onDragStart: (node: FileTreeNode, isSelected: boolean, event: DragEvent<HTMLButtonElement>) => void;
  onDrag: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: DragEvent<HTMLButtonElement>) => void;
  onMention: (node: FileTreeNode, event: MouseEvent<HTMLButtonElement>) => void;
};

export const FileTreeRow = memo(function FileTreeRow({
  node,
  depth,
  isExpanded,
  canExpand,
  isLazyFolder,
  gitStatusClass,
  isGitignored,
  isSelected,
  isPrimarySelection,
  isEditorActive,
  mentionAriaLabel,
  mentionTitle,
  onSelect,
  onOpen,
  onContextMenu,
  onToggleExpanded,
  onDragStart,
  onDrag,
  onDragEnd,
  onMention,
}: FileTreeRowProps) {
  const isFolder = node.type === "folder";

  return (
    <div className="file-tree-row-wrap">
      <button
        type="button"
        className={`file-tree-row${isFolder ? " is-folder" : " is-file"}${isGitignored ? " is-gitignored" : ""}${isSelected ? " is-selected" : ""}${isPrimarySelection ? " is-primary" : ""}${isEditorActive ? " is-editor-active" : ""}`}
        style={{ paddingLeft: `${depth * 10}px` }}
        onClick={(event) => onSelect(node, event)}
        onDoubleClick={(event) => onOpen(node, event, canExpand, isLazyFolder)}
        onContextMenu={(event) => onContextMenu(node, event)}
        draggable
        onDragStart={(event) => onDragStart(node, isSelected, event)}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      >
        {isFolder && canExpand ? (
          <span
            className={`file-tree-chevron${isExpanded ? " is-open" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleExpanded(node, isLazyFolder);
            }}
          >
            ›
          </span>
        ) : (
          <span className="file-tree-spacer" aria-hidden />
        )}
        <span className="file-tree-icon" aria-hidden>
          <FileIcon filePath={node.name} isFolder={isFolder} isOpen={isExpanded} />
        </span>
        <span className={`file-tree-name${gitStatusClass}`}>{node.name}</span>
      </button>
      <button
        type="button"
        className={`ghost icon-button file-tree-action${isSelected ? " is-visible" : ""}`}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => onMention(node, event)}
        aria-label={mentionAriaLabel}
        title={mentionTitle}
      >
        <Plus size={10} aria-hidden />
      </button>
    </div>
  );
});
