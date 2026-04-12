import React, { useState, useEffect, useMemo } from 'react';
import {
    collection, query, where, onSnapshot, orderBy, addDoc, updateDoc, doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    Users, Clock, AlertTriangle, CheckCircle, Play, UserPlus,
    ChevronUp, ChevronDown, Stethoscope, ClipboardList, X, Search,
    Calendar, LogIn
} from 'lucide-react';
import type { FileAttenteEntry, StatutFileAttente, PrioriteFileAttente } from '../types';

// ── Types locaux ──
interface PatientInfo {
    id: string;
    nom: string;
    prenom: string;
    telephone?: string;
    allergies?: string;
}

interface AppointmentInfo {
    id: string;
    patient_id: string;
    heure_rdv: string;
    motif?: string;
    statut: string;
}

// ── Badges de statut ──
const STATUT_CONFIG: Record<StatutFileAttente, { label: string; color: string; icon: React.ElementType }> = {
    en_attente: { label: 'En attente', color: 'bg-orange-100 text-orange-800', icon: Clock },
    en_pre_consultation: { label: 'Pré-consultation', color: 'bg-yellow-100 text-yellow-800', icon: ClipboardList },
    pret: { label: 'Prêt', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    en_consultation: { label: 'En consultation', color: 'bg-indigo-100 text-indigo-800', icon: Stethoscope },
    termine: { label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    annule: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: X },
};

const PRIORITE_CONFIG: Record<PrioriteFileAttente, { label: string; color: string }> = {
    normale: { label: 'Normale', color: 'bg-slate-100 text-slate-700' },
    urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
    prioritaire: { label: 'Prioritaire', color: 'bg-amber-100 text-amber-700' },
};

const STATUT_FLOW: StatutFileAttente[] = ['en_attente', 'en_pre_consultation', 'pret', 'en_consultation', 'termine'];

export default function SalleAttente() {
    const { appUser } = useAuth();
    const { settings } = useSettings();
    const today = format(new Date(), 'yyyy-MM-dd');

    // ── State principal ──
    const [entries, setEntries] = useState<FileAttenteEntry[]>([]);
    const [patientsMap, setPatientsMap] = useState<Record<string, PatientInfo>>({});
    const [allPatients, setAllPatients] = useState<PatientInfo[]>([]);
    const [todayAppointments, setTodayAppointments] = useState<AppointmentInfo[]>([]);

    // ── State modal walk-in ──
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [selectedPatientLabel, setSelectedPatientLabel] = useState('');
    const [isPatientListOpen, setIsPatientListOpen] = useState(false);
    const [addPriorite, setAddPriorite] = useState<PrioriteFileAttente>('normale');
    const [addMotif, setAddMotif] = useState('');
    const [adding, setAdding] = useState(false);

    // ── Charger la file d'attente du jour ──
    useEffect(() => {
        const q = query(
            collection(db, 'file_attente'),
            where('date', '==', today),
            orderBy('numero_ordre')
        );
        const unsub = onSnapshot(q, (snap) => {
            setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FileAttenteEntry)));
        });
        return () => unsub();
    }, [today]);

    // ── Charger les patients ──
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'patients'), (snap) => {
            const map: Record<string, PatientInfo> = {};
            const list: PatientInfo[] = [];
            snap.docs.forEach((d) => {
                const data = d.data();
                if (data.deleted) return;
                const p: PatientInfo = {
                    id: d.id,
                    nom: data.nom || '',
                    prenom: data.prenom || '',
                    telephone: data.telephone,
                    allergies: data.allergies,
                };
                map[d.id] = p;
                list.push(p);
            });
            setPatientsMap(map);
            setAllPatients(list.sort((a, b) => a.nom.localeCompare(b.nom)));
        });
        return () => unsub();
    }, []);

    // ── Charger les RDV du jour ──
    useEffect(() => {
        const q = query(
            collection(db, 'appointments'),
            where('date_rdv', '==', today),
            orderBy('heure_rdv')
        );
        const unsub = onSnapshot(q, (snap) => {
            setTodayAppointments(
                snap.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        patient_id: data.patient_id,
                        heure_rdv: data.heure_rdv,
                        motif: data.motif,
                        statut: data.statut,
                    } as AppointmentInfo;
                })
            );
        });
        return () => unsub();
    }, [today]);

    // ── RDV en attente d'arrivée (pas encore dans la file et pas annulés/réalisés) ──
    const appointmentIdsInQueue = useMemo(() => {
        const ids = new Set<string>();
        entries.forEach((e) => {
            if (e.appointment_id) ids.add(e.appointment_id);
        });
        return ids;
    }, [entries]);

    const pendingAppointments = useMemo(() =>
        todayAppointments.filter((apt) =>
            !appointmentIdsInQueue.has(apt.id) &&
            apt.statut !== 'annulé' &&
            apt.statut !== 'annule' &&
            apt.statut !== 'réalisé' &&
            apt.statut !== 'termine' &&
            apt.statut !== 'absent' &&
            apt.statut !== 'no_show'
        ),
        [todayAppointments, appointmentIdsInQueue]
    );

    // ── Entrées actives et terminées ──
    const activeEntries = useMemo(() =>
        entries
            .filter((e) => e.statut !== 'termine' && e.statut !== 'annule')
            .sort((a, b) => {
                const prioOrder: Record<PrioriteFileAttente, number> = { urgente: 0, prioritaire: 1, normale: 2 };
                const pa = prioOrder[a.priorite] ?? 2;
                const pb = prioOrder[b.priorite] ?? 2;
                if (pa !== pb) return pa - pb;
                return a.numero_ordre - b.numero_ordre;
            }),
        [entries]
    );

    const completedEntries = useMemo(() =>
        entries.filter((e) => e.statut === 'termine' || e.statut === 'annule'),
        [entries]
    );

    // ── Temps d'attente estimé ──
    const getEstimatedWait = (_entry: FileAttenteEntry, index: number): number => {
        const ahead = activeEntries.filter((_e, i) => i < index && _e.statut !== 'en_consultation');
        return ahead.length * (settings.duree_consultation + settings.duree_pre_consultation);
    };

    // ── Stats ──
    const stats = useMemo(() => ({
        total: activeEntries.length,
        enAttente: activeEntries.filter((e) => e.statut === 'en_attente').length,
        enPreConsult: activeEntries.filter((e) => e.statut === 'en_pre_consultation').length,
        enConsultation: activeEntries.filter((e) => e.statut === 'en_consultation').length,
        termines: completedEntries.filter((e) => e.statut === 'termine').length,
        urgents: activeEntries.filter((e) => e.priorite === 'urgente').length,
    }), [activeEntries, completedEntries]);

    // ── Actions sur la file ──
    const advanceStatus = async (entry: FileAttenteEntry) => {
        const currentIdx = STATUT_FLOW.indexOf(entry.statut);
        if (currentIdx < 0 || currentIdx >= STATUT_FLOW.length - 1) return;
        const nextStatut = STATUT_FLOW[currentIdx + 1];
        const updates: Record<string, string> = {
            statut: nextStatut,
            updated_at: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'file_attente', entry.id), updates);

        // Si terminé et lié à un RDV → mettre le RDV en "réalisé"
        if (nextStatut === 'termine' && entry.appointment_id) {
            await updateDoc(doc(db, 'appointments', entry.appointment_id), {
                statut: 'réalisé',
                updated_at: new Date().toISOString(),
            });
        }
    };

    const setStatus = async (entryId: string, statut: StatutFileAttente, appointmentId?: string) => {
        await updateDoc(doc(db, 'file_attente', entryId), {
            statut,
            updated_at: new Date().toISOString(),
        });
        // Si annulé et lié à un RDV → remettre le RDV en confirmé
        if (statut === 'annule' && appointmentId) {
            await updateDoc(doc(db, 'appointments', appointmentId), {
                statut: 'confirmé',
                updated_at: new Date().toISOString(),
            });
        }
    };

    const changePriorite = async (entryId: string, priorite: PrioriteFileAttente) => {
        await updateDoc(doc(db, 'file_attente', entryId), {
            priorite,
            updated_at: new Date().toISOString(),
        });
    };

    const moveEntry = async (entryIndex: number, direction: 'up' | 'down') => {
        const swapIdx = direction === 'up' ? entryIndex - 1 : entryIndex + 1;
        if (swapIdx < 0 || swapIdx >= activeEntries.length) return;
        const entryA = activeEntries[entryIndex];
        const entryB = activeEntries[swapIdx];
        await updateDoc(doc(db, 'file_attente', entryA.id), { numero_ordre: entryB.numero_ordre, updated_at: new Date().toISOString() });
        await updateDoc(doc(db, 'file_attente', entryB.id), { numero_ordre: entryA.numero_ordre, updated_at: new Date().toISOString() });
    };

    // ── Enregistrer l'arrivée d'un RDV ──
    const registerArrival = async (apt: AppointmentInfo) => {
        const maxOrdre = entries.length > 0 ? Math.max(...entries.map((e) => e.numero_ordre)) : 0;
        const now = new Date();
        await addDoc(collection(db, 'file_attente'), {
            patient_id: apt.patient_id,
            appointment_id: apt.id,
            date: today,
            numero_ordre: maxOrdre + 1,
            heure_arrivee: format(now, 'HH:mm'),
            statut: 'en_attente' as StatutFileAttente,
            priorite: 'normale' as PrioriteFileAttente,
            motif: apt.motif || '',
            created_by: appUser?.uid || '',
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });
        // Mettre à jour le statut du RDV
        await updateDoc(doc(db, 'appointments', apt.id), {
            statut: 'en_salle',
            updated_at: now.toISOString(),
        });
    };

    // ── Ajouter un walk-in (sans RDV) ──
    const handleAddWalkIn = async () => {
        if (!selectedPatientId) return;
        setAdding(true);
        try {
            const maxOrdre = entries.length > 0 ? Math.max(...entries.map((e) => e.numero_ordre)) : 0;
            const now = new Date();
            await addDoc(collection(db, 'file_attente'), {
                patient_id: selectedPatientId,
                date: today,
                numero_ordre: maxOrdre + 1,
                heure_arrivee: format(now, 'HH:mm'),
                statut: 'en_attente' as StatutFileAttente,
                priorite: addPriorite,
                motif: addMotif || '',
                created_by: appUser?.uid || '',
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
            });
            closeAddModal();
        } catch (err) {
            console.error('Erreur ajout file:', err);
        } finally {
            setAdding(false);
        }
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setSelectedPatientId('');
        setSelectedPatientLabel('');
        setPatientSearch('');
        setIsPatientListOpen(false);
        setAddPriorite('normale');
        setAddMotif('');
    };

    // ── Recherche patients pour modal ──
    const filteredAddPatients = useMemo(() => {
        if (!patientSearch.trim()) return [];
        const s = patientSearch.toLowerCase();
        return allPatients.filter((p) =>
            p.nom.toLowerCase().includes(s) ||
            p.prenom.toLowerCase().includes(s) ||
            (p.telephone || '').includes(s)
        ).slice(0, 10);
    }, [patientSearch, allPatients]);

    const handlePatientSearchChange = (value: string) => {
        setPatientSearch(value);
        setIsPatientListOpen(true);
        // Si l'utilisateur re-tape, réinitialiser la sélection
        if (selectedPatientId) {
            setSelectedPatientId('');
            setSelectedPatientLabel('');
        }
    };

    const handleSelectPatient = (patient: PatientInfo) => {
        setSelectedPatientId(patient.id);
        setSelectedPatientLabel(`${patient.nom} ${patient.prenom}`);
        setPatientSearch('');
        setIsPatientListOpen(false);
    };

    const isMedecinOrAdmin = appUser?.role === 'admin' || appUser?.role === 'medecin';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Salle d'attente</h1>
                    <p className="mt-1 text-sm text-slate-500">{format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-4 sm:mt-0 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    <UserPlus className="-ml-1 mr-2 h-5 w-5" />
                    Patient sans RDV
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                    <Users className="h-6 w-6 text-slate-400 mx-auto" />
                    <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
                    <p className="text-xs text-slate-500">En file</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                    <Clock className="h-6 w-6 text-orange-500 mx-auto" />
                    <p className="mt-2 text-2xl font-bold text-orange-600">{stats.enAttente}</p>
                    <p className="text-xs text-slate-500">En attente</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                    <ClipboardList className="h-6 w-6 text-yellow-500 mx-auto" />
                    <p className="mt-2 text-2xl font-bold text-yellow-600">{stats.enPreConsult}</p>
                    <p className="text-xs text-slate-500">Pré-consult</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                    <Stethoscope className="h-6 w-6 text-indigo-500 mx-auto" />
                    <p className="mt-2 text-2xl font-bold text-indigo-600">{stats.enConsultation}</p>
                    <p className="text-xs text-slate-500">En consultation</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                    <CheckCircle className="h-6 w-6 text-green-500 mx-auto" />
                    <p className="mt-2 text-2xl font-bold text-green-600">{stats.termines}</p>
                    <p className="text-xs text-slate-500">Terminés</p>
                </div>
                {stats.urgents > 0 && (
                    <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
                        <AlertTriangle className="h-6 w-6 text-red-500 mx-auto" />
                        <p className="mt-2 text-2xl font-bold text-red-600">{stats.urgents}</p>
                        <p className="text-xs text-red-500">Urgences</p>
                    </div>
                )}
            </div>

            {/* ===== SECTION RDV DU JOUR EN ATTENTE D'ARRIVÉE ===== */}
            {pendingAppointments.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-indigo-50">
                        <h2 className="text-lg font-medium text-indigo-900 flex items-center">
                            <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                            Rendez-vous du jour — En attente d'arrivée ({pendingAppointments.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {pendingAppointments.map((apt) => {
                            const patient = patientsMap[apt.patient_id];
                            return (
                                <div key={apt.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-shrink-0 text-center">
                                            <span className="text-lg font-bold text-indigo-600">{apt.heure_rdv}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">
                                                {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                                            </p>
                                            <p className="text-xs text-slate-500">{apt.motif || 'Pas de motif'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                            {apt.statut}
                                        </span>
                                        <button
                                            onClick={() => registerArrival(apt)}
                                            className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                                        >
                                            <LogIn className="h-3.5 w-3.5 mr-1" />
                                            Enregistrer l'arrivée
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ===== FILE D'ATTENTE ACTIVE ===== */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-lg font-medium text-slate-900">File d'attente active</h2>
                </div>

                {activeEntries.length === 0 ? (
                    <div className="p-12 text-center text-sm text-slate-500">
                        Aucun patient en file d'attente pour le moment.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200">
                        {activeEntries.map((entry, index) => {
                            const patient = patientsMap[entry.patient_id];
                            const statutInfo = STATUT_CONFIG[entry.statut];
                            const prioriteInfo = PRIORITE_CONFIG[entry.priorite];
                            const estimatedWait = getEstimatedWait(entry, index);
                            const StatusIcon = statutInfo.icon;
                            // Trouver le RDV lié pour afficher l'heure du RDV
                            const linkedApt = entry.appointment_id
                                ? todayAppointments.find((a) => a.id === entry.appointment_id)
                                : undefined;

                            return (
                                <div
                                    key={entry.id}
                                    className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${entry.priorite === 'urgente' ? 'border-l-4 border-l-red-500 bg-red-50/30' :
                                            entry.priorite === 'prioritaire' ? 'border-l-4 border-l-amber-500 bg-amber-50/30' : ''
                                        }`}
                                >
                                    {/* Gauche */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <span className="text-lg font-bold text-indigo-600">{entry.numero_ordre}</span>
                                        </div>

                                        {isMedecinOrAdmin && (
                                            <div className="flex flex-col gap-0.5">
                                                <button onClick={() => moveEntry(index, 'up')} disabled={index === 0} className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30">
                                                    <ChevronUp className="h-4 w-4 text-slate-500" />
                                                </button>
                                                <button onClick={() => moveEntry(index, 'down')} disabled={index === activeEntries.length - 1} className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30">
                                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                                </button>
                                            </div>
                                        )}

                                        <div>
                                            <p className="text-sm font-medium text-slate-900">
                                                {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                                                {patient?.allergies && (
                                                    <span className="ml-2 text-xs text-red-600 font-normal">⚠ {patient.allergies}</span>
                                                )}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                <span className="text-xs text-slate-500">Arrivée : {entry.heure_arrivee}</span>
                                                {linkedApt && (
                                                    <span className="text-xs text-indigo-500 font-medium">RDV : {linkedApt.heure_rdv}</span>
                                                )}
                                                {!linkedApt && entry.appointment_id === undefined && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">Sans RDV</span>
                                                )}
                                                {entry.motif && <span className="text-xs text-slate-500">• {entry.motif}</span>}
                                                {estimatedWait > 0 && entry.statut === 'en_attente' && (
                                                    <span className="text-xs text-indigo-600 font-medium">≈ {estimatedWait} min d'attente</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Droite */}
                                    <div className="flex items-center gap-3">
                                        {entry.priorite !== 'normale' && (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${prioriteInfo.color}`}>
                                                {entry.priorite === 'urgente' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                                {prioriteInfo.label}
                                            </span>
                                        )}

                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statutInfo.color}`}>
                                            <StatusIcon className="h-3 w-3 mr-1" />
                                            {statutInfo.label}
                                        </span>

                                        <div className="flex items-center gap-1">
                                            {entry.statut !== 'termine' && entry.statut !== 'annule' && (
                                                <button
                                                    onClick={() => advanceStatus(entry)}
                                                    className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                                                    title="Étape suivante"
                                                >
                                                    <Play className="h-3 w-3 mr-1" />
                                                    Suivant
                                                </button>
                                            )}

                                            {isMedecinOrAdmin && entry.statut !== 'termine' && (
                                                <select
                                                    value={entry.priorite}
                                                    onChange={(e) => changePriorite(entry.id, e.target.value as PrioriteFileAttente)}
                                                    className="rounded-md border border-slate-300 text-xs py-1 pl-2 pr-6 focus:border-indigo-500 focus:ring-indigo-500"
                                                >
                                                    <option value="normale">Normale</option>
                                                    <option value="prioritaire">Prioritaire</option>
                                                    <option value="urgente">Urgente</option>
                                                </select>
                                            )}

                                            {entry.statut !== 'termine' && entry.statut !== 'annule' && (
                                                <button
                                                    onClick={() => setStatus(entry.id, 'annule', entry.appointment_id)}
                                                    className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                                                    title="Annuler"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ===== PATIENTS TERMINÉS ===== */}
            {completedEntries.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="text-lg font-medium text-slate-500">Terminés aujourd'hui ({completedEntries.length})</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {completedEntries.map((entry) => {
                            const patient = patientsMap[entry.patient_id];
                            const statutInfo = STATUT_CONFIG[entry.statut];
                            return (
                                <div key={entry.id} className="px-6 py-3 flex items-center justify-between opacity-60">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                            <span className="text-sm font-medium text-slate-400">{entry.numero_ordre}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-600">{patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}</p>
                                            <p className="text-xs text-slate-400">Arrivée : {entry.heure_arrivee}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statutInfo.color}`}>
                                        {statutInfo.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ===== MODAL WALK-IN (PATIENT SANS RDV) ===== */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={closeAddModal} />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 z-50">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-slate-900">Ajouter un patient sans RDV</h3>
                            <button onClick={closeAddModal} className="text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Sélection patient */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Patient</label>

                                {/* Patient sélectionné */}
                                {selectedPatientId ? (
                                    <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-800">{selectedPatientLabel}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedPatientId('');
                                                setSelectedPatientLabel('');
                                                setPatientSearch('');
                                            }}
                                            className="text-green-600 hover:text-green-800"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={patientSearch}
                                            onChange={(e) => handlePatientSearchChange(e.target.value)}
                                            onFocus={() => patientSearch.trim() && setIsPatientListOpen(true)}
                                            placeholder="Rechercher par nom ou téléphone..."
                                            autoFocus
                                            className="w-full pl-10 pr-3 py-2 rounded-md border border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />

                                        {/* Liste de résultats */}
                                        {isPatientListOpen && patientSearch.trim() && (
                                            <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                                                {filteredAddPatients.map((p) => (
                                                    <li
                                                        key={p.id}
                                                        onClick={() => handleSelectPatient(p)}
                                                        className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 text-slate-700"
                                                    >
                                                        <span className="font-medium">{p.nom} {p.prenom}</span>
                                                        {p.telephone && <span className="ml-2 text-slate-400">— {p.telephone}</span>}
                                                    </li>
                                                ))}
                                                {filteredAddPatients.length === 0 && (
                                                    <li className="px-3 py-2 text-sm text-slate-500 italic">Aucun patient trouvé</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Priorité */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
                                <select
                                    value={addPriorite}
                                    onChange={(e) => setAddPriorite(e.target.value as PrioriteFileAttente)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="normale">Normale</option>
                                    <option value="prioritaire">Prioritaire</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>

                            {/* Motif */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Motif (optionnel)</label>
                                <input
                                    type="text"
                                    value={addMotif}
                                    onChange={(e) => setAddMotif(e.target.value)}
                                    placeholder="Ex: Suivi, Douleurs abdominales..."
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <button
                                onClick={handleAddWalkIn}
                                disabled={!selectedPatientId || adding}
                                className="w-full inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <UserPlus className="-ml-1 mr-2 h-4 w-4" />
                                {adding ? 'Ajout en cours...' : 'Ajouter à la file'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
