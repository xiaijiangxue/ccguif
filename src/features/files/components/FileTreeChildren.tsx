import { useEffect, useState, type ReactNode } from "react";

type FileTreeChildrenProps = {
  isExpanded: boolean;
  children: ReactNode;
};

const FILE_TREE_CHILDREN_COLLAPSE_MS = 220;

export function FileTreeChildren({ isExpanded, children }: FileTreeChildrenProps) {
  const [renderedChildren, setRenderedChildren] = useState<ReactNode>(
    isExpanded ? children : null,
  );

  useEffect(() => {
    if (isExpanded) {
      setRenderedChildren(children);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setRenderedChildren(null);
    }, FILE_TREE_CHILDREN_COLLAPSE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [children, isExpanded]);

  return (
    <div className={`file-tree-children${isExpanded ? " is-tree-opening" : " is-tree-closing"}`}>
      {renderedChildren}
    </div>
  );
}
