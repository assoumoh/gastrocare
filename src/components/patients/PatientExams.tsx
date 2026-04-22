import React, { useState, useEffect, useMemo } from 'react';
import {
    collection, query, where, onSnapshot, orderBy,
    deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
    Plus, Edit, Trash2, FileText, DollarSign, Paperclip,
    Calendar, Clock, CheckCircle, FlaskConical, Printer,
    ChevronDown, ChevronUp
} from 'lucide-react';
import ExamForm from '../exams/ExamForm';
import DocumentForm from '../documents/DocumentForm';
import ExamRequestModal from '../salle-attente/ExamRequestModal';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { buildDocuments, printDocuments } from '../../utils/examPrint';
import SmartFilterBar from '../shared/SmartFilterBar';
import { matchPeriod, type PeriodId } from '../../utils/filterHelpers';

interface PatientExamsProps {
  patientId: string;
  patientName?: string;
}

const STATUS_COLORS: Record<string, string> = {
    demandé:              'bg-yellow-100 text-yellow-800',
    en_attente_resultat:  'bg-blue-100 text-blue-800',
    apporte:              'bg-purple-100 text-purple-800',
    analyse:              'bg-green-100 text-green-800',
};
const STATUS_LABELS: Record<string, string> = {
    demandé:              'Demandé',
    en_attente_resultat:  'En attente',
    apporte:              'Apporté',
    analyse:              'Analysé',
};

