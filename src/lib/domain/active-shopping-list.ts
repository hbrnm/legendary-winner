export interface ActiveListCandidate {
  id: string;
  pending: number;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}
export function selectActiveList(lists: ActiveListCandidate[], preferredId: string | null): string | null {
  const available = lists.filter(l => !l.archived_at && !l.deleted_at);
  if (available.some(l => l.id === preferredId)) return preferredId;
  return [...available].sort((a,b) => b.pending-a.pending || b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))[0]?.id ?? null;
}
