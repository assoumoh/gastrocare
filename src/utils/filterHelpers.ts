/**
 * Helpers partagés pour les filtres de période rapide (7j, 30j, 3 mois, 1 an, custom).
 */

export type PeriodId = 'all' | '7d' | '30d' | '90d' | '365d' | 'custom';

export interface PeriodRange {
    start: string | null;
    end:   string | null;
}

export function getPeriodRange(
    period: PeriodId,
    customStart?: string,
    customEnd?: string,
): PeriodRange {
    if (period === 'all')     return { start: null, end: null };
    if (period === 'custom')  return { start: customStart || null, end: customEnd || null };

    const days: Record<Exclude<PeriodId, 'all' | 'custom'>, number> = {
        '7d':   7,
        '30d':  30,
        '90d':  90,
        '365d': 365,
    };
    const nb      = days[period];
    const end     = new Date();
    const start   = new Date();
    start.setDate(start.getDate() - nb);

    return {
        start: start.toISOString().split('T')[0],
        end:   end.toISOString().split('T')[0],
    };
}

export function matchPeriod(
    dateStr: string | undefined | null,
    period: PeriodId,
    customStart?: string,
    customEnd?: string,
): boolean {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const { start, end } = getPeriodRange(period, customStart, customEnd);
    if (start && dateStr < start) return false;
    if (end   && dateStr > end)   return false;
    return true;
}
