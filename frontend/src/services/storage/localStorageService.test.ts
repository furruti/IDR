import { describe, expect, it, beforeEach } from 'vitest';
import { readJson, writeJson } from './localStorageService';
describe('localStorageService', () => { beforeEach(() => localStorage.clear()); it('lee fallback y escribe JSON compatible', () => { expect(readJson('RCK_data', [])).toEqual([]); writeJson('RCK_data', [{ id: 1 }]); expect(readJson('RCK_data', [])).toEqual([{ id: 1 }]); }); });
