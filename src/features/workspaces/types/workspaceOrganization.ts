export type WorkspaceSidebarOrganizationAction =
  | {
      kind: "reorder";
      sourceWorkspaceId: string;
      targetWorkspaceId: string;
      position: "before" | "after";
    }
  | {
      kind: "move-to-group";
      sourceWorkspaceId: string;
      targetGroupId: string;
    }
  | {
      kind: "move-to-ungrouped";
      sourceWorkspaceId: string;
    }
  | {
      kind: "create-group";
      sourceWorkspaceId: string;
      targetWorkspaceId: string;
      groupName: string;
    };
