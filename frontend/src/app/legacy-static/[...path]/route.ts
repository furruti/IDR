import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.py': 'text/x-python; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  const requestedPath = params.path.join('/');
  const legacyRoot = path.join(process.cwd(), '..', 'legacy', 'frontend-vanilla');
  const resolvedPath = path.resolve(legacyRoot, requestedPath);

  if (!resolvedPath.startsWith(path.resolve(legacyRoot))) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const file = await readFile(resolvedPath);
    const contentType = MIME_TYPES[path.extname(resolvedPath).toLowerCase()] ?? 'application/octet-stream';
    return new Response(file, { headers: { 'content-type': contentType } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
