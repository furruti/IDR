export function exportJson(value: unknown): string { return JSON.stringify(value, null, 2); }
export function importJson<T>(text: string): T { return JSON.parse(text) as T; }
