import React, { useEffect, useMemo, useState } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar, Users, Activity, AlertCircle, FileText, Pill,
  Clock, CheckCircle, UserPlus, FileSignature, Files, ChevronRight, User, Stethoscope, ClipboardList,
  PlayCircle, ArrowRight, Wallet, FlaskConical, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { FileAttenteEntry } from '../types';
import KpiCard from '../components/dashboard/KpiCard';

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
  // Pour KPIs (30 derniers jours)
  const [consultations30, setConsultations30]   = useState<any[]>([]);
  const [payments30, setPayments30]             = useState<any[]>([]);
  const [examsAll, setExamsAll]                 = useState<any[]>([]);
  const [allPayments, setAllPayments]           = useState<any[]>([]);
  const [tomorrowAppts, setTomorrowAppts]       = useState<any[]>([]);
  const [allConsultations, setAllConsultations] = useState<any[]>([]);

  useEffect(() => {
    if (!appUser) return;

    // ⚠️ NE PAS utiliser setHours(0,0,0,0)+toISOString() → donne la veille en UTC+1
    const todayStr = dateFnsFormat(new Date(), 'yyyy-MM-dd');

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

    // Consultations des 30 derniers jours (pour sparklines + KPIs)
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const d30Str = d30.toISOString().split('T')[0];
    const unsubCons30 = onSnapshot(
      query(collection(db, 'consultations'), where('date_consultation', '>=', d30Str)),
      (snap) => setConsultations30(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {} // ignore erreurs index
    );

    // Paiements (tous, pour impayés + agrégats)
    const unsubPayAll = onSnapshot(
      query(collection(db, 'payments')),
      (snap) => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setAllPayments(all);
        setPayments30(all.filter(p => (p.date_paiement || p.date || '') >= d30Str));
      }
    );

    // Examens (tous) pour KPI "à relire"
    const unsubExAll = onSnapshot(
      query(collection(db, 'exams')),
      (snap) => setExamsAll(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // RDV de demain (alertes L3)
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
    const unsubTomorrow = onSnapshot(
      query(collection(db, 'appointments'), where('date_rdv', '==', tomorrowStr)),
      (snap) => setTomorrowAppts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // Toutes les consultations (pour alertes sans CR)
    const unsubAllCons = onSnapshot(
      query(collection(db, 'consultations'), where('statutConsultation', '==', 'terminee')),
      (snap) => setAllConsultations(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    return () => {
      unsubRecentPatients(); unsubAllPatients(); unsubAppointments(); unsubConsultations();
      unsubFileAttente(); unsubExams(); unsubPrescriptions(); unsubDocuments();
      unsubCons30(); unsubPayAll(); unsubExAll(); unsubTomorrow(); unsubAllCons();
    };
  }, [appUser]);

  const todayStr = dateFnsFormat(new Date(), 'yyyy-MM-dd');

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

  // ────────────────────────────────────────────────────────────────
  // KPIs du jour + sparklines 7j
  // ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    // 7 derniers jours (J-6 … J)
    const daysISO: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      daysISO.push(d.toISOString().split('T')[0]);
    }
    const paidStatuts = new Set(['payé', 'paye', 'réglé', 'regle', 'regle_partiel', 'réglé_partiel']);

    // Consultations terminées par jour
    const consParDate: Record<string, number> = {};
    let consVuesAuj = 0;
    for (const c of consultations30) {
      const d = c.date_consultation;
      if (!d) continue;
      const isTerm = c.statutConsultation === 'terminee';
      if (!isTerm) continue;
      consParDate[d] = (consParDate[d] || 0) + 1;
      if (d === todayStr) consVuesAuj++;
    }
    const seriesPatients = daysISO.map(d => consParDate[d] || 0);
    const moyPatients7   = seriesPatients.slice(0, -1).reduce((a, b) => a + b, 0) / 6 || 0;

    // CA par jour (payments réglés)
    const caParDate: Record<string, number> = {};
    let caAuj   = 0;
    for (const p of payments30) {
      if (!paidStatuts.has((p.statut_paiement || '').toLowerCase())) continue;
      const d = p.date_paiement || p.date;
      if (!d) continue;
      const m = Number(p.montant) || 0;
      caParDate[d] = (caParDate[d] || 0) + m;
      if (d === todayStr) caAuj += m;
    }
    const seriesCA = daysISO.map(d => caParDate[d] || 0);
    const moyCA7   = seriesCA.slice(0, -1).reduce((a, b) => a + b, 0) / 6 || 0;

    // Impayés (tous statuts)
    const impayes = allPayments.filter(p => {
      const s = (p.statut_paiement || '').toLowerCase();
      return s && !paidStatuts.has(s);
    });
    const impayesMontant = impayes.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);

    // Examens à relire (apportés ou en attente de résultat)
    const examsALire = examsAll.filter(e => {
      const s = e.statut || e.statutExamen || '';
      return s === 'apporte' || s === 'en_attente_resultat';
    });

    return {
      consVuesAuj,
      seriesPatients,
      moyPatients7,
      caAuj,
      seriesCA,
      moyCA7,
      impayesCount: impayes.length,
      impayesMontant,
      examsALireCount: examsALire.length,
      examsDemandeCount: examsAll.filter(e => (e.statut || e.statutExamen) === 'demandé').length,
    };
  }, [consultations30, payments30, allPayments, examsAll, todayStr]);

  const formatMAD = (n: number) =>
    new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(n) + ' MAD';

  // ────────────────────────────────────────────────────────────────
  // L3 — Alertes actionnables
  // ────────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const paidStatuts = new Set(['payé', 'paye', 'réglé', 'regle']);

    // 🔴 Urgent — consultations terminées sans diagnostic
    const sansCR = allConsultations
      .filter(c => !c.diagnostic_principal || c.diagnostic_principal.trim() === '')
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        label: (patientsMap[c.patient_id] ? `${patientsMap[c.patient_id].nom} ${patientsMap[c.patient_id].prenom}` : 'Patient'),
        sub:   `Consultation du ${new Date(c.date_consultation + 'T12:00:00').toLocaleDateString('fr-FR')} — sans diagnostic`,
        href:  `/patients/${c.patient_id}?tab=consultations`,
        icon:  'stethoscope',
      }));

    // 🔴 Urgent — examens demandés > 15j sans résultat
    const examsRetard = examsAll
      .filter(e => {
        const s = e.statut || e.statutExamen || '';
        if (s !== 'demandé') return false;
        const d = e.date_demande || e.date_examen;
        if (!d) return false;
        return (Date.now() - new Date(d).getTime()) > 15 * 86400000;
      })
      .slice(0, 5)
      .map(e => ({
        id:   e.id,
        label: e.nom_examen || e.type_examen,
        sub:  `${patientsMap[e.patient_id] ? patientsMap[e.patient_id].nom + ' ' + patientsMap[e.patient_id].prenom : 'Patient'} — demandé il y a ${Math.floor((Date.now() - new Date(e.date_demande || e.date_examen).getTime()) / 86400000)}j`,
        href: `/patients/${e.patient_id}?tab=exams`,
        icon: 'flask',
      }));

    // 🔴 Urgent — impayés > 30j
    const impayes30j = allPayments
      .filter(p => {
        const s = (p.statut_paiement || '').toLowerCase();
        if (!s || paidStatuts.has(s)) return false;
        const d = p.date_paiement || p.date || p.created_at;
        if (!d) return false;
        return (Date.now() - new Date(d).getTime()) > 30 * 86400000;
      })
      .slice(0, 5)
      .map(p => ({
        id:    p.id,
        label: `${formatMAD(Number(p.montant) || 0)} — ${patientsMap[p.patient_id] ? patientsMap[p.patient_id].nom + ' ' + patientsMap[p.patient_id].prenom : 'Patient'}`,
        sub:   `Impayé depuis > 30 jours`,
        href:  `/payments`,
        icon:  'wallet',
      }));

    // 🟡 Suivi — résultats d'examens apportés à lire
    const resultatsALire = examsAll
      .filter(e => (e.statut || e.statutExamen) === 'apporte')
      .slice(0, 5)
      .map(e => ({
        id:    e.id,
        label: e.nom_examen || e.type_examen,
        sub:   patientsMap[e.patient_id] ? `${patientsMap[e.patient_id].nom} ${patientsMap[e.patient_id].prenom}` : 'Patient',
        href:  `/patients/${e.patient_id}?tab=exams`,
        icon:  'flask',
      }));

    // 🔵 RDV demain non confirmés
    const rdvDemainNonConf = tomorrowAppts
      .filter(a => !['confirmé', 'confirme', 'en_salle'].includes(a.statut || ''))
      .slice(0, 5)
      .map(a => ({
        id:    a.id,
        label: patientsMap[a.patient_id] ? `${patientsMap[a.patient_id].nom} ${patientsMap[a.patient_id].prenom}` : 'Patient',
        sub:   `Demain ${a.heure_rdv ? 'à ' + a.heure_rdv : ''} — ${a.motif || 'sans motif'}`,
        href:  `/appointments`,
        icon:  'calendar',
      }));

    return { sansCR, examsRetard, impayes30j, resultatsALire, rdvDemainNonConf };
  }, [allConsultations, examsAll, allPayments, tomorrowAppts, patientsMap]);

  const totalUrgent = alerts.sansCR.length + alerts.examsRetard.length + alerts.impayes30j.length;
  const totalSuivi  = alerts.resultatsALire.length;
  const totalRdv    = alerts.rdvDemainNonConf.length;

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

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* KPIs du jour — sparklines 7j + comparatif vs moyenne              */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Indicateurs clés</h2>
            <p className="text-xs text-slate-500">Aujourd'hui · tendance sur 7 jours</p>
          </div>
          <Link to="/stats" className="text-xs text-indigo-600 hover:text-indigo-900 font-medium hidden sm:inline-flex items-center">
            Statistiques détaillées <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Patients vus aujourd'hui"
            value={kpis.consVuesAuj}
            icon={<Users className="w-4 h-4" />}
            accent="indigo"
            series={kpis.seriesPatients}
            comparison={{ current: kpis.consVuesAuj, reference: kpis.moyPatients7 }}
            subtitle={kpis.moyPatients7 > 0 ? `Moy. 7j : ${kpis.moyPatients7.toFixed(1)} / jour` : 'Aucun historique 7j'}
          />
          <KpiCard
            label="CA encaissé aujourd'hui"
            value={formatMAD(kpis.caAuj)}
            icon={<Wallet className="w-4 h-4" />}
            accent="emerald"
            series={kpis.seriesCA}
            comparison={{ current: kpis.caAuj, reference: kpis.moyCA7 }}
            subtitle={kpis.moyCA7 > 0 ? `Moy. 7j : ${formatMAD(kpis.moyCA7)}` : 'Aucun encaissement 7j'}
          />
          <KpiCard
            label="Impayés en cours"
            value={kpis.impayesCount}
            icon={<AlertCircle className="w-4 h-4" />}
            accent={kpis.impayesCount > 0 ? 'rose' : 'emerald'}
            subtitle={kpis.impayesMontant > 0 ? `${formatMAD(kpis.impayesMontant)} à recouvrer` : 'Aucun impayé 🎉'}
            subtitleColor={kpis.impayesCount > 0 ? 'red' : 'emerald'}
          />
          <KpiCard
            label="Examens à traiter"
            value={kpis.examsALireCount}
            icon={<FlaskConical className="w-4 h-4" />}
            accent="amber"
            subtitle={
              kpis.examsDemandeCount > 0
                ? `+ ${kpis.examsDemandeCount} demandé${kpis.examsDemandeCount > 1 ? 's' : ''} en attente`
                : 'Aucune demande en attente'
            }
            subtitleColor={kpis.examsALireCount > 0 ? 'amber' : 'slate'}
          />
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* L3 — Alertes actionnables                                        */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(totalUrgent > 0 || totalSuivi > 0 || totalRdv > 0) && (
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Actions requises</h2>
              <p className="text-xs text-slate-500">{totalUrgent + totalSuivi + totalRdv} point{(totalUrgent + totalSuivi + totalRdv) > 1 ? 's' : ''} à traiter</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* 🔴 Urgent */}
            {totalUrgent > 0 && (
              <div className="bg-white rounded-xl border-l-4 border-rose-500 border border-rose-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <h3 className="text-sm font-semibold text-rose-800">Urgent</h3>
                  <span className="ml-auto bg-rose-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalUrgent}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {alerts.sansCR.map(a => (
                    <li key={a.id}>
                      <Link to={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-rose-50 transition-colors group">
                        <Stethoscope className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-rose-700">{a.label}</p>
                          <p className="text-xs text-slate-500 truncate">{a.sub}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0 ml-auto" />
                      </Link>
                    </li>
                  ))}
                  {alerts.examsRetard.map(a => (
                    <li key={a.id}>
                      <Link to={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-rose-50 transition-colors group">
                        <Activity className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-rose-700">{a.label}</p>
                          <p className="text-xs text-slate-500 truncate">{a.sub}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0 ml-auto" />
                      </Link>
                    </li>
                  ))}
                  {alerts.impayes30j.map(a => (
                    <li key={a.id}>
                      <Link to={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-rose-50 transition-colors group">
                        <FileText className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-rose-700">{a.label}</p>
                          <p className="text-xs text-slate-500 truncate">{a.sub}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0 ml-auto" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 🟡 Suivi patient */}
            {totalSuivi > 0 && (
              <div className="bg-white rounded-xl border-l-4 border-amber-400 border border-amber-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-amber-800">Suivi patient</h3>
                  <span className="ml-auto bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalSuivi}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {alerts.resultatsALire.map(a => (
                    <li key={a.id}>
                      <Link to={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition-colors group">
                        <FileText className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-amber-700">{a.label}</p>
                          <p className="text-xs text-slate-500 truncate">{a.sub}</p>
                        </div>
                        <span className="flex-shrink-0 ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">À lire</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 🔵 RDV & relances */}
            {totalRdv > 0 && (
              <div className="bg-white rounded-xl border-l-4 border-sky-400 border border-sky-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-semibold text-sky-800">RDV demain</h3>
                  <span className="ml-auto bg-sky-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalRdv}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {alerts.rdvDemainNonConf.map(a => (
                    <li key={a.id}>
                      <Link to={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-sky-50 transition-colors group">
                        <User className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-sky-700">{a.label}</p>
                          <p className="text-xs text-slate-500 truncate">{a.sub}</p>
                        </div>
                        <span className="flex-shrink-0 ml-auto px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-semibold rounded-full">Non confirmé</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </div>
      )}

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
