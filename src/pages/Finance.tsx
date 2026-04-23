import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    DollarSign, TrendingUp, TrendingDown, AlertCircle, CreditCard,
    Users, BarChart2, CheckCircle, Clock, ChevronRight, Search, X
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from 'recharts';
import { Link } from 'react-router-dom';

// ─── Constantes ───────────────────────────────────────────────────────────────
const COLORS     = ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899'];
const PAID_SET   = new Set(['payé', 'paye', 'réglé', 'regle']);
const UNPAID_SET = new Set(['non payé', 'non_paye', 'en_attente', 'en attente']);

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
    day:     'Aujourd\'hui',
    week:    '7 jours',
    month:   'Ce mois',
    quarter: 'Ce trimestre',
    year:    'Cette année',
};

const fmtMAD = (n: number) =>
    new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(n) + ' MAD';

const pct = (a: number, b: number) =>
    b === 0 ? null : Math.round((a / b) * 100);

// ─── Tooltip custom ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
            <p className="font-semibold text-slate-800 mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color }} className="font-medium">
                    {p.name} : {typeof p.value === 'number' ? fmtMAD(p.value) : p.value}
                </p>
            ))}
        </div>
    );
};

// ─── Composant KPI card ───────────────────────────────────────────────────────
const FinKpi = ({
    label, value, sub, icon, accent, trend,
}: {
    label: string; value: string; sub?: string; icon: React.ReactNode;
    accent: 'emerald' | 'rose' | 'indigo' | 'amber' | 'sky';
    trend?: { value: number; label: string };
}) => {
    const cls: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-700',
        rose:    'bg-rose-50 text-rose-700',
        indigo:  'bg-indigo-50 text-indigo-700',
        amber:   'bg-amber-50 text-amber-700',
        sky:     'bg-sky-50 text-sky-700',
    };
    const textCls: Record<string, string> = {
        emerald: 'text-emerald-700', rose: 'text-rose-700', indigo: 'text-indigo-700',
        amber: 'text-amber-700', sky: 'text-sky-700',
    };
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${cls[accent]}`}>{icon}</div>
                {trend && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
                    </span>
                )}
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${textCls[accent]}`}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
    );
};

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Finance() {
    const [payments,  setPayments]  = useState<any[]>([]);
    const [patients,  setPatients]  = useState<Record<string, any>>({});
    const [loading,   setLoading]   = useState(true);
    const [period,    setPeriod]    = useState<Period>('month');
    const [search,    setSearch]    = useState('');
    const [page,      setPage]      = useState(1);
    const PAGE_SIZE = 15;

    // Fetch
    useEffect(() => {
        const unsubPay = onSnapshot(
            query(collection(db, 'payments'), orderBy('date_paiement', 'desc')),
            snap => { setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
            () => setLoading(false)
        );
        const unsubPat = onSnapshot(collection(db, 'patients'), snap => {
            const map: Record<string, any> = {};
            snap.docs.forEach(d => { map[d.id] = d.data(); });
            setPatients(map);
        });
        return () => { unsubPay(); unsubPat(); };
    }, []);

    // Plage de la période courante
    const { startCur, endCur, startPrev, endPrev } = useMemo(() => {
        const now = new Date();
        let sc: Date, ec: Date, sp: Date, ep: Date;
        if (period === 'day') {
            sc = new Date(format(now, 'yyyy-MM-dd') + 'T00:00:00');
            ec = new Date(format(now, 'yyyy-MM-dd') + 'T23:59:59');
            sp = new Date(format(new Date(now.getTime() - 86400000), 'yyyy-MM-dd') + 'T00:00:00');
            ep = new Date(format(new Date(now.getTime() - 86400000), 'yyyy-MM-dd') + 'T23:59:59');
        } else if (period === 'week') {
            sc = startOfWeek(now, { weekStartsOn: 1 });
            ec = new Date();
            sp = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
            ep = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        } else if (period === 'month') {
            sc = startOfMonth(now);
            ec = new Date();
            sp = startOfMonth(subMonths(now, 1));
            ep = endOfMonth(subMonths(now, 1));
        } else if (period === 'quarter') {
            sc = startOfMonth(subMonths(now, 2));
            ec = new Date();
            sp = startOfMonth(subMonths(now, 5));
            ep = endOfMonth(subMonths(now, 3));
        } else { // year
            sc = new Date(now.getFullYear(), 0, 1);
            ec = new Date();
            sp = new Date(now.getFullYear() - 1, 0, 1);
            ep = new Date(now.getFullYear() - 1, 11, 31);
        }
        return { startCur: sc, endCur: ec, startPrev: sp, endPrev: ep };
    }, [period]);

    const inRange = (p: any, start: Date, end: Date) => {
        const d = new Date(p.date_paiement || p.created_at || '');
        return d >= start && d <= end;
    };

    const curPay  = useMemo(() => payments.filter(p => inRange(p, startCur, endCur)),  [payments, startCur, endCur]);
    const prevPay = useMemo(() => payments.filter(p => inRange(p, startPrev, endPrev)), [payments, startPrev, endPrev]);

    // KPIs
    const kpi = useMemo(() => {
        const encaisse    = (arr: any[]) => arr.filter(p => PAID_SET.has((p.statut_paiement||'').toLowerCase())).reduce((s,p) => s + (Number(p.montant)||0), 0);
        const impayeAmt   = (arr: any[]) => arr.filter(p => UNPAID_SET.has((p.statut_paiement||'').toLowerCase())).reduce((s,p) => s + (Number(p.montant)||0), 0);
        const nbPaid      = (arr: any[]) => arr.filter(p => PAID_SET.has((p.statut_paiement||'').toLowerCase())).length;

        const caCur   = encaisse(curPay);
        const caPrev  = encaisse(prevPay);
        const impCur  = impayeAmt(curPay);
        const nbCur   = nbPaid(curPay);
        const total   = caCur + impCur;
        const taux    = total > 0 ? Math.round((caCur / total) * 100) : 0;
        const panier  = nbCur > 0 ? caCur / nbCur : 0;
        const trendCA = caPrev > 0 ? Math.round(((caCur - caPrev) / caPrev) * 100) : 0;

        return { caCur, caPrev, impCur, nbCur, taux, panier, trendCA, total };
    }, [curPay, prevPay]);

    // Top patients par CA
    const topPatients = useMemo(() => {
        const map: Record<string, number> = {};
        curPay.filter(p => PAID_SET.has((p.statut_paiement||'').toLowerCase())).forEach(p => {
            if (p.patient_id) map[p.patient_id] = (map[p.patient_id] || 0) + (Number(p.montant) || 0);
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, ca]) => ({ id, ca, patient: patients[id] }));
    }, [curPay, patients]);

    // Répartition modes
    const modeData = useMemo(() => {
        const map: Record<string, number> = {};
        curPay.filter(p => PAID_SET.has((p.statut_paiement||'').toLowerCase())).forEach(p => {
            const m = p.mode_paiement || 'Inconnu';
            map[m] = (map[m] || 0) + (Number(p.montant) || 0);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [curPay]);

    // Évolution CA (barres quotidiennes ou mensuelles)
    const evolutionData = useMemo(() => {
        const grouped: Record<string, { ca: number; nb: number }> = {};
        const paid = payments.filter(p => PAID_SET.has((p.statut_paiement||'').toLowerCase()));
        const useMonth = period === 'year' || period === 'quarter';
        paid.forEach(p => {
            const d = new Date(p.date_paiement || p.created_at || '');
            if (!inRange(p, startCur, endCur) && !inRange(p, startPrev, endPrev)) return;
            const key = useMonth ? format(d, 'MMM yy', { locale: fr }) : format(d, 'dd/MM');
            if (!grouped[key]) grouped[key] = { ca: 0, nb: 0 };
            grouped[key].ca += Number(p.montant) || 0;
            grouped[key].nb++;
        });
        return Object.entries(grouped).map(([date, v]) => ({ date, ...v }));
    }, [payments, startCur, endCur, startPrev, endPrev, period]);

    // Répartition statuts
    const statutData = useMemo(() => {
        const map: Record<string, number> = {};
        curPay.forEach(p => {
            const s = p.statut_paiement || 'inconnu';
            map[s] = (map[s] || 0) + (Number(p.montant) || 0);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [curPay]);

    // Table filtrée + paginée
    const tableRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return curPay.filter(p => {
            if (!q) return true;
            const pt = patients[p.patient_id];
            const name = pt ? `${pt.nom} ${pt.prenom}`.toLowerCase() : '';
            return name.includes(q) || (p.mode_paiement || '').toLowerCase().includes(q)
                || (p.type_paiement || '').toLowerCase().includes(q);
        });
    }, [curPay, patients, search]);

    const totalPages = Math.ceil(tableRows.length / PAGE_SIZE);
    const paginated  = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (loading) return <div className="text-center py-20 text-slate-400">Chargement…</div>;

    const STAT_COLORS: Record<string, string> = {
        'payé': 'bg-emerald-100 text-emerald-800', 'réglé': 'bg-emerald-100 text-emerald-800',
        'non payé': 'bg-rose-100 text-rose-800', 'en_attente': 'bg-amber-100 text-amber-800',
        'en attente': 'bg-amber-100 text-amber-800', 'partiel': 'bg-sky-100 text-sky-800',
    };

    return (
        <div className="space-y-7 pb-12">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Finance</h1>
                    <p className="text-sm text-slate-500 mt-0.5 capitalize">
                        {period === 'month'
                            ? format(new Date(), 'MMMM yyyy', { locale: fr })
                            : PERIOD_LABELS[period]}
                    </p>
                </div>
                {/* Chips de période */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => { setPeriod(p); setPage(1); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                period === p
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                            }`}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                    <Link
                        to="/payments"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    >
                        Gérer les paiements <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* ── KPIs ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                <FinKpi
                    label="CA encaissé"
                    value={fmtMAD(kpi.caCur)}
                    sub={kpi.caPrev > 0 ? `Période préc. : ${fmtMAD(kpi.caPrev)}` : undefined}
                    icon={<DollarSign className="w-5 h-5" />}
                    accent="emerald"
                    trend={kpi.caPrev > 0 ? { value: kpi.trendCA, label: 'vs préc.' } : undefined}
                />
                <FinKpi
                    label="Impayés"
                    value={fmtMAD(kpi.impCur)}
                    sub={kpi.total > 0 ? `${100 - kpi.taux}% du total` : undefined}
                    icon={<AlertCircle className="w-5 h-5" />}
                    accent={kpi.impCur > 0 ? 'rose' : 'emerald'}
                />
                <FinKpi
                    label="Taux de recouvrement"
                    value={`${kpi.taux} %`}
                    sub={`${kpi.nbCur} paiement${kpi.nbCur > 1 ? 's' : ''} encaissé${kpi.nbCur > 1 ? 's' : ''}`}
                    icon={<CheckCircle className="w-5 h-5" />}
                    accent={kpi.taux >= 80 ? 'emerald' : kpi.taux >= 60 ? 'amber' : 'rose'}
                />
                <FinKpi
                    label="Panier moyen"
                    value={fmtMAD(kpi.panier)}
                    sub="Par consultation encaissée"
                    icon={<CreditCard className="w-5 h-5" />}
                    accent="indigo"
                />
                <FinKpi
                    label="Transactions"
                    value={String(curPay.length)}
                    sub={`Dont ${kpi.nbCur} réglées`}
                    icon={<BarChart2 className="w-5 h-5" />}
                    accent="sky"
                />
            </div>

            {/* ── Graphiques : évolution + modes + statuts ───────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Évolution CA */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Évolution du CA</h2>
                        <span className="text-xs text-slate-400">{PERIOD_LABELS[period]}</span>
                    </div>
                    {evolutionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={evolutionData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                                <defs>
                                    <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="ca" name="CA" stroke="#4f46e5" strokeWidth={2} fill="url(#gradCA)" dot={false} activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                            Aucune donnée pour cette période.
                        </div>
                    )}
                </div>

                {/* Donut modes de paiement */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-4">Modes de paiement</h2>
                    {modeData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={modeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                                        {modeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => fmtMAD(v)} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)', fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-2 space-y-1.5">
                                {modeData.map((d, i) => (
                                    <div key={d.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-slate-600 capitalize">{d.name}</span>
                                        </div>
                                        <span className="font-semibold text-slate-800">{fmtMAD(d.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">Aucune donnée.</div>
                    )}
                </div>
            </div>

            {/* ── Top patients + statuts ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Top 5 patients par CA */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        Top 5 patients — CA encaissé
                    </h2>
                    {topPatients.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">Aucune donnée</p>
                    ) : (
                        <ul className="space-y-3">
                            {topPatients.map(({ id, ca, patient }, idx) => {
                                const maxCA = topPatients[0]?.ca || 1;
                                return (
                                    <li key={id} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-slate-400 w-4 flex-shrink-0">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between mb-1">
                                                <Link to={`/patients/${id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-700 truncate">
                                                    {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                                                </Link>
                                                <span className="text-sm font-bold text-emerald-700 flex-shrink-0 ml-2">{fmtMAD(ca)}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-indigo-500 h-1.5 rounded-full transition-all"
                                                    style={{ width: `${Math.round((ca / maxCA) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Répartition statuts */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        Répartition par statut
                    </h2>
                    {statutData.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">Aucune donnée</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={statutData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" name="Montant" radius={[0, 6, 6, 0]} maxBarSize={24}>
                                    {statutData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Table des transactions ──────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                        Transactions — {tableRows.length} paiement{tableRows.length > 1 ? 's' : ''}
                    </h2>
                    {/* Recherche */}
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Rechercher patient, mode…"
                            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {search && (
                            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mode</th>
                                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Montant</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginated.map(p => {
                                const pt = patients[p.patient_id];
                                const isPaid = PAID_SET.has((p.statut_paiement||'').toLowerCase());
                                const statCls = STAT_COLORS[p.statut_paiement] || 'bg-slate-100 text-slate-700';
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                                            {p.date_paiement ? new Date(p.date_paiement).toLocaleDateString('fr-FR') : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-medium">
                                            {pt ? (
                                                <Link to={`/patients/${p.patient_id}`} className="text-indigo-700 hover:underline">
                                                    {pt.nom} {pt.prenom}
                                                </Link>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-600 capitalize">
                                            {p.type_paiement || 'Consultation'}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-600 capitalize">
                                            {p.mode_paiement || '—'}
                                        </td>
                                        <td className={`px-5 py-3.5 text-sm font-bold text-right whitespace-nowrap ${isPaid ? 'text-emerald-700' : 'text-rose-600'}`}>
                                            {fmtMAD(Number(p.montant) || 0)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statCls}`}>
                                                {p.statut_paiement || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                                        Aucun paiement trouvé.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                            Page {page} / {totalPages} · {tableRows.length} transactions
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                            >
                                ← Préc.
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                            >
                                Suiv. →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
