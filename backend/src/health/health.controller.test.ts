import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';
describe('HealthController', () => { it('devuelve estado ok', () => { const res = new HealthController().getHealth(); expect(res.status).toBe('ok'); expect(res.service).toBe('idr-backend'); expect(new Date(res.timestamp).toString()).not.toBe('Invalid Date'); }); });
