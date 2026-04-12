import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar, Users, Activity, AlertCircle, FileText, Pill,
  Clock, CheckCircle, UserPlus, FileSignature, Files, ChevronRight, User, Stethoscope, ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { FileAttenteEntry } from '../types';

export default function Dashboard() {
  const { appUser } = useAuth();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, any>>({});
  const [patientStats, setPatientStats] = useState({ total: 0, nouveaux: 0, habituels: 0 });
  const [fileAttente, setFileAttente] = useState<FileAttenteEntry[]>([]);

  useEffect(() => {
    if (!appUser) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const unsubRecentPatients = onSnapshot(
      query(collection(db, 'patients'), orderBy('created_at', 'desc'), limit(10)),
      (snapshot) => {
        const pts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((p: any) => p.deleted !== true);
        setRecentPatients(pts);
        const pMap: Record<string, any> = {};
        pts.forEach((p: any) => { pMap[p.id] = p; });
        setPatientsMap(prev => ({ ...prev, ...pMap }));
      }
    );

    const unsubAllPatients = onSnapshot(
      query(collection(db, 'patients')),
      (snapshot) => {
        let nouveaux = 0, habituels = 0, total = 0;
        const pMap: Record<string, any> = {};
        snapshot.docs.forEach(d => {
          const data = d.data();
          pMap[d.id] = data;
          if (data.deleted === true) return;
          total++;
          if (data.statutPatient === 'nouveau_patient') nouveaux++;
          else if (data.statutPatient === 'patient_habituel') habituels++;
        });
        setPatientStats({ total, nouveaux, habituels });
        setPatientsMap(pMap);
      }
    );

    const unsubAppointments = onSnapshot(
      query(collection(db, 'appointments'), where('date_rdv', '==', todayStr)),
      (snapshot) => { setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }
    );

    const unsubConsultations = onSnapshot(
      query(collection(db, 'consultations'), where('date_consultation', '==', todayStr)),
      (snapshot) => { setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }
    );

    // File d'attente du jour
    const unsubFileAttente = onSnapshot(
      query(collection(db, 'file_attente'), where('date', '==', todayStr)),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FileAttenteEntry));
        data.sort((a, b) => a.numero_ordre - b.numero_ordre);
        setFileAttente(data);
      }
    );

    const unsubExams = onSnapshot(
      query(collection(db, 'exams'), orderBy('created_at', 'desc'), limit(5)),
      (snapshot) => { setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }
    );

    const unsubPrescriptions = onSnapshot(
      query(collection(db, 'prescriptions'), orderBy('date_prescription', 'desc'), limit(5)),
      (snapshot) => { setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }
    );

    const unsubDocuments = onSnapshot(
      query(collection(db, 'documents'), orderBy('created_at', 'desc'), limit(5)),
      (snapshot) => { setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }
    );

    return () => {
      unsubRecentPatients(); unsubAllPatients(); unsubAppointments(); unsubConsultations();
      unsubFileAttente(); unsubExams(); unsubPrescriptions(); unsubDocuments();
    };
  }, [appUser]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Stats file d'attente
  const fileActive = fileAttente.filter(e => e.statut !== 'termine' && e.statut !== 'annule');
  const fileEnAttente = fileActive.filter(e => e.statut === 'en_attente').length;
  const filePreConsult = fileActive.filter(e => e.statut === 'en_pre_consultation').length;
  const fileEnConsult = fileActive.filter(e => e.statut === 'en_consultation').length;
  const fileTermines = fileAttente.filter(e => e.statut === 'termine').length;

  const prescriptionsToday = prescriptions.filter(p => p.date_prescription === todayStr);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pre_consultation': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Pré-consultation</span>;
      case 'en_attente': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">En salle d'attente</span>;
      case 'en_cours': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">En cours</span>;
      case 'terminee': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Terminée</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Inconnu</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Tableau de bord opérationnel</h1>
        <div className="text-sm text-slate-500">Bonjour, {appUser?.prenom} {appUser?.nom} ({appUser?.role})</div>
      </div>

      {/* Bloc activité du jour */}
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-4">Activité du jour</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">RDV du jour</dt>
            <dd className="mt-1 text-2xl font-semibold text-indigo-600">{appointments.length}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate flex items-center"><Clock className="h-4 w-4 mr-1 text-orange-500" />En attente</dt>
            <dd className="mt-1 text-2xl font-semibold text-orange-600">{fileEnAttente}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate flex items-center"><ClipboardList className="h-4 w-4 mr-1 text-yellow-500" />Pré-consult</dt>
            <dd className="mt-1 text-2xl font-semibold text-yellow-600">{filePreConsult}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate flex items-center"><Stethoscope className="h-4 w-4 mr-1 text-indigo-500" />En consultation</dt>
            <dd className="mt-1 text-2xl font-semibold text-blue-600">{fileEnConsult}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate flex items-center"><CheckCircle className="h-4 w-4 mr-1 text-green-500" />Terminés</dt>
            <dd className="mt-1 text-2xl font-semibold text-green-600">{fileTermines}</dd>
          </div>
          <Link to="/salle-attente" className="bg-indigo-50 overflow-hidden shadow rounded-lg border border-indigo-200 p-4 hover:bg-indigo-100 transition-colors">
            <dt className="text-sm font-medium text-indigo-700 truncate">Salle d'attente</dt>
            <dd className="mt-1 text-2xl font-semibold text-indigo-600">{fileActive.length} <span className="text-sm font-normal">en file</span></dd>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Salle d'attente mini */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-orange-500" />
              File d'attente
            </h2>
            <Link to="/salle-attente" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">
              Gérer <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            {fileActive.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Aucun patient en file d'attente.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {fileActive.slice(0, 8).map((entry) => {
                  const patient = patientsMap[entry.patient_id];
                  const statutLabels: Record<string, string> = {
                    en_attente: 'En attente', en_pre_consultation: 'Pré-consult', pret: 'Prêt', en_consultation: 'En consultation'
                  };
                  const statutColors: Record<string, string> = {
                    en_attente: 'bg-orange-100 text-orange-800', en_pre_consultation: 'bg-yellow-100 text-yellow-800',
                    pret: 'bg-blue-100 text-blue-800', en_consultation: 'bg-indigo-100 text-indigo-800'
                  };
                  return (
                    <li key={entry.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-indigo-600">{entry.numero_ordre}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{patient ? `${patient.nom} ${patient.prenom}` : 'Inconnu'}</p>
                            <p className="text-xs text-slate-500">{entry.heure_arrivee} {entry.motif ? `• ${entry.motif}` : ''}</p>
                          </div>
                        </div>
                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statutColors[entry.statut] || 'bg-slate-100 text-slate-700')}>
                          {statutLabels[entry.statut] || entry.statut}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Consultations du jour */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-indigo-500" />
              Consultations du jour
            </h2>
            <Link to="/consultations" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            {consultations.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Aucune consultation aujourd'hui.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {consultations.map(c => {
                  const patient = patientsMap[c.patient_id];
                  return (
                    <li key={c.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center"><User className="h-5 w-5 text-indigo-600" /></div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-slate-900">{patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}</p>
                            <p className="text-xs text-slate-500">{c.motif || 'Motif non précisé'}</p>
                          </div>
                        </div>
                        <div>{getStatusBadge(c.statutConsultation)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Patients récents */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center"><Users className="h-5 w-5 mr-2 text-emerald-500" />Patients récents</h2>
            <Link to="/patients" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">Voir tout <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </div>
          <div className="p-4 border-b border-slate-100 bg-white flex space-x-4">
            <div className="flex-1 text-center">
              <span className="block text-2xl font-semibold text-slate-700">{patientStats.nouveaux}</span>
              <span className="block text-xs text-slate-500 uppercase tracking-wider">Nouveaux</span>
            </div>
            <div className="flex-1 text-center border-l border-slate-200">
              <span className="block text-2xl font-semibold text-slate-700">{patientStats.habituels}</span>
              <span className="block text-xs text-slate-500 uppercase tracking-wider">Habituels</span>
            </div>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <ul className="divide-y divide-slate-200">
              {recentPatients.slice(0, 5).map(p => (
                <li key={p.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <UserPlus className="h-5 w-5 text-slate-400 mr-3" />
                      <div>
                        <Link to={`/patients/${p.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900">{p.nom} {p.prenom}</Link>
                        <p className="text-xs text-slate-500">{p.telephone || 'Sans téléphone'}</p>
                      </div>
                    </div>
                    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", p.statutPatient === 'nouveau_patient' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800')}>
                      {p.statutPatient === 'nouveau_patient' ? 'Nouveau' : 'Habituel'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Examens récents */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center"><FileText className="h-5 w-5 mr-2 text-amber-500" />Examens récents</h2>
            <Link to="/exams" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">Voir tout <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <ul className="divide-y divide-slate-200">
              {exams.map(e => {
                const patient = patientsMap[e.patient_id];
                const status = e.statutExamen || 'demande';
                let statusColor = 'bg-slate-100 text-slate-800', statusLabel = status;
                if (status === 'demande') { statusColor = 'bg-yellow-100 text-yellow-800'; statusLabel = 'Demandé'; }
                else if (status === 'en_attente_resultat') { statusColor = 'bg-blue-100 text-blue-800'; statusLabel = 'En attente'; }
                else if (status === 'apporte') { statusColor = 'bg-purple-100 text-purple-800'; statusLabel = 'Apporté'; }
                else if (status === 'analyse') { statusColor = 'bg-green-100 text-green-800'; statusLabel = 'Analysé'; }
                return (
                  <li key={e.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{e.nom_examen || e.type_examen}</p>
                        <p className="text-xs text-slate-500">Patient: {patient ? `${patient.nom} ${patient.prenom}` : 'Inconnu'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{e.date_examen}</p>
                        <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1", statusColor)}>{statusLabel}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
              {exams.length === 0 && <li className="p-6 text-center text-slate-500 text-sm">Aucun examen récent.</li>}
            </ul>
          </div>
        </div>

        {/* Ordonnances récentes */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center"><FileSignature className="h-5 w-5 mr-2 text-purple-500" />Ordonnances récentes</h2>
            <Link to="/prescriptions" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">Voir tout <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </div>
          <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
            <div className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{prescriptionsToday.length}</span> ordonnances aujourd'hui</div>
            <Link to="/prescriptions" className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">Nouvelle ordonnance</Link>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <ul className="divide-y divide-slate-200">
              {prescriptions.map(p => {
                const patient = patientsMap[p.patient_id];
                return (
                  <li key={p.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}</p>
                        <p className="text-xs text-slate-500">{p.medicaments?.length || 0} médicament(s)</p>
                      </div>
                      <div className="text-right"><p className="text-xs text-slate-500">{p.date_prescription}</p></div>
                    </div>
                  </li>
                );
              })}
              {prescriptions.length === 0 && <li className="p-6 text-center text-slate-500 text-sm">Aucune ordonnance récente.</li>}
            </ul>
          </div>
        </div>

        {/* Documents récents */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col lg:col-span-2">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center"><Files className="h-5 w-5 mr-2 text-cyan-500" />Derniers documents</h2>
            <Link to="/documents" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">Voir tout <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </div>
          <div className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              {documents.map(d => {
                const patient = patientsMap[d.patient_id];
                return (
                  <div key={d.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileText className="h-6 w-6 text-slate-400" />
                      <p className="text-sm font-medium text-slate-900 truncate" title={d.titre || d.nom || d.type_document || d.typeDocument || d.nom_document || 'Document'}>{d.titre || d.nom || d.type_document || d.typeDocument || d.nom_document || 'Document'}</p>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}</p>
                    <p className="text-xs text-slate-400 mt-1">{d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '-'}</p>
                  </div>
                );
              })}
              {documents.length === 0 && <div className="p-4 text-sm text-slate-500 col-span-full text-center">Aucun document récent.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
