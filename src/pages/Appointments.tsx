import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight, LogIn, AlertTriangle } from 'lucide-react';
import AppointmentForm from '../components/appointments/AppointmentForm';
import clsx from 'clsx';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay, startOfWeek as sowFn, addDays as addDaysFn } from 'date-fns';
import { fr } from 'date-fns/locale';
import DateNavigator from '../components/shared/DateNavigator';

type ViewMode = 'day' | 'week' | 'month';

const STATUT_BADGES: Record<string, { label: string, className: string }> = {
  'pre_consultation': { label: 'Pré-consultation', className: 'bg-yellow-100 text-yellow-800' },
  'en_attente': { label: 'En attente', className: 'bg-orange-100 text-orange-800' },
  'en_cours': { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
  'terminee': { label: 'Terminé', className: 'bg-green-100 text-green-800' },
};

export default function Appointments() {
  const { appUser } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [sendingToQueue, setSendingToQueue] = useState<string | null>(null);
  const [queryError, setQueryError] = useState('');

  useEffect(() => {
    const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      const pts: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        pts[doc.id] = doc.data();
      });
      setPatients(pts);
    });
    return () => unsubPatients();
  }, []);

  useEffect(() => {
    let startDate = selectedDate;
    let endDate = selectedDate;

    if (viewMode === 'week') {
      startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
      endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
    } else if (viewMode === 'month') {
      startDate = startOfMonth(selectedDate);
      endDate = endOfMonth(selectedDate);
    }

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    let qAppts;
    let qConsults;
    if (viewMode === 'day') {
      qAppts = query(
        collection(db, 'appointments'),
        where('date_rdv', '==', startStr)
      );
      qConsults = query(
        collection(db, 'consultations'),
        where('date_consultation', '==', startStr)
      );
    } else {
      qAppts = query(
        collection(db, 'appointments'),
        where('date_rdv', '>=', startStr),
        where('date_rdv', '<=', endStr)
      );
      qConsults = query(
        collection(db, 'consultations'),
        where('date_consultation', '>=', startStr),
        where('date_consultation', '<=', endStr)
      );
    }

    setQueryError('');

    const unsubscribeAppts = onSnapshot(qAppts, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Tri client-side pour garantir l'ordre même sans index composite
      data.sort((a: any, b: any) => {
        if (a.date_rdv !== b.date_rdv) return a.date_rdv.localeCompare(b.date_rdv);
        return (a.heure_rdv || '').localeCompare(b.heure_rdv || '');
      });
      setAppointments(data);
    }, (error) => {
      console.error('Erreur chargement RDV:', error);
      setQueryError('Erreur de chargement des rendez-vous. Vérifiez les index Firestore.');
    });

    const unsubscribeConsults = onSnapshot(qConsults, (snapshot) => {
      setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Erreur chargement consultations:', error);
    });

    return () => {
      unsubscribeAppts();
      unsubscribeConsults();
    };
  }, [selectedDate, viewMode]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmé': return 'bg-green-100 text-green-800';
      case 'annulé': return 'bg-red-100 text-red-800';
      case 'réalisé': return 'bg-slate-100 text-slate-800';
      case 'absent': return 'bg-orange-100 text-orange-800';
      case 'en_salle': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // FIX: Utiliser des fonctions de mise à jour fonctionnelles pour éviter les closures stales
  const handlePrev = () => {
    setSelectedDate(prev => {
      if (viewMode === 'day') return subDays(prev, 1);
      if (viewMode === 'week') return subWeeks(prev, 1);
      return subMonths(prev, 1);
    });
  };

  const handleNext = () => {
    setSelectedDate(prev => {
      if (viewMode === 'day') return addDays(prev, 1);
      if (viewMode === 'week') return addWeeks(prev, 1);
      return addMonths(prev, 1);
    });
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const getTitle = () => {
    if (viewMode === 'day') {
      return format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr });
    }
    if (viewMode === 'week') {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `Semaine du ${format(start, 'd MMM')} au ${format(end, 'd MMM yyyy', { locale: fr })}`;
    }
    return format(selectedDate, 'MMMM yyyy', { locale: fr });
  };

  // Envoyer un RDV en salle d'attente
  const handleSendToQueue = async (apt: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sendingToQueue) return;
    setSendingToQueue(apt.id);
    try {
      const checkQuery = query(
        collection(db, 'file_attente'),
        where('appointment_id', '==', apt.id),
        where('date', '==', apt.date_rdv)
      );
      const checkSnap = await getDocs(checkQuery);
      if (!checkSnap.empty) {
        alert('Ce rendez-vous est déjà dans la file d\'attente.');
        setSendingToQueue(null);
        return;
      }

      const todayQuery = query(
        collection(db, 'file_attente'),
        where('date', '==', apt.date_rdv)
      );
      const todaySnap = await getDocs(todayQuery);
      const maxOrdre = todaySnap.empty ? 0 : Math.max(...todaySnap.docs.map(d => d.data().numero_ordre || 0));

      const now = new Date();
      await addDoc(collection(db, 'file_attente'), {
        patient_id: apt.patient_id,
        appointment_id: apt.id,
        date: apt.date_rdv,
        numero_ordre: maxOrdre + 1,
        heure_arrivee: format(now, 'HH:mm'),
        heure_arrivee_iso: now.toISOString(),
        statut: 'en_attente',
        priorite: 'normale',
        motif: apt.motif || '',
        created_by: appUser?.uid || '',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      await updateDoc(doc(db, 'appointments', apt.id), {
        statut: 'en_salle',
        updated_at: now.toISOString(),
      });
    } catch (err) {
      console.error('Erreur envoi en salle:', err);
      alert('Erreur lors de l\'envoi en salle d\'attente.');
    } finally {
      setSendingToQueue(null);
    }
  };

  const canSendToQueue = (apt: any): boolean => {
    return ['planifie', 'planifié', 'prévu', 'confirmé', 'confirme'].includes(apt.statut);
  };

  // Group appointments by date for week/month views
  const groupedAppointments = appointments.reduce((acc, apt) => {
    const date = apt.date_rdv;
    if (!acc[date]) acc[date] = [];
    acc[date].push(apt);
    return acc;
  }, {} as Record<string, any[]>);

  // Comptage par date pour DateNavigator (toute la semaine visible)
  const appointmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      if (a.date_rdv) counts[a.date_rdv] = (counts[a.date_rdv] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  // Composant de rendu d'un RDV
  const renderAppointmentRow = (apt: any, compact: boolean = false) => {
    const patient = patients[apt.patient_id];
    const consultation = consultations.find(c => c.patient_id === apt.patient_id && c.date_consultation === apt.date_rdv);
    const statusInfo = consultation ? STATUT_BADGES[consultation.statutConsultation || 'pre_consultation'] : null;
    const showSendButton = canSendToQueue(apt);
    const isSending = sendingToQueue === apt.id;

    return (
      <div className={`${compact ? 'px-4 py-3 sm:px-6' : 'px-4 py-4 sm:px-6'} flex items-center justify-between`}>
        <div className="flex items-center">
          <div className={`flex-shrink-0 mr-4 text-center ${compact ? 'w-16' : ''}`}>
            <span className={`${compact ? 'text-md' : 'text-lg'} font-bold text-indigo-600`}>{apt.heure_rdv}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 flex items-center">
              <User className="mr-1 h-4 w-4 text-slate-400" />
              {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
              {patient?.statutPatient === 'patient_habituel' ? (
                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Habituel
                </span>
              ) : patient?.statutPatient === 'nouveau_patient' ? (
                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  Nouveau
                </span>
              ) : null}
              {statusInfo && (
                <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              )}
            </p>
            <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-500 mt-${compact ? '0.5' : '1'}`}>
              {apt.motif || 'Aucun motif précisé'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {showSendButton && (
            <button
              onClick={(e) => handleSendToQueue(apt, e)}
              disabled={isSending}
              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              title="Envoyer en salle d'attente"
            >
              <LogIn className="h-3.5 w-3.5 mr-1" />
              {isSending ? '...' : 'Salle d\'attente'}
            </button>
          )}
          {apt.statut === 'en_salle' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
              En salle
            </span>
          )}
          <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(apt.statut))}>
            {apt.statut}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{getTitle()}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Vue Jour / Semaine / Mois */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode, i) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  i > 0 && 'border-l border-slate-200',
                  viewMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {mode === 'day' ? 'Jour' : mode === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setSelectedAppointment(null); setIsFormOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau RDV
          </button>
        </div>
      </div>

      {/* DateNavigator */}
      <DateNavigator
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        counts={appointmentCounts}
      />

      {queryError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-sm text-red-700">{queryError}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
        {/* Agenda List */}
        <div className="flex-1 p-0 overflow-y-auto max-h-[600px]">
          {viewMode === 'day' ? (
            <ul className="divide-y divide-slate-200">
              {appointments.map((apt) => (
                <li
                  key={apt.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedAppointment(apt);
                    setIsFormOpen(true);
                  }}
                >
                  {renderAppointmentRow(apt)}
                </li>
              ))}
              {appointments.length === 0 && (
                <li className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucun rendez-vous prévu pour cette date.
                </li>
              )}
            </ul>
          ) : (
            <div className="divide-y divide-slate-200">
              {Object.keys(groupedAppointments).sort().map(dateStr => (
                <div key={dateStr} className="bg-white">
                  <div className="bg-slate-100 px-4 py-2 font-medium text-sm text-slate-700 sticky top-0 z-10">
                    {format(new Date(dateStr + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {groupedAppointments[dateStr].map((apt: any) => (
                      <li
                        key={apt.id}
                        className="hover:bg-slate-50 transition-colors pl-8 cursor-pointer"
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setIsFormOpen(true);
                        }}
                      >
                        {renderAppointmentRow(apt, true)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {Object.keys(groupedAppointments).length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucun rendez-vous prévu pour cette période.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isFormOpen && <AppointmentForm appointment={selectedAppointment} onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}
