export type PermissionSnapshot = {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
};

export function normalizePermissionState(response: PermissionSnapshot) {
  if (response.granted) return 'allowed' as const;
  if (response.status === 'undetermined') return 'undetermined' as const;
  return response.canAskAgain ? ('denied' as const) : ('blocked' as const);
}
