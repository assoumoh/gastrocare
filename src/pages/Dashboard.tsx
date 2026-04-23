import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar, Users, Activity, AlertCircle, FileText, Pill,
  Clock, CheckCircle, UserPlus, FileSignature, Files, ChevronRight, User, Stethoscope, ClipboardList,
  PlayCircle, ArrowRight
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
  const filePrets = fileActive.filter(e => e.statut === 'pret').length;

  // Prochain patient : priorité "pret" > "en_pre_consultation" > "en_attente", par numero_ordre croissant
  const priorityOrder: Record<string, number> = { pret: 0, en_pre_consultation: 1, en_attente: 2, en_consultation: 3 };
  const nextPatient = [...fileActive].sort((a, b) => {
    const pa = priorityOrder[a.statut] ?? 99;
    const pb = priorityOrder[b.statut] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.numero_ordre - b.numero_ordre;
  })[0];
  const nextPatientData = nextPatient ? patientsMap[nextPatient.patient_id] : null;

  const nextStatutLabel: Record<string, string> = {
    pret:                 'Prêt à consulter',
    en_pre_consultation:  'En pré-consultation',
    en_attente:           'En attente',
    en_consultation:      'Déjà en consultation',
  };
  const nextStatutColor: Record<string, string> = {
    pret:                 'bg-emerald-100 text-emerald-700 border-emerald-200',
    en_pre_consultation:  'bg-amber-100 text-amber-700 border-amber-200',
    en_attente:           'bg-orange-100 text-orange-700 border-orange-200',
    en_consultation:      'bg-indigo-100 text-indigo-700 border-indigo-200',
  };

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

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* HERO "Maintenant" — prochain patient + mini-stats file d'attente    */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-lg">
        {/* Décoration */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-300/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-100">Maintenant · Temps réel</span>
            </div>
            <span className="text-xs text-indigo-100">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Col 1-2 : Prochain patient */}
            <div className="lg:col-span-2">
              {nextPatient ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-indigo-200 mb-1">Prochain patient</p>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <span className="text-2xl font-bold">{nextPatient.numero_ordre}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl sm:text-3xl font-bold leading-tight truncate">
                        {nextPatientData ? `${nextPatientData.nom} ${nextPatientData.prenom}` : 'Patient inconnu'}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${nextStatutColor[nextPatient.statut] || 'bg-white/10 text-white border-white/20'}`}>
                          {nextStatutLabel[nextPatient.statut] || nextPatient.statut}
                        </span>
                        <span className="text-sm text-indigo-100">
                          Arrivée {nextPatient.heure_arrivee || '—'}
                        </span>
                        {nextPatient.motif && (
                          <span className="text-sm text-indigo-100">· {nextPatient.motif}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Link
                          to={`/patients/${nextPatient.patient_id}?consultationMode=active&tab=consultations`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 rounded-lg text-sm font-semibold shadow hover:bg-indigo-50 transition-colors"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Démarrer la consultation
                        </Link>
                        <Link
                          to="/salle-attente"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm border border-white/30 rounded-lg text-sm font-medium hover:bg-white/25 transition-colors"
                        >
                          Voir la file
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 py-2">
                  <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                    <CheckCircle className="w-7 h-7 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Aucun patient en file</h2>
                    <p className="text-sm text-indigo-100 mt-0.5">
                      {fileTermines > 0
                        ? `Journée en cours : ${fileTermines} consultation${fileTermines > 1 ? 's' : ''} terminée${fileTermines > 1 ? 's' : ''}.`
                        : 'La file d\'attente est vide pour le moment.'}
                    </p>
                    <Link to="/salle-attente" className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-white hover:underline">
                      Accéder à la salle d'attente <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Col 3 : mini-stats file */}
            <div className="grid grid-cols-2 gap-2 content-start">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/15">
                <div className="flex items-center gap-1.5 text-xs text-indigo-100 mb-1">
                  <Clock className="w-3.5 h-3.5" /> En attente
                </div>
                <div className="text-2xl font-bold">{fileEnAttente}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/15">
                <div className="flex items-center gap-1.5 text-xs text-indigo-100 mb-1">
                  <ClipboardList className="w-3.5 h-3.5" /> Pré-consult
                </div>
                <div className="text-2xl font-bold">{filePreConsult}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/15">
                <div className="flex items-center gap-1.5 text-xs text-indigo-100 mb-1">
                  <Stethoscope className="w-3.5 h-3.5" /> En consult.
                </div>
                <div className="text-2xl font-bold">{fileEnConsult}</div>
              </div>
              <div className="bg-emerald-400/20 backdrop-blur-sm rounded-lg p-3 border border-emerald-300/30">
                <div className="flex items-center gap-1.5 text-xs text-emerald-100 mb-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Terminés
                </div>
                <div className="text-2xl font-bold">{fileTermines}</div>
              </div>
              {filePrets > 0 && (
                <div className="col-span-2 bg-emerald-500/30 backdrop-blur-sm rounded-lg p-2.5 border border-emerald-300/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-50">
                      ⚡ {filePrets} patient{filePrets > 1 ? 's' : ''} prêt{filePrets > 1 ? 's' : ''} à consulter
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
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
