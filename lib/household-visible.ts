const storageKey = (userKey: string) => `plango_household_visible_${userKey}`;

export function loadVisibleHousehold(userKey: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'string') : null;
  } catch {
    return null;
  }
}

export function saveVisibleHousehold(userKey: string, names: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(userKey), JSON.stringify(names));
}

export function resolveVisibleHousehold(familyNames: string[], stored: string[] | null): string[] {
  const uniqueFamily = [...new Set(familyNames)];
  if (!uniqueFamily.length) return [];
  const valid = [...new Set((stored ?? []).filter((n) => uniqueFamily.includes(n)))];
  return valid.length ? valid : [uniqueFamily[0]];
}
