export type GistFileMap = Record<string, { content: string }>;
export type GistPayload = { files: GistFileMap };
export function buildGistPayload(fileName: string, content: unknown): GistPayload {
  return { files: { [fileName]: { content: JSON.stringify(content, null, 2) } } };
}
