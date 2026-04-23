/**
 * DateNavigator — bande de navigation par date ultra user-friendly.
 *
 * Affiche les 7 jours de la semaine courante avec :
 *  • Navigation semaine précédente / suivante (◀ ▶)
 *  • Aujourd'hui mis en évidence (ring + pulse si non sélectionné)
 *  • Jour sélectionné en plein (bg indigo)
 *  • Badge optionnel par jour (nombre de RDV / entrées)
 *  • Bouton "Aujourd'hui" pour revenir rapidement
 *  • Input date natif caché pour sauter directement à une date
 */
import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { fr } from 'date-fns/locale';
import {
    addDays, addWeeks, subWeeks, startOfWeek, format, isToday, isSameDay,
} from 'date-fns';

interface DateNavigatorProps {
    selectedDate:    Date;
    onDateChange:    (d: Date) => void;
    /** Clés : 'yyyy-MM-dd' → nombre d'entrées (badge orange) */
    counts?:         Record<string, number>;
    /** Variante compacte (moins d'espace vertical) */
    compact?:        boolean;
    /** Si true, indique en bas que la date est hors-aujourd'hui (mode lecture) */
    showReadonlyBanner?: boolean;
}

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const DateNavigator: React.FC<DateNavigatorProps> = ({
    selectedDate,
    onDateChange,
    counts = {},
    compact = false,
    showReadonlyBanner = false,
}) => {
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Semaine courante (lundi → dimanche)
    const weekStart  = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays   = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const prevWeek = () => onDateChange(subWeeks(selectedDate, 1));
    const nextWeek = () => onDateChange(addWeeks(selectedDate, 1));
    const goToday  = () => onDateChange(new Date());

    const isSelected = (d: Date) => isSameDay(d, selectedDate);
    const todaySelected = isToday(selectedDate);

    return (
        <div className="space-y-2">
            <div className={`flex items-center gap-2 bg-white border border-slate-200 rounded-xl shadow-sm ${compact ? 'p-2' : 'p-3'}`}>

                {/* ◀ Semaine précédente */}
                <button
                    onClick={prevWeek}
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    title="Semaine précédente"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* 7 jours */}
                <div className="flex-1 grid grid-cols-7 gap-1 min-w-0">
                    {weekDays.map((day, idx) => {
                        const key     = format(day, 'yyyy-MM-dd');
                        const count   = counts[key] ?? 0;
                        const sel     = isSelected(day);
                        const tod     = isToday(day);
                        const past    = day < new Date(new Date().toDateString()); // jour passé (pas aujourd'hui)

                        return (
                            <button
                                key={key}
                                onClick={() => onDateChange(day)}
                                className={`
                                    relative flex flex-col items-center justify-center rounded-xl
                                    ${compact ? 'py-1.5 px-1' : 'py-2 px-1'}
                                    transition-all duration-150 select-none
                                    ${sel
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : tod
                                            ? 'ring-2 ring-indigo-400 ring-offset-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                                            : past
                                                ? 'text-slate-400 hover:bg-slate-50'
                                                : 'text-slate-700 hover:bg-slate-100'
                                    }
                                `}
                                title={format(day, 'EEEE d MMMM yyyy', { locale: fr })}
                            >
                                {/* Lettre du jour */}
                                <span className={`text-[10px] font-semibold uppercase tracking-wider leading-none mb-1 ${
                                    sel ? 'text-indigo-100' : tod ? 'text-indigo-500' : past ? 'text-slate-400' : 'text-slate-400'
                                }`}>
                                    {DAY_LETTERS[idx]}
                                </span>

                                {/* Numéro du jour */}
                                <span className={`${compact ? 'text-sm' : 'text-base'} font-bold leading-none`}>
                                    {format(day, 'd')}
                                </span>

                                {/* Badge count */}
                                {count > 0 && (
                                    <span className={`
                                        absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center
                                        rounded-full text-[9px] font-bold leading-none px-0.5
                                        ${sel ? 'bg-white text-indigo-700' : 'bg-orange-500 text-white'}
                                    `}>
                                        {count > 9 ? '9+' : count}
                                    </span>
                                )}

                                {/* Indicateur "aujourd'hui" sous le numéro */}
                                {tod && !sel && (
                                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ▶ Semaine suivante */}
                <button
                    onClick={nextWeek}
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    title="Semaine suivante"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>

                {/* Séparateur */}
                <div className="flex-shrink-0 w-px h-8 bg-slate-200" />

                {/* Aujourd'hui */}
                <button
                    onClick={goToday}
                    className={`
                        flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${todaySelected
                            ? 'bg-indigo-600 text-white cursor-default'
                            : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                        }
                    `}
                    disabled={todaySelected}
                    title="Revenir à aujourd'hui"
                >
                    Auj.
                </button>

                {/* Saut rapide (input date caché) */}
                <button
                    onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700 transition-colors"
                    title="Choisir une date"
                >
                    <CalendarDays className="w-4 h-4" />
                </button>
                <input
                    ref={dateInputRef}
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={e => {
                        const d = new Date(e.target.value + 'T12:00:00');
                        if (!isNaN(d.getTime())) onDateChange(d);
                    }}
                    className="sr-only"
                    aria-label="Choisir une date"
                />
            </div>

            {/* Bannière mode lecture (date ≠ aujourd'hui) */}
            {showReadonlyBanner && !todaySelected && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                        Vue historique du{' '}
                        <strong>{format(selectedDate, 'EEEE d MMMM', { locale: fr })}</strong>
                        {selectedDate > new Date() ? ' (futur)' : ''} — modifications désactivées.
                    </span>
                    <button
                        onClick={goToday}
                        className="ml-auto font-semibold underline hover:no-underline"
                    >
                        Revenir à aujourd'hui
                    </button>
                </div>
            )}
        </div>
    );
};

export default DateNavigator;