export default function PatientExams({ patientId, patientName = 'Patient' }: PatientExamsProps) {
    const [exams, setExams]                 = useState<any[]>([]);
    const [payments, setPayments]           = useState<any[]>([]);
    const [documents, setDocuments]         = useState<any[]>([]);
    const [loading, setLoading]             = useState(true);
    const [isFormOpen, setIsFormOpen]       = useState(false);
    const [isDocFormOpen, setIsDocFormOpen] = useState(false);
    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const [selectedExam, setSelectedExam]   = useState<any>(null);
    const [expandedDemandes, setExpandedDemandes] = useState<Set<string>>(new Set());

    // Smart filters
    const [search, setSearch]           = useState('');
    const [period, setPeriod]           = useState<PeriodId>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd]     = useState('');
    const [typeFilter, setTypeFilter]   = useState<string>('all');
    const [statutFilter, setStatutFilter] = useState<string>('all');

    const { appUser }  = useAuth();
    const { settings } = useSettings();

    // ── Chargement des examens ─────────────────────────────────────────────
    useEffect(() => {
        const qWithOrder = query(
            collection(db, 'exams'),
            where('patient_id', '==', patientId),
            orderBy('date_examen', 'desc')
        );
        const unsubscribe = onSnapshot(
            qWithOrder,
            (snap) => { setExams(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
            () => {
                const qFallback = query(collection(db, 'exams'), where('patient_id', '==', patientId));
                onSnapshot(qFallback, (snap) => {
                    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    data.sort((a: any, b: any) => (b.date_examen || '').localeCompare(a.date_examen || ''));
                    setExams(data);
                    setLoading(false);
                });
            }
        );
        return () => unsubscribe();
    }, [patientId]);

    useEffect(() => {
        const q = query(collection(db, 'payments'), where('patient_id', '==', patientId));
        return onSnapshot(q, snap => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [patientId]);

    useEffect(() => {
        const q = query(collection(db, 'documents'), where('patient_id', '==', patientId));
        return onSnapshot(q, snap => setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [patientId]);

    // ── Helpers ───────────────────────────────────────────────────────────
    const handleDeleteExam = async (id: string) => {
        if (!window.confirm('Supprimer cet examen ?')) return;
        try { await deleteDoc(doc(db, 'exams', id)); }
        catch { alert("Erreur lors de la suppression."); }
    };

    const handleDeleteDemande = async (demandeId: string, examIds: string[]) => {
        if (!window.confirm(`Supprimer toute cette demande (${examIds.length} examen${examIds.length > 1 ? 's' : ''}) ?`)) return;
        try {
            const batch = writeBatch(db);
            examIds.forEach(id => batch.delete(doc(db, 'exams', id)));
            await batch.commit();
        } catch { alert("Erreur lors de la suppression de la demande."); }
    };

    const toggleDemande = (demandeId: string) => {
        setExpandedDemandes(prev => {
            const next = new Set(prev);
            next.has(demandeId) ? next.delete(demandeId) : next.add(demandeId);
            return next;
        });
    };

    const handleReprint = (demandeExams: any[]) => {
        const docs = buildDocuments(demandeExams.map(e => ({
            type_examen: e.type_examen,
            nom_examen:  e.nom_examen,
            commentaire: e.commentaire || '',
        })));
        printDocuments(docs, patientName, settings);
    };

    // ── Comptages pour les chips ──────────────────────────────────────────
    const typeCounts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const e of exams) { const k = e.type_examen || 'Autre'; c[k] = (c[k] || 0) + 1; }
        return c;
    }, [exams]);
    const statutCounts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const e of exams) { const k = e.statut || e.statutExamen || 'demandé'; c[k] = (c[k] || 0) + 1; }
        return c;
    }, [exams]);

    // ── Filtrage intelligent ──────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return exams.filter(e => {
            const dateRef = e.date_examen || e.date_demande;
            if (!matchPeriod(dateRef, period, customStart, customEnd)) return false;
            if (typeFilter   !== 'all' && (e.type_examen || 'Autre') !== typeFilter) return false;
            if (statutFilter !== 'all' && (e.statut || e.statutExamen || 'demandé') !== statutFilter) return false;
            if (q) {
                const haystack = [
                    e.nom_examen, e.type_examen, e.commentaire, e.resultat_examen,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [exams, search, period, customStart, customEnd, typeFilter, statutFilter]);

    const hasActiveFilters = !!search || period !== 'all' || typeFilter !== 'all' || statutFilter !== 'all';
    const resetFilters = () => {
        setSearch(''); setPeriod('all'); setCustomStart(''); setCustomEnd('');
        setTypeFilter('all'); setStatutFilter('all');
    };

    // Exams avec demande_id → groupés, sans → affichage individuel
    const withDemande    = filtered.filter(e => e.demande_id);
    const withoutDemande = filtered.filter(e => !e.demande_id);

    // Grouper par demande_id
    const demandesMap = new Map<string, any[]>();
    for (const e of withDemande) {
        const list = demandesMap.get(e.demande_id) || [];
        list.push(e);
        demandesMap.set(e.demande_id, list);
    }
    // Trier les demandes par date décroissante (date du premier exam du groupe)
    const demandesSorted = Array.from(demandesMap.entries()).sort(([, a], [, b]) => {
        const dateA = a[0]?.date_demande || a[0]?.date_examen || '';
        const dateB = b[0]?.date_demande || b[0]?.date_examen || '';
        return dateB.localeCompare(dateA);
    });

    if (loading) return <div className="text-center py-4">Chargement des examens...</div>;

    return (
        <div className="space-y-4">
            <SmartFilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Rechercher nom d'examen, résultat, commentaire…"
                period={period}
                onPeriodChange={setPeriod}
                customStart={customStart}
                customEnd={customEnd}
                onCustomStartChange={setCustomStart}
                onCustomEndChange={setCustomEnd}
                chipGroups={[
                    {
                        key: 'type', label: 'Type', active: typeFilter, onChange: setTypeFilter,
                        options: [
                            { id: 'Biologie',    label: 'Biologie',    count: typeCounts['Biologie'],    color: 'indigo' },
                            { id: 'Imagerie',    label: 'Imagerie',    count: typeCounts['Imagerie'],    color: 'blue'   },
                            { id: 'Endoscopie',  label: 'Endoscopie',  count: typeCounts['Endoscopie'],  color: 'purple' },
                            { id: 'Fonctionnel', label: 'Fonctionnel', count: typeCounts['Fonctionnel'], color: 'amber'  },
                            { id: 'Anapath',     label: 'Anapath',     count: typeCounts['Anapath'],     color: 'rose'   },
                            { id: 'Autre',       label: 'Autre',       count: typeCounts['Autre'],       color: 'slate'  },
                        ].filter(o => o.count && o.count > 0),
                    },
                    {
                        key: 'statut', label: 'Statut', active: statutFilter, onChange: setStatutFilter,
                        options: [
                            { id: 'demandé',             label: 'Demandé',    count: statutCounts['demandé'],             color: 'amber' },
                            { id: 'en_attente_resultat', label: 'En attente', count: statutCounts['en_attente_resultat'], color: 'blue'  },
                            { id: 'apporte',             label: 'Apporté',    count: statutCounts['apporte'],             color: 'purple' },
                            { id: 'analyse',             label: 'Analysé',    count: statutCounts['analyse'],             color: 'green' },
                        ].filter(o => o.count && o.count > 0),
                    },
                ]}
                totalCount={exams.length}
                filteredCount={filtered.length}
                itemLabel="examen"
                hasActiveFilters={hasActiveFilters}
                onReset={resetFilters}
            />

            {/* Boutons d'action */}
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-lg font-medium text-slate-900">Examens du patient</h3>
                {appUser?.role !== 'assistante' && (
                    <div className="flex gap-2">
                        <button onClick={() => setIsRequestOpen(true)} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700">
                            <FlaskConical className="-ml-0.5 mr-2 h-4 w-4" />Nouvelle demande d'examens
                        </button>
                        <button onClick={() => { setSelectedExam(null); setIsFormOpen(true); }} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="-ml-0.5 mr-2 h-4 w-4" />Ajouter un examen
                        </button>
                    </div>
                )}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                    <FileText className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-sm font-medium text-slate-900">Aucun examen</h3>
                </div>
            ) : (
                <div className="space-y-6">

                    {/* ── Section : Demandes d'examens regroupées ── */}
                    {demandesSorted.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FlaskConical className="w-4 h-4 text-amber-600" />
                                Demandes d'examens ({demandesSorted.length})
                            </h4>
                            <div className="space-y-3">
                                {demandesSorted.map(([demandeId, demandeExams]) => {
                                    const isExpanded = expandedDemandes.has(demandeId);
                                    const dateD = demandeExams[0]?.date_demande || demandeExams[0]?.date_examen || '';
                                    const allStatuts = [...new Set(demandeExams.map((e: any) => e.statut || 'demandé'))];
                                    const globalStatut = allStatuts.length === 1 ? allStatuts[0] : 'mixte';

                                    return (
                                        <div key={demandeId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            {/* En-tête de la demande */}
                                            <div className="flex items-center justify-between p-4 bg-amber-50 border-b border-amber-100">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                                                        <FlaskConical className="w-4 h-4 text-amber-700" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            Demande du {dateD ? new Date(dateD).toLocaleDateString('fr-FR') : '—'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {demandeExams.length} examen{demandeExams.length > 1 ? 's' : ''}
                                                            {' · '}
                                                            {demandeExams.map((e: any) => e.nom_examen).join(', ').slice(0, 60)}
                                                            {demandeExams.map((e: any) => e.nom_examen).join(', ').length > 60 ? '...' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                    {globalStatut !== 'mixte' && (
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[globalStatut] || 'bg-slate-100 text-slate-700'}`}>
                                                            {STATUS_LABELS[globalStatut] || globalStatut}
                                                        </span>
                                                    )}
                                                    {/* Réimprimer */}
                                                    <button
                                                        onClick={() => handleReprint(demandeExams)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                                                        title="Réimprimer les PDF de cette demande"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        Réimprimer
                                                    </button>
                                                    {/* Supprimer la demande */}
                                                    {appUser?.role !== 'assistante' && (
                                                        <button
                                                            onClick={() => handleDeleteDemande(demandeId, demandeExams.map((e: any) => e.id))}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                                            title="Supprimer toute la demande"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {/* Expand/Collapse */}
                                                    <button
                                                        onClick={() => toggleDemande(demandeId)}
                                                        className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                                                        title={isExpanded ? 'Réduire' : 'Voir les détails'}
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Détail des examens (expand) */}
                                            {isExpanded && (
                                                <div className="divide-y divide-slate-100">
                                                    {demandeExams.map((exam: any) => {
                                                        const examDocs = documents.filter(d => d.examen_id === exam.id);
                                                        const statut   = exam.statut || 'demandé';
                                                        return (
                                                            <div key={exam.id} className="p-4">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <p className="text-sm font-semibold text-slate-900">{exam.nom_examen}</p>
                                                                            <span className="text-xs text-slate-400">({exam.type_examen})</span>
                                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[statut] || 'bg-slate-100 text-slate-700'}`}>
                                                                                {STATUS_LABELS[statut] || statut}
                                                                            </span>
                                                                        </div>
                                                                        {exam.commentaire && <p className="text-xs text-slate-500 italic">Note : {exam.commentaire}</p>}
                                                                        {exam.resultat_examen && (
                                                                            <div className="mt-2 text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                                                                                <span className="font-medium">Résultat : </span>{exam.resultat_examen}
                                                                            </div>
                                                                        )}
                                                                        {examDocs.length > 0 && (
                                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                                {examDocs.map(d => (
                                                                                    <a key={d.id} href={d.url_fichier || d.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 border border-slate-200 text-xs text-indigo-700 bg-white rounded hover:bg-slate-50">
                                                                                        <Paperclip className="w-3 h-3 mr-1" />{d.titre || 'Document'}
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {appUser?.role !== 'assistante' && (
                                                                        <div className="ml-3 flex gap-1 flex-shrink-0">
                                                                            <button onClick={() => { setSelectedExam(exam); setIsFormOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50" title="Modifier">
                                                                                <Edit className="w-4 h-4" />
                                                                            </button>
                                                                            <button onClick={() => { setSelectedExam(exam); setIsDocFormOpen(true); }} className="p-1.5 text-slate-400 hover:text-green-600 rounded hover:bg-green-50" title="Joindre un document">
                                                                                <Paperclip className="w-4 h-4" />
                                                                            </button>
                                                                            <button onClick={() => handleDeleteExam(exam.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50" title="Supprimer cet examen">
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Section : Examens sans demande_id (anciens / ajoutés manuellement) ── */}
                    {withoutDemande.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-500" />
                                Examens individuels ({withoutDemande.length})
                            </h4>
                            <div className="bg-white shadow overflow-hidden rounded-xl border border-slate-200">
                                <ul className="divide-y divide-slate-200">
                                    {withoutDemande.map((exam) => {
                                        const examDocs     = documents.filter(d => d.examen_id === exam.id);
                                        const examPayments = payments.filter(p => p.examen_id === exam.id);
                                        const status       = exam.statutExamen || exam.statut || 'demandé';
                                        return (
                                            <li key={exam.id} className="p-4 hover:bg-slate-50">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-base font-medium text-indigo-600 truncate">
                                                                {exam.nom_examen} <span className="text-sm text-slate-500 font-normal">({exam.type_examen})</span>
                                                            </p>
                                                            <span className={`ml-2 px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-800'}`}>
                                                                {STATUS_LABELS[status] || status}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 text-sm text-slate-500">
                                                            <div className="flex items-center"><Calendar className="mr-1.5 h-4 w-4 text-slate-400" /><span>Demandé: {exam.date_demande || exam.date_examen}</span></div>
                                                            {exam.dateApport  && <div className="flex items-center"><Clock className="mr-1.5 h-4 w-4 text-slate-400" /><span>Apporté: {exam.dateApport}</span></div>}
                                                            {exam.dateAnalyse && <div className="flex items-center"><CheckCircle className="mr-1.5 h-4 w-4 text-slate-400" /><span>Analysé: {exam.dateAnalyse}</span></div>}
                                                        </div>
                                                        {exam.commentaire && <div className="mt-2 text-sm text-slate-500 italic">Note: {exam.commentaire}</div>}
                                                        {exam.resultat_examen && (
                                                            <div className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100">
                                                                <span className="font-medium block mb-1">Résultat:</span>
                                                                <p className="whitespace-pre-wrap">{exam.resultat_examen}</p>
                                                            </div>
                                                        )}
                                                        {/* Documents liés */}
                                                        <div className="mt-4 pt-3 border-t border-slate-100">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                                                                    <Paperclip className="h-3 w-3 mr-1" />Documents ({examDocs.length})
                                                                </h4>
                                                                <button onClick={() => { setSelectedExam(exam); setIsDocFormOpen(true); }} className="text-xs text-indigo-600 hover:text-indigo-900 font-medium flex items-center">
                                                                    <Plus className="h-3 w-3 mr-1" />Ajouter
                                                                </button>
                                                            </div>
                                                            {examDocs.length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {examDocs.map(d => (
                                                                        <a key={d.id} href={d.url_fichier || d.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 text-xs font-medium rounded text-indigo-700 bg-white hover:bg-slate-50">
                                                                            <FileText className="mr-1.5 h-3 w-3 text-indigo-500" />{d.titre || d.nom || 'Document'}
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Paiements liés */}
                                                        {examPayments.length > 0 && (
                                                            <div className="mt-4 pt-3 border-t border-slate-100">
                                                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                                                                    <DollarSign className="h-3 w-3 mr-1" />Paiements liés
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {examPayments.map(payment => (
                                                                        <div key={payment.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-100">
                                                                            <span className="font-medium text-slate-900">{Number(payment.montant).toLocaleString('fr-MA')} MAD</span>
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${(payment.statut_paiement === 'payé' || payment.statut_paiement === 'réglé') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                                {payment.statut_paiement}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {appUser?.role !== 'assistante' && (
                                                        <div className="ml-5 flex-shrink-0 flex space-x-2">
                                                            <button onClick={() => { setSelectedExam(exam); setIsFormOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50">
                                                                <Edit className="h-5 w-5" />
                                                            </button>
                                                            <button onClick={() => handleDeleteExam(exam.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50">
                                                                <Trash2 className="h-5 w-5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isFormOpen    && <ExamForm exam={selectedExam} patientId={patientId} onClose={() => setIsFormOpen(false)} />}
            {isDocFormOpen && <DocumentForm patientId={patientId} examenId={selectedExam?.id} onClose={() => setIsDocFormOpen(false)} />}
            {isRequestOpen && (
                <ExamRequestModal
                    patientId={patientId}
                    patientName={patientName}
                    onComplete={() => setIsRequestOpen(false)}
                    onClose={() => setIsRequestOpen(false)}
                />
            )}
        </div>
    );
}
