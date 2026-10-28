export const Permission = {
  CreateSpaces: "spaces:create",
  ViewSpaces: "spaces:view",
  ManageSpaces: "spaces:manage",
  ManageSpaceMembers: "spaces:members:manage",
  ManageSpaceGroups: "spaces:groups:manage",
  TransferSpaceOwnership: "spaces:ownership:transfer",
  DeleteSpaces: "spaces:delete",
  ViewFAQInsights: "faq:insights:view",
  DeleteFAQQuestions: "faq:questions:delete",
  DeleteFAQAnswers: "faq:answers:delete",
  PinFAQAnswers: "faq:answers:pin",
  RecommendFAQAnswers: "faq:answers:recommend",
  ViewAppDrafts: "apps:drafts:view",
  EditApps: "apps:edit",
  DeleteApps: "apps:delete",
  ViewAppHealth: "apps:health:view",
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

export function hasPermission(
  role: string | null | undefined,
  permission: PermissionName,
  grantedPermissions?: readonly string[],
): boolean {
  const normalizedRole = role?.trim().toLowerCase();
  if (normalizedRole === "admin") return true;
  return grantedPermissions?.includes(permission) === true;
}

export function canOverseeSpaces(
  role: string | undefined,
  grantedPermissions?: readonly string[],
): boolean {
  return [
    Permission.ViewSpaces,
    Permission.ManageSpaces,
    Permission.ManageSpaceMembers,
    Permission.ManageSpaceGroups,
    Permission.TransferSpaceOwnership,
    Permission.DeleteSpaces,
  ].some((permission) => hasPermission(role, permission, grantedPermissions));
}
