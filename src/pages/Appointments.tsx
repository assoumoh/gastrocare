import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import AppointmentForm from '../components/appointments/AppointmentForm';
import clsx from 'clsx';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

type ViewMode = 'day' | 'week' | 'month';

const STATUT_BADGES: Record<string, { label: string, className: string }> = {
  'pre_consultation': { label: 'Pré-consultation', className: 'bg-yellow-100 text-yellow-800' },
  'en_attente': { label: 'En attente', className: 'bg-orange-100 text-orange-800' },
  'en_cours': { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
  'terminee': { label: 'Terminé', className: 'bg-green-100 text-green-800' },
};

export default function Appointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');

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
        where('date_rdv', '==', startStr),
        orderBy('heure_rdv')
      );
      qConsults = query(
        collection(db, 'consultations'),
        where('date_consultation', '==', startStr)
      );
    } else {
      qAppts = query(
        collection(db, 'appointments'),
        where('date_rdv', '>=', startStr),
        where('date_rdv', '<=', endStr),
        orderBy('date_rdv'),
        orderBy('heure_rdv')
      );
      qConsults = query(
        collection(db, 'consultations'),
        where('date_consultation', '>=', startStr),
        where('date_consultation', '<=', endStr)
      );
    }

    const unsubscribeAppts = onSnapshot(qAppts, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    const unsubscribeConsults = onSnapshot(qConsults, (snapshot) => {
      setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const handlePrev = () => {
    if (viewMode === 'day') setSelectedDate(subDays(selectedDate, 1));
    if (viewMode === 'week') setSelectedDate(subWeeks(selectedDate, 1));
    if (viewMode === 'month') setSelectedDate(subMonths(selectedDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'day') setSelectedDate(addDays(selectedDate, 1));
    if (viewMode === 'week') setSelectedDate(addWeeks(selectedDate, 1));
    if (viewMode === 'month') setSelectedDate(addMonths(selectedDate, 1));
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

  // Group appointments by date for week/month views
  const groupedAppointments = appointments.reduce((acc, apt) => {
    const date = apt.date_rdv;
    if (!acc[date]) acc[date] = [];
    acc[date].push(apt);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 capitalize">Agenda - {getTitle()}</h1>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setViewMode('day')}
              className={clsx(
                "px-4 py-2 text-sm font-medium border border-slate-300 rounded-l-md",
                viewMode === 'day' ? "bg-indigo-50 text-indigo-600 z-10" : "bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              Jour
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={clsx(
                "px-4 py-2 text-sm font-medium border-t border-b border-r border-slate-300",
                viewMode === 'week' ? "bg-indigo-50 text-indigo-600 z-10" : "bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={clsx(
                "px-4 py-2 text-sm font-medium border-t border-b border-r border-slate-300 rounded-r-md",
                viewMode === 'month' ? "bg-indigo-50 text-indigo-600 z-10" : "bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              Mois
            </button>
          </div>
          <button 
            onClick={() => {
              setSelectedAppointment(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouveau
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
        {/* Navigation Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={handleToday} className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
              Aujourd'hui
            </button>
            <div className="flex items-center space-x-2">
              <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-900 capitalize">
            {getTitle()}
          </div>
        </div>

        {/* Agenda List */}
        <div className="flex-1 p-0 overflow-y-auto max-h-[600px]">
          {viewMode === 'day' ? (
            <ul className="divide-y divide-slate-200">
              {appointments.map((apt) => {
                const patient = patients[apt.patient_id];
                const consultation = consultations.find(c => c.patient_id === apt.patient_id && c.date_consultation === apt.date_rdv);
                const statusInfo = consultation ? STATUT_BADGES[consultation.statutConsultation || 'pre_consultation'] : null;
                return (
                  <li 
                    key={apt.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setIsFormOpen(true);
                    }}
                  >
                    <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-4 text-center">
                          <span className="text-lg font-bold text-indigo-600">{apt.heure_rdv}</span>
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
                          <p className="text-sm text-slate-500 mt-1">{apt.motif || 'Aucun motif précisé'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(apt.statut))}>
                          {apt.statut}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
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
                    {format(new Date(dateStr), 'EEEE d MMMM yyyy', { locale: fr })}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {groupedAppointments[dateStr].map((apt) => {
                      const patient = patients[apt.patient_id];
                      const consultation = consultations.find(c => c.patient_id === apt.patient_id && c.date_consultation === apt.date_rdv);
                      const statusInfo = consultation ? STATUT_BADGES[consultation.statutConsultation || 'pre_consultation'] : null;
                      return (
                        <li 
                          key={apt.id} 
                          className="hover:bg-slate-50 transition-colors pl-8 cursor-pointer"
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setIsFormOpen(true);
                          }}
                        >
                          <div className="px-4 py-3 sm:px-6 flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 mr-4 text-center w-16">
                                <span className="text-md font-bold text-indigo-600">{apt.heure_rdv}</span>
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
                                <p className="text-xs text-slate-500 mt-0.5">{apt.motif || 'Aucun motif précisé'}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", getStatusColor(apt.statut))}>
                                {apt.statut}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
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
