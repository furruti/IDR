import { describe, expect, it } from 'vitest';
import { exportJson, importJson } from './json';
describe('json import/export', () => { it('mantiene estructura JSON', () => { const data={a:1}; expect(importJson(exportJson(data))).toEqual(data); }); });
