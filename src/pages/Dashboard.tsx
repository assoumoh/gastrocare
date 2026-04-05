import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, Users, Activity, AlertCircle, FileText, Pill, 
  Clock, CheckCircle, UserPlus, FileSignature, Files, ChevronRight, User
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function Dashboard() {
  const { appUser } = useAuth();
  
  // State for all data
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!appUser) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Fetch Patients
    const unsubPatients = onSnapshot(query(collection(db, 'patients'), orderBy('created_at', 'desc')), (snapshot) => {
      const pts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(pts);
      const pMap: Record<string, any> = {};
      pts.forEach(p => { pMap[p.id] = p; });
      setPatientsMap(pMap);
    });

    // Fetch Appointments (Today)
    const unsubAppointments = onSnapshot(query(collection(db, 'appointments'), where('date_rdv', '==', todayStr)), (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Consultations
    const unsubConsultations = onSnapshot(query(collection(db, 'consultations'), orderBy('date_consultation', 'desc'), limit(50)), (snapshot) => {
      setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Exams
    const unsubExams = onSnapshot(query(collection(db, 'exams'), orderBy('created_at', 'desc'), limit(20)), (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Prescriptions
    const unsubPrescriptions = onSnapshot(query(collection(db, 'prescriptions'), orderBy('date_prescription', 'desc'), limit(20)), (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Documents
    const unsubDocuments = onSnapshot(query(collection(db, 'documents'), orderBy('date_ajout', 'desc'), limit(20)), (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPatients();
      unsubAppointments();
      unsubConsultations();
      unsubExams();
      unsubPrescriptions();
      unsubDocuments();
    };
  }, [appUser]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Derived stats
  const consultationsToday = consultations.filter(c => c.date_consultation === todayStr);
  const preConsultations = consultationsToday.filter(c => c.statutConsultation === 'pre_consultation');
  const enAttente = consultationsToday.filter(c => c.statutConsultation === 'en_attente');
  const enCours = consultationsToday.filter(c => c.statutConsultation === 'en_cours');
  const terminees = consultationsToday.filter(c => c.statutConsultation === 'terminee');

  const newPatients = patients.filter(p => p.statutPatient === 'nouveau_patient');
  const regularPatients = patients.filter(p => p.statutPatient === 'patient_habituel');
  const recentPatients = patients.slice(0, 5);

  const examsPending = exams.filter(e => !e.resultat);
  const recentExams = exams.slice(0, 5);

  const prescriptionsToday = prescriptions.filter(p => p.date_prescription === todayStr);
  const recentPrescriptions = prescriptions.slice(0, 5);

  const recentDocuments = documents.slice(0, 5);

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
        <div className="text-sm text-slate-500">
          Bonjour, {appUser?.prenom} {appUser?.nom} ({appUser?.role})
        </div>
      </div>

      {/* A. Bloc activité du jour */}
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-4">Activité du jour</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">Patients du jour</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-900">{appointments.length}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">RDV du jour</dt>
            <dd className="mt-1 text-2xl font-semibold text-indigo-600">{appointments.length}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">Pré-consultations</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-600">{preConsultations.length}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">En salle d'attente</dt>
            <dd className="mt-1 text-2xl font-semibold text-orange-600">{enAttente.length}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">En cours</dt>
            <dd className="mt-1 text-2xl font-semibold text-blue-600">{enCours.length}</dd>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200 p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">Terminées</dt>
            <dd className="mt-1 text-2xl font-semibold text-green-600">{terminees.length}</dd>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* G. Bloc parcours patient & B. Bloc consultations */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-indigo-500" />
              Parcours & Consultations du jour
            </h2>
            <Link to="/consultations" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            {consultationsToday.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Aucune consultation aujourd'hui.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {consultationsToday.map(c => {
                  const patient = patientsMap[c.patient_id];
                  return (
                    <li key={c.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-indigo-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-slate-900">
                              {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                            </p>
                            <p className="text-xs text-slate-500">{c.motif || 'Motif non précisé'}</p>
                          </div>
                        </div>
                        <div>
                          {getStatusBadge(c.statutConsultation)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* F. Bloc patients */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center">
              <Users className="h-5 w-5 mr-2 text-emerald-500" />
              Patients Récents
            </h2>
            <Link to="/patients" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-4 border-b border-slate-100 bg-white flex space-x-4">
            <div className="flex-1 text-center">
              <span className="block text-2xl font-semibold text-slate-700">{newPatients.length}</span>
              <span className="block text-xs text-slate-500 uppercase tracking-wider">Nouveaux</span>
            </div>
            <div className="flex-1 text-center border-l border-slate-200">
              <span className="block text-2xl font-semibold text-slate-700">{regularPatients.length}</span>
              <span className="block text-xs text-slate-500 uppercase tracking-wider">Habituels</span>
            </div>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <ul className="divide-y divide-slate-200">
              {recentPatients.map(p => (
                <li key={p.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <UserPlus className="h-5 w-5 text-slate-400 mr-3" />
                      <div>
                        <Link to={`/patients/${p.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900">
                          {p.nom} {p.prenom}
                        </Link>
                        <p className="text-xs text-slate-500">{p.telephone || 'Sans téléphone'}</p>
                      </div>
                    </div>
                    <span className={clsx(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      p.statutPatient === 'nouveau_patient' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    )}>
                      {p.statutPatient === 'nouveau_patient' ? 'Nouveau' : 'Habituel'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* C. Bloc examens */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-amber-500" />
              Examens Récents
            </h2>
            <Link to="/exams" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-100">
              <span className="block text-lg font-semibold text-yellow-700">{exams.filter(e => e.statutExamen === 'demande' || !e.statutExamen).length}</span>
              <span className="block text-[10px] text-yellow-600 uppercase tracking-wider">Demandés</span>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded border border-blue-100">
              <span className="block text-lg font-semibold text-blue-700">{exams.filter(e => e.statutExamen === 'en_attente_resultat').length}</span>
              <span className="block text-[10px] text-blue-600 uppercase tracking-wider">En attente</span>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded border border-purple-100">
              <span className="block text-lg font-semibold text-purple-700">{exams.filter(e => e.statutExamen === 'apporte').length}</span>
              <span className="block text-[10px] text-purple-600 uppercase tracking-wider">Apportés</span>
            </div>
            <div className="text-center p-2 bg-green-50 rounded border border-green-100">
              <span className="block text-lg font-semibold text-green-700">{exams.filter(e => e.statutExamen === 'analyse').length}</span>
              <span className="block text-[10px] text-green-600 uppercase tracking-wider">Analysés</span>
            </div>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <ul className="divide-y divide-slate-200">
              {recentExams.map(e => {
                const patient = patientsMap[e.patient_id];
                const status = e.statutExamen || 'demande';
                let statusColor = 'bg-slate-100 text-slate-800';
                let statusLabel = status;
                
                if (status === 'demande') { statusColor = 'bg-yellow-100 text-yellow-800'; statusLabel = 'Demandé'; }
                else if (status === 'en_attente_resultat') { statusColor = 'bg-blue-100 text-blue-800'; statusLabel = 'En attente'; }
                else if (status === 'apporte') { statusColor = 'bg-purple-100 text-purple-800'; statusLabel = 'Apporté'; }
                else if (status === 'analyse') { statusColor = 'bg-green-100 text-green-800'; statusLabel = 'Analysé'; }

                return (
                  <li key={e.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{e.nom_examen || e.type_examen}</p>
                        <p className="text-xs text-slate-500">
                          Patient: {patient ? `${patient.nom} ${patient.prenom}` : 'Inconnu'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{e.date_examen}</p>
                        <span className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1",
                          statusColor
                        )}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* D. Bloc ordonnances */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center">
              <FileSignature className="h-5 w-5 mr-2 text-purple-500" />
              Ordonnances Récentes
            </h2>
            <Link to="/prescriptions" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{prescriptionsToday.length}</span> ordonnances aujourd'hui
            </div>
            <Link to="/prescriptions" className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
              Nouvelle ordonnance
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <ul className="divide-y divide-slate-200">
              {recentPrescriptions.map(p => {
                const patient = patientsMap[p.patient_id];
                return (
                  <li key={p.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.medicaments?.length || 0} médicament(s) prescrit(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{p.date_prescription}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* E. Bloc documents */}
        <div className="bg-white shadow rounded-lg border border-slate-200 flex flex-col lg:col-span-2">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
            <h2 className="text-lg font-medium text-slate-900 flex items-center">
              <Files className="h-5 w-5 mr-2 text-cyan-500" />
              Derniers Documents
            </h2>
            <Link to="/documents" className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center">
              Voir tout <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              {recentDocuments.map(d => {
                const patient = patientsMap[d.patient_id];
                return (
                  <div key={d.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileText className="h-6 w-6 text-slate-400" />
                      <p className="text-sm font-medium text-slate-900 truncate" title={d.titre || d.nom || d.type_document || d.typeDocument || d.nom_document || 'Document'}>{d.titre || d.nom || d.type_document || d.typeDocument || d.nom_document || 'Document'}</p>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(d.date_ajout).toLocaleDateString('fr-FR')}</p>
                  </div>
                );
              })}
              {recentDocuments.length === 0 && (
                <div className="p-4 text-sm text-slate-500 col-span-full text-center">Aucun document récent.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
