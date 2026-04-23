import React, { useState, useEffect, useMemo } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import DateNavigator from '../components/shared/DateNavigator';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Play,
    Square,
    ChevronUp,
    ChevronDown,
    UserPlus,
    Stethoscope,
    ArrowRight,
    ClipboardList,
    CheckSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import PreConsultationForm from '../components/salle-attente/PreConsultationForm';
import PostConsultationModal from '../components/salle-attente/PostConsultationModal';
import DoctorNotesModal from '../components/salle-attente/DoctorNotesModal'; // *** NOUVEAU ***
import ExamRequestModal from '../components/salle-attente/ExamRequestModal';
import PrescriptionForm from '../components/prescriptions/PrescriptionForm';

const STATUT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    en_pre_consultation: { label: 'Pré-consultation', color: 'bg-blue-100 text-blue-800', icon: ClipboardList },
    pre_consultation_terminee: { label: 'Prêt', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    en_consultation: { label: 'En consultation', color: 'bg-purple-100 text-purple-800', icon: Stethoscope },
    termine: { label: 'Terminé', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
    annule: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const PRIORITE_CONFIG: Record<string, { label: string; color: string }> = {
    normale: { label: 'Normale', color: 'bg-gray-100 text-gray-700' },
    urgente: { label: 'Urgente', color: 'bg-orange-100 text-orange-700' },
    prioritaire: { label: 'Prioritaire', color: 'bg-red-100 text-red-700' },
};

const SalleAttente: React.FC = () => {
    const { appUser } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    const [entries, setEntries] = useState<any[]>([]);
    const [patientsMap, setPatientsMap] = useState<Record<string, any>>({});
    const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(0);

    // Modals
    const [showAddWalkIn, setShowAddWalkIn] = useState(false);
    const [walkInPatientId, setWalkInPatientId] = useState('');
    const [walkInMotif, setWalkInMotif] = useState('');
    const [preConsultTarget, setPreConsultTarget] = useState<any>(null);
    const [postConsultTarget, setPostConsultTarget] = useState<any>(null);
    const [doctorNotesTarget, setDoctorNotesTarget] = useState<any>(null); // *** NOUVEAU ***

    // Workflow post-consultation (médecin uniquement)
    const [workflowStep, setWorkflowStep] = useState<'idle' | 'exams' | 'prescription' | 'checklist'>('idle');
    const [workflowData, setWorkflowData] = useState<any>(null);

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const today    = format(new Date(), 'yyyy-MM-dd');
    const dateStr  = format(selectedDate, 'yyyy-MM-dd');
    const isCurrentDay = isToday(selectedDate);

    // Timer refresh
    useEffect(() => {
        const interval = setInterval(() => setTimer((t) => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    // Listener file_attente (suit la date sélectionnée)
    useEffect(() => {
        const q = query(
            collection(db, 'file_attente'),
            where('date', '==', dateStr)
        );
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a: any, b: any) => (a.ordre || 0) - (b.ordre || 0));
            setEntries(list);
        });
        return unsub;
    }, [dateStr]);

    // Listener patients
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'patients'), (snap) => {
            const map: Record<string, any> = {};
            snap.docs.forEach((d) => {
                map[d.id] = { id: d.id, ...d.data() };
            });
            setPatientsMap(map);
        });
        return unsub;
    }, []);

    // Listener appointments (suit la date sélectionnée)
    useEffect(() => {
        const q = query(
            collection(db, 'appointments'),
            where('date_rdv', '==', dateStr)
        );
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a: any, b: any) => (a.heure_rdv || a.heure || '').localeCompare(b.heure_rdv || b.heure || ''));
            setTodayAppointments(list);
        });
        return unsub;
    }, [dateStr]);

    // Calculs dérivés
    const appointmentIdsInQueue = useMemo(() => {
        return new Set(entries.map((e: any) => e.appointment_id).filter(Boolean));
    }, [entries]);

    const pendingAppointments = useMemo(() => {
        return todayAppointments.filter(
            (a: any) =>
                !appointmentIdsInQueue.has(a.id) &&
                a.statut !== 'annulé' &&
                a.statut !== 'réalisé' &&
                a.statut !== 'en_salle' &&
                a.statut !== 'en_consultation' &&
                a.statut !== 'en_pre_consultation'
        );
    }, [todayAppointments, appointmentIdsInQueue]);

    const activeEntries = useMemo(() => {
        return entries
            .filter((e: any) => !['termine', 'annule'].includes(e.statut))
            .sort((a: any, b: any) => {
                const prioOrder: Record<string, number> = { prioritaire: 0, urgente: 1, normale: 2 };
                const pa = prioOrder[a.priorite] ?? 2;
                const pb = prioOrder[b.priorite] ?? 2;
                if (pa !== pb) return pa - pb;
                return (a.ordre || 0) - (b.ordre || 0);
            });
    }, [entries]);

    const completedEntries = useMemo(() => {
        return entries.filter((e: any) => ['termine', 'annule'].includes(e.statut));
    }, [entries]);

    const stats = useMemo(() => {
        const s = { total: entries.length, enAttente: 0, prets: 0, enConsultation: 0, termines: 0 };
        entries.forEach((e: any) => {
            if (e.statut === 'en_attente' || e.statut === 'en_pre_consultation') s.enAttente++;
            else if (e.statut === 'pre_consultation_terminee') s.prets++;
            else if (e.statut === 'en_consultation') s.enConsultation++;
            else if (e.statut === 'termine') s.termines++;
        });
        return s;
    }, [entries]);

    const formatDuration = (ms: number) => {
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hrs}h${remainMins.toString().padStart(2, '0')}`;
    };

    const getEntryDuration = (entry: any) => {
        if (!entry.heure_arrivee) return '';
        const arrival = new Date(entry.heure_arrivee).getTime();
        const now = Date.now();
        return formatDuration(now - arrival);
    };

    // Actions
    const handlePreConsult = async (entry: any) => {
        try {
            await updateDoc(doc(db, 'file_attente', entry.id), {
                statut: 'en_pre_consultation',
                updated_at: new Date().toISOString(),
            });
            if (entry.appointment_id) {
                await updateDoc(doc(db, 'appointments', entry.appointment_id), {
                    statut: 'en_pre_consultation',
                });
            }
            setPreConsultTarget(entry);
        } catch (err) {
            console.error(err);
            setError('Erreur lors du changement de statut.');
        }
    };

    const handleStartConsultation = async (entry: any) => {
        try {
            await updateDoc(doc(db, 'file_attente', entry.id), {
                statut: 'en_consultation',
                heure_debut_consultation: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            if (entry.appointment_id) {
                await updateDoc(doc(db, 'appointments', entry.appointment_id), {
                    statut: 'en_consultation',
                });
            }
            navigate(`/patients/${entry.patient_id}?tab=consultations&consultationMode=active`);
        } catch (err) {
            console.error(err);
            setError('Erreur lors du démarrage de la consultation.');
        }
    };

    // *** MODIFIÉ : Assistante → Notes médecin d'abord, puis checklist ***
    const handleTerminate = (entry: any) => {
        const patientData = patientsMap[entry.patient_id];
        const data = {
            entryId: entry.id,
            patientName: patientData
                ? `${patientData.nom || ''} ${patientData.prenom || ''}`.trim()
                : 'Patient',
            appointmentId: entry.appointment_id,
            patientId: entry.patient_id,
            consultationId: entry.consultation_id,
        };

        // Toujours : Notes médecin → checklist post-consultation
        setDoctorNotesTarget(data);
    };


    const handleExamComplete = () => {
        setWorkflowStep('prescription');
    };

    const handleExamSkip = () => {
        setWorkflowStep('prescription');
    };

    const handlePrescriptionDone = () => {
        setWorkflowStep('checklist');
    };

    const handlePrescriptionSkip = () => {
        setWorkflowStep('checklist');
    };

    const handleWorkflowClose = () => {
        setWorkflowStep('idle');
        setWorkflowData(null);
    };

    const setStatus = async (entryId: string, statut: string, appointmentId?: string) => {
        try {
            await updateDoc(doc(db, 'file_attente', entryId), {
                statut,
                updated_at: new Date().toISOString(),
            });
            if (appointmentId && statut === 'annule') {
                await updateDoc(doc(db, 'appointments', appointmentId), {
                    statut: 'annulé',
                });
            }
        } catch (err) {
            console.error(err);
            setError('Erreur lors du changement de statut.');
        }
    };

    const changePriorite = async (entryId: string, priorite: string) => {
        try {
            await updateDoc(doc(db, 'file_attente', entryId), {
                priorite,
                updated_at: new Date().toISOString(),
            });
        } catch (err) {
            console.error(err);
        }
    };

    const moveEntry = async (entryId: string, direction: 'up' | 'down') => {
        const idx = activeEntries.findIndex((e: any) => e.id === entryId);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= activeEntries.length) return;

        const entryA = activeEntries[idx];
        const entryB = activeEntries[swapIdx];

        try {
            await updateDoc(doc(db, 'file_attente', entryA.id), { ordre: entryB.ordre || swapIdx });
            await updateDoc(doc(db, 'file_attente', entryB.id), { ordre: entryA.ordre || idx });
        } catch (err) {
            console.error(err);
        }
    };

    const registerArrival = async (appointment: any) => {
        try {
            const maxOrdre = entries.reduce((max: number, e: any) => Math.max(max, e.ordre || 0), 0);
            await addDoc(collection(db, 'file_attente'), {
                patient_id: appointment.patient_id,
                appointment_id: appointment.id,
                date: dateStr,
                heure_arrivee: new Date().toISOString(),
                statut: 'en_attente',
                priorite: 'normale',
                ordre: maxOrdre + 1,
                numero_ordre: maxOrdre + 1,
                motif: appointment.motif || '',
                created_by: appUser?.uid || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            await updateDoc(doc(db, 'appointments', appointment.id), {
                statut: 'en_salle',
            });
        } catch (err) {
            console.error(err);
            setError("Erreur lors de l'enregistrement de l'arrivée.");
        }
    };

    const handleAddWalkIn = async () => {
        if (!walkInPatientId) return;
        try {
            const maxOrdre = entries.reduce((max: number, e: any) => Math.max(max, e.ordre || 0), 0);
            await addDoc(collection(db, 'file_attente'), {
                patient_id: walkInPatientId,
                date: dateStr,
                heure_arrivee: new Date().toISOString(),
                statut: 'en_attente',
                priorite: 'normale',
                ordre: maxOrdre + 1,
                numero_ordre: maxOrdre + 1,
                motif: walkInMotif || 'Sans rendez-vous',
                type: 'walk-in',
                created_by: appUser?.uid || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            setShowAddWalkIn(false);
            setWalkInPatientId('');
            setWalkInMotif('');
        } catch (err) {
            console.error(err);
            setError("Erreur lors de l'ajout du patient sans rendez-vous.");
        }
    };

    const getPatientName = (patientId: string) => {
        const p = patientsMap[patientId];
        return p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : 'Patient inconnu';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Salle d'attente</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                    </p>
                </div>
                {isCurrentDay && (
                    <button
                        onClick={() => setShowAddWalkIn(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        <UserPlus className="w-4 h-4" />
                        Sans rendez-vous
                    </button>
                )}
            </div>

            {/* Navigation par date */}
            <DateNavigator
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                counts={Object.fromEntries(
                    Object.entries(
                        [...entries, ...todayAppointments].reduce((acc: Record<string,number>, e: any) => {
                            const d = e.date || e.date_rdv;
                            if (d) acc[d] = (acc[d] || 0) + 1;
                            return acc;
                        }, {})
                    )
                )}
                showReadonlyBanner={true}
            />

            {/* Erreur */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
                        <XCircle className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Statistiques */}
            <div className="grid grid-cols-5 gap-4">
                <div className="bg-white rounded-lg border p-4 text-center">
                    <Users className="w-6 h-6 text-indigo-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{stats.enAttente}</p>
                    <p className="text-xs text-gray-500">En attente</p>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <CheckSquare className="w-6 h-6 text-green-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{stats.prets}</p>
                    <p className="text-xs text-gray-500">Prêts</p>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <Stethoscope className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{stats.enConsultation}</p>
                    <p className="text-xs text-gray-500">En consultation</p>
                </div>
                <div className="bg-white rounded-lg border p-4 text-center">
                    <CheckCircle className="w-6 h-6 text-gray-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{stats.termines}</p>
                    <p className="text-xs text-gray-500">Terminés</p>
                </div>
            </div>

            {/* Rendez-vous en attente d'arrivée */}
            {pendingAppointments.length > 0 && (
                <div className="bg-white rounded-xl border p-4">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                        Rendez-vous du jour — En attente d'arrivée ({pendingAppointments.length})
                    </h2>
                    <div className="space-y-2">
                        {pendingAppointments.map((apt: any) => (
                            <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <span className="font-medium text-gray-900">
                                        {getPatientName(apt.patient_id)}
                                    </span>
                                    <span className="text-sm text-gray-500 ml-3">{apt.heure_rdv || apt.heure || '—'}</span>
                                    {apt.motif && (
                                        <span className="text-sm text-gray-400 ml-2">— {apt.motif}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => registerArrival(apt)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
                                >
                                    <ArrowRight className="w-4 h-4" />
                                    Arrivée
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* File d'attente active */}
            <div className="bg-white rounded-xl border">
                <div className="p-4 border-b">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                        File d'attente ({activeEntries.length})
                    </h2>
                </div>
                {activeEntries.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Aucun patient en attente</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {activeEntries.map((entry: any, idx: number) => {
                            const statusConf = STATUT_CONFIG[entry.statut] || STATUT_CONFIG.en_attente;
                            const prioConf = PRIORITE_CONFIG[entry.priorite] || PRIORITE_CONFIG.normale;
                            const StatusIcon = statusConf.icon;
                            const duration = getEntryDuration(entry);

                            return (
                                <div key={entry.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <button
                                                    onClick={() => moveEntry(entry.id, 'up')}
                                                    disabled={idx === 0}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                >
                                                    <ChevronUp className="w-3 h-3" />
                                                </button>
                                                <span className="text-xs font-mono text-gray-400">{idx + 1}</span>
                                                <button
                                                    onClick={() => moveEntry(entry.id, 'down')}
                                                    disabled={idx === activeEntries.length - 1}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                >
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-900">
                                                    {getPatientName(entry.patient_id)}
                                                </span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.color}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusConf.label}
                                                    </span>
                                                    {entry.priorite !== 'normale' && (
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${prioConf.color}`}>
                                                            {prioConf.label}
                                                        </span>
                                                    )}
                                                    {duration && <span className="text-xs text-gray-400">{duration}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                value={entry.priorite || 'normale'}
                                                onChange={(e) => changePriorite(entry.id, e.target.value)}
                                                className="text-xs border border-gray-200 rounded px-2 py-1"
                                            >
                                                <option value="normale">Normale</option>
                                                <option value="urgente">Urgente</option>
                                                <option value="prioritaire">Prioritaire</option>
                                            </select>

                                            {entry.statut === 'en_attente' && (
                                                <button
                                                    onClick={() => handlePreConsult(entry)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                                                >
                                                    <ClipboardList className="w-4 h-4" />
                                                    Pré-consult
                                                </button>
                                            )}
                                            {entry.statut === 'en_pre_consultation' && (
                                                <button
                                                    onClick={() => setPreConsultTarget(entry)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                                                >
                                                    <ClipboardList className="w-4 h-4" />
                                                    Continuer pré-consult
                                                </button>
                                            )}
                                            {entry.statut === 'pre_consultation_terminee' && (
                                                <button
                                                    onClick={() => handleStartConsultation(entry)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
                                                >
                                                    <Play className="w-4 h-4" />
                                                    Consultation
                                                </button>
                                            )}
                                            {entry.statut === 'en_consultation' && (
                                                <button
                                                    onClick={() => handleTerminate(entry)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
                                                >
                                                    <Square className="w-4 h-4" />
                                                    Terminer
                                                </button>
                                            )}

                                            {!['termine', 'annule'].includes(entry.statut) && (
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('Annuler cette entrée ?')) {
                                                            setStatus(entry.id, 'annule', entry.appointment_id);
                                                        }
                                                    }}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    title="Annuler"
                                                >
                                                    <XCircle className="w-4 h-4" />
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

            {/* Terminés / Annulés */}
            {completedEntries.length > 0 && (
                <div className="bg-white rounded-xl border">
                    <div className="p-4 border-b">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                            Terminés / Annulés ({completedEntries.length})
                        </h2>
                    </div>
                    <div className="divide-y">
                        {completedEntries.map((entry: any) => {
                            const statusConf = STATUT_CONFIG[entry.statut] || STATUT_CONFIG.termine;
                            return (
                                <div key={entry.id} className="p-3 flex items-center justify-between opacity-60">
                                    <span className="text-sm text-gray-700">{getPatientName(entry.patient_id)}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.color}`}>
                                        {statusConf.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal: Ajout sans rendez-vous */}
            {showAddWalkIn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => { setShowAddWalkIn(false); setWalkInPatientId(''); setWalkInMotif(''); }} />
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 z-50">
                        <h2 className="text-lg font-bold text-gray-900">Patient sans rendez-vous</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                            <select
                                value={walkInPatientId}
                                onChange={(e) => setWalkInPatientId(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">Sélectionner un patient</option>
                                {Object.values(patientsMap)
                                    .filter((p: any) => p.deleted !== true)
                                    .sort((a: any, b: any) => (a.nom || '').localeCompare(b.nom || ''))
                                    .map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
                            <input
                                type="text"
                                value={walkInMotif}
                                onChange={(e) => setWalkInMotif(e.target.value)}
                                placeholder="Motif de la visite..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowAddWalkIn(false); setWalkInPatientId(''); setWalkInMotif(''); }}
                                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleAddWalkIn}
                                disabled={!walkInPatientId}
                                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Ajouter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal pré-consultation */}
            {preConsultTarget && (
                <PreConsultationForm
                    entry={preConsultTarget}
                    patientName={getPatientName(preConsultTarget.patient_id)}
                    onClose={() => setPreConsultTarget(null)}
                />
            )}

            {/* Workflow post-consultation MÉDECIN : examens → ordonnance → checklist */}
            {workflowStep === 'exams' && workflowData && (
                <ExamRequestModal
                    patientId={workflowData.patientId}
                    patientName={workflowData.patientName}
                    consultationId={workflowData.consultationId}
                    onComplete={handleExamComplete}
                    onClose={handleExamSkip}
                />
            )}

            {workflowStep === 'prescription' && workflowData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={handlePrescriptionSkip} />
                    <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="text-lg font-medium">Ordonnance pour {workflowData.patientName}</h3>
                            <button
                                onClick={handlePrescriptionSkip}
                                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Passer →
                            </button>
                        </div>
                        <PrescriptionForm
                            patientId={workflowData.patientId}
                            consultationId={workflowData.consultationId}
                            onClose={handlePrescriptionDone}
                        />
                    </div>
                </div>
            )}

            {workflowStep === 'checklist' && workflowData && (
                <PostConsultationModal
                    entryId={workflowData.entryId}
                    patientName={workflowData.patientName}
                    appointmentId={workflowData.appointmentId}
                    patientId={workflowData.patientId}
                    consultationId={workflowData.consultationId}
                    onClose={handleWorkflowClose}
                />
            )}

            {/* *** NOUVEAU : Notes du médecin pour l'assistante *** */}
            {doctorNotesTarget && (
                <DoctorNotesModal
                    consultationId={doctorNotesTarget.consultationId}
                    patientId={doctorNotesTarget.patientId}
                    patientName={doctorNotesTarget.patientName}
                    onContinue={() => {
                        // Après lecture des notes → passer au checklist post-consultation
                        setPostConsultTarget(doctorNotesTarget);
                        setDoctorNotesTarget(null);
                    }}
                    onClose={() => setDoctorNotesTarget(null)}
                />
            )}

            {/* Checklist post-consultation pour l'assistante (après les notes) */}
            {postConsultTarget && !workflowData && (
                <PostConsultationModal
                    entryId={postConsultTarget.entryId}
                    patientName={postConsultTarget.patientName}
                    appointmentId={postConsultTarget.appointmentId}
                    patientId={postConsultTarget.patientId}
                    consultationId={postConsultTarget.consultationId}
                    onClose={() => setPostConsultTarget(null)}
                />
            )}
        </div>
    );
};

export default SalleAttente;
