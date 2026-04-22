import React from 'react';
import { Search, X, Calendar, SlidersHorizontal } from 'lucide-react';
import type { PeriodId } from '../../utils/filterHelpers';

export interface ChipOption {
    id:    string;
    label: string;
    count?: number;
    color?: 'indigo' | 'amber' | 'green' | 'blue' | 'purple' | 'rose' | 'slate';
}

export interface ChipGroup {
    key:     string;
    label:   string;
    options: ChipOption[];
    active:  string; // chip id, or 'all'
    onChange: (id: string) => void;
}

interface SmartFilterBarProps {
    // Search (optional)
    search?:            string;
    onSearchChange?:    (v: string) => void;
    searchPlaceholder?: string;

    // Period (always shown)
    period:               PeriodId;
    onPeriodChange:       (p: PeriodId) => void;
    customStart:          string;
    customEnd:            string;
    onCustomStartChange:  (v: string) => void;
    onCustomEndChange:    (v: string) => void;

    // Additional chip groups (type, statut, …)
    chipGroups?: ChipGroup[];

    // Counters
    totalCount:    number;
    filteredCount: number;
    itemLabel?:    string;          // "consultation", "examen", "ordonnance"
    itemLabelPlural?: string;       // override si différent du simple +s

    // Reset
    hasActiveFilters: boolean;
    onReset:          () => void;
}

const PERIODS: Array<{ id: PeriodId; label: string; title: string }> = [
    { id: 'all',    label: 'Tout',    title: 'Tous les enregistrements' },
    { id: '7d',     label: '7 j',     title: '7 derniers jours' },
    { id: '30d',    label: '30 j',    title: '30 derniers jours' },
    { id: '90d',    label: '3 mois',  title: '3 derniers mois' },
    { id: '365d',   label: '1 an',    title: '12 derniers mois' },
    { id: 'custom', label: 'Perso',   title: 'Plage personnalisée' },
];

const COLOR_ACTIVE: Record<NonNullable<ChipOption['color']>, string> = {
    indigo: 'bg-indigo-600 text-white border-indigo-600',
    amber:  'bg-amber-500 text-white border-amber-500',
    green:  'bg-emerald-600 text-white border-emerald-600',
    blue:   'bg-sky-600 text-white border-sky-600',
    purple: 'bg-purple-600 text-white border-purple-600',
    rose:   'bg-rose-600 text-white border-rose-600',
    slate:  'bg-slate-700 text-white border-slate-700',
};

const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
    search, onSearchChange, searchPlaceholder = 'Rechercher…',
    period, onPeriodChange, customStart, customEnd, onCustomStartChange, onCustomEndChange,
    chipGroups = [],
    totalCount, filteredCount, itemLabel = 'élément', itemLabelPlural,
    hasActiveFilters, onReset,
}) => {
    const hasSearch = typeof onSearchChange === 'function';
    const plural    = itemLabelPlural || (itemLabel + (totalCount > 1 ? 's' : ''));
    const singular  = totalCount > 1 ? plural : itemLabel;

    return (
        <div className="sticky top-0 z-10 -mx-1 px-1">
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm p-3 space-y-2.5">

                {/* Row 1 : search + period chips + counter */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">

                    {/* Search */}
                    {hasSearch && (
                        <div className="relative flex-1 min-w-0 lg:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={search || ''}
                                onChange={e => onSearchChange!(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 transition-colors"
                            />
                            {search && (
                                <button
                                    onClick={() => onSearchChange!('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                                    title="Effacer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Period chips */}
                    <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                        <Calendar className="w-4 h-4 text-slate-400 mr-0.5 flex-shrink-0" />
                        {PERIODS.map(p => {
                            const active = period === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => onPeriodChange(p.id)}
                                    title={p.title}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                        active
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Counter + reset (droit) */}
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <span className="text-slate-500">
                            {hasActiveFilters ? (
                                <>
                                    <span className="font-semibold text-indigo-700">{filteredCount}</span>
                                    <span className="text-slate-400"> / </span>
                                    <span>{totalCount}</span>
                                </>
                            ) : (
                                <span className="font-semibold text-slate-700">{totalCount}</span>
                            )}
                            <span className="ml-1">{singular}</span>
                        </span>
                        {hasActiveFilters && (
                            <button
                                onClick={onReset}
                                className="inline-flex items-center gap-1 px-2 py-1 text-indigo-600 hover:text-indigo-800 font-medium rounded hover:bg-indigo-50 transition-colors"
                                title="Réinitialiser tous les filtres"
                            >
                                <X className="w-3.5 h-3.5" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 2 : plage custom (si period=custom) */}
                {period === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 pl-1 animate-in fade-in duration-200">
                        <span className="text-xs text-slate-500">Du</span>
                        <input
                            type="date"
                            value={customStart}
                            onChange={e => onCustomStartChange(e.target.value)}
                            className="px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-500">au</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={e => onCustomEndChange(e.target.value)}
                            className="px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                )}

                {/* Rows 3+ : chip groups (type, statut, …) */}
                {chipGroups.map(group => (
                    <div key={group.key} className="flex items-start gap-2 flex-wrap pt-0.5">
                        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{group.label}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                            <button
                                onClick={() => group.onChange('all')}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                    group.active === 'all'
                                        ? 'bg-slate-700 text-white border-slate-700'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                }`}
                            >
                                Tous
                            </button>
                            {group.options.map(opt => {
                                const active    = group.active === opt.id;
                                const colorKey  = opt.color || 'indigo';
                                const activeCls = COLOR_ACTIVE[colorKey];
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => group.onChange(opt.id)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                            active
                                                ? activeCls + ' shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50'
                                        }`}
                                    >
                                        {opt.label}
                                        {opt.count !== undefined && (
                                            <span className={`px-1 rounded text-[10px] leading-tight ${
                                                active ? 'bg-white/25' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {opt.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SmartFilterBar;
