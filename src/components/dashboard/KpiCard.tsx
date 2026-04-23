import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
    label:   string;
    value:   string | number;
    icon:    React.ReactNode;
    /** Série de 7 valeurs (jour J-6 → J) pour la sparkline. */
    series?: number[];
    /** Valeur moyenne de référence (comparaison J vs moyenne 7j). */
    comparison?: {
        current:   number;
        reference: number;
        suffix?:   string; // ex: '' ou '%'
    };
    /** Sous-titre secondaire (ex: "4 impayés") */
    subtitle?:     string;
    subtitleColor?: 'red' | 'amber' | 'slate' | 'emerald';
    accent:        'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'purple';
    href?:         string;
    onClick?:      () => void;
}

const ACCENT: Record<KpiCardProps['accent'], { bg: string; text: string; stroke: string; fill: string }> = {
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  stroke: '#4f46e5', fill: 'rgba(79, 70, 229, 0.12)'  },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', stroke: '#059669', fill: 'rgba(5, 150, 105, 0.12)'  },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.12)'  },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    stroke: '#e11d48', fill: 'rgba(225, 29, 72, 0.12)'  },
    sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     stroke: '#0284c7', fill: 'rgba(2, 132, 199, 0.12)'  },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.12)' },
};

function Sparkline({ data, stroke, fill }: { data: number[]; stroke: string; fill: string }) {
    if (!data || data.length === 0) return null;
    const w = 100, h = 28;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = data.length > 1 ? w / (data.length - 1) : 0;
    const pts = data.map((v, i) => {
        const x = i * step;
        const y = h - ((v - min) / range) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const area = `0,${h} ${pts} ${w},${h}`;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none">
            <polygon points={area} fill={fill} />
            <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            {/* Dernier point mis en évidence */}
            {data.length > 0 && (
                (() => {
                    const lastX = (data.length - 1) * step;
                    const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
                    return <circle cx={lastX} cy={lastY} r="2" fill={stroke} />;
                })()
            )}
        </svg>
    );
}

function Trend({ current, reference, suffix = '' }: { current: number; reference: number; suffix?: string }) {
    const diff = current - reference;
    const pct  = reference > 0 ? Math.round((diff / reference) * 100) : 0;
    if (Math.abs(diff) < 0.01) {
        return (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500">
                <Minus className="w-3 h-3" /> stable
            </span>
        );
    }
    const positive = diff > 0;
    const Icon = positive ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
            <Icon className="w-3 h-3" />
            {positive ? '+' : ''}{reference > 0 ? pct + '%' : (diff > 0 ? '+' : '') + diff.toFixed(0)}{suffix}
            <span className="text-slate-400 font-normal ml-0.5">vs moy.</span>
        </span>
    );
}

const KpiCard: React.FC<KpiCardProps> = ({
    label, value, icon, series, comparison, subtitle, subtitleColor = 'slate', accent, href, onClick,
}) => {
    const a = ACCENT[accent];
    const content = (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow group h-full flex flex-col">
            <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${a.bg} ${a.text}`}>{icon}</div>
                {comparison && <Trend {...comparison} />}
            </div>
            <div className="mb-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl sm:text-3xl font-bold ${a.text} leading-tight mt-0.5`}>{value}</p>
            </div>
            {subtitle && (
                <p className={`text-xs font-medium ${
                    subtitleColor === 'red'     ? 'text-rose-600' :
                    subtitleColor === 'amber'   ? 'text-amber-600' :
                    subtitleColor === 'emerald' ? 'text-emerald-600' :
                                                  'text-slate-500'
                }`}>
                    {subtitle}
                </p>
            )}
            {series && series.length > 0 && (
                <div className="mt-auto pt-2 opacity-90 group-hover:opacity-100 transition-opacity">
                    <Sparkline data={series} stroke={a.stroke} fill={a.fill} />
                </div>
            )}
        </div>
    );

    if (href) {
        return <a href={href} className="block">{content}</a>;
    }
    if (onClick) {
        return <button onClick={onClick} className="block w-full text-left">{content}</button>;
    }
    return content;
};

export default KpiCard;
