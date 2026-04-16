import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Calendar, FileText, Pill, CreditCard, Activity, Sparkles, Edit, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import PatientForm from '../components/patients/PatientForm';
import PatientExams from '../components/patients/PatientExams';
import PatientPrescriptions from '../components/patients/PatientPrescriptions';
import PatientDocuments from '../components/patients/PatientDocuments';
import PatientConsultations from '../components/patients/PatientConsultations';
import PatientFinance from '../components/patients/PatientFinance';
import ConsultationForm from '../components/consultations/ConsultationForm';
import { useAuth } from '../contexts/AuthContext';

const allTabs = [
  { name: 'Informations', id: 'info', icon: User },
  { name: 'Consultations', id: 'consultations', icon: Activity },
  { name: 'Examens', id: 'exams', icon: FileText },
  { name: 'Ordonnances', id: 'prescriptions', icon: Pill },
  { name: 'Documents', id: 'documents', icon: FileText },
  { name: 'Paiement', id: 'finance', icon: CreditCard },
];

// *** CHANGEMENT 1 : Ajout Consultations + Ordonnances pour l'assistante ***
const assistanteTabs = [
  { name: 'Informations', id: 'info', icon: User },
  { name: 'Consultations', id: 'consultations', icon: Activity },
  { name: 'Ordonnances', id: 'prescriptions', icon: Pill },
  { name: 'Paiement', id: 'finance', icon: CreditCard },
];

// *** CHANGEMENT 2 : Mapping des noms d'URL vers les IDs d'onglet ***
const TAB_ALIASES: Record<string, string> = {
  ordonnances: 'prescriptions',
  examens: 'exams',
  paiements: 'finance',
  paiement: 'finance',
};

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patient, setPatient] = useState<any>(null);

  // *** CHANGEMENT 3 : Résoudre l'alias du tab au montage ***
  const rawTab = searchParams.get('tab') || 'info';
  const resolvedTab = TAB_ALIASES[rawTab] || rawTab;
  const [activeTab, setActiveTab] = useState(resolvedTab);

  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConsultationFormOpen, setIsConsultationFormOpen] = useState(false);
  const { appUser } = useAuth();

  const isAssistante = appUser?.role === 'assistante';
  const tabs = isAssistante ? assistanteTabs : allTabs;

  // Sync tab from URL search params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const resolved = TAB_ALIASES[tabParam] || tabParam;
      if (tabs.some((t) => t.id === resolved)) {
        setActiveTab(resolved);
      }
    }
  }, [searchParams, tabs]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'patients', id), (docSnap) => {
      if (docSnap.exists()) {
        setPatient({ id: docSnap.id, ...docSnap.data() });
      } else {
        setPatient(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Erreur chargement patient:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Chargement...</div>;
  if (!patient) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <p className="text-slate-500">Patient introuvable</p>
      <button onClick={() => navigate('/patients')} className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
        Retour à la liste des patients
      </button>
    </div>
  );

  const isDeleted = patient.deleted === true;

  return (
    <div className="space-y-6">
      {isDeleted && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="ml-3 text-sm text-red-700 font-medium">
              Ce patient a été supprimé. Ses données sont conservées pour l'historique.
            </p>
            <button onClick={() => navigate('/patients')} className="ml-auto text-sm font-medium text-red-700 hover:text-red-600">
              Retour à la liste
            </button>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center">
              {patient.nom} {patient.prenom}
              {patient.statutPatient === 'patient_habituel' ? (
                <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Patient habituel</span>
              ) : (
                <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Nouveau patient</span>
              )}
              {!isDeleted && (
                <button onClick={() => setIsEditOpen(true)} className="ml-3 text-slate-400 hover:text-indigo-600">
                  <Edit className="h-4 w-4" />
                </button>
              )}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              {(patient.id_patient || patient.num_dossier) && `ID: ${patient.id_patient || patient.num_dossier} • `}
              {patient.telephone} • {patient.sexe} • {patient.date_naissance}
            </p>
          </div>
          <div className="flex space-x-3">
            {!isAssistante && (
              <button className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
                <Sparkles className="mr-2 h-4 w-4 text-indigo-500" />Résumé IA
              </button>
            )}
            {!isDeleted && !isAssistante && (
              <button
                onClick={() => setIsConsultationFormOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Nouvelle Consultation
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-slate-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                  'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm'
                )}
              >
                <tab.icon
                  className={clsx(
                    activeTab === tab.id ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-500',
                    '-ml-0.5 mr-2 h-5 w-5'
                  )}
                />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'info' && (
          <div className="space-y-8">
            {/* Identité & Contact */}
            <div>
              <h4 className="text-base font-medium text-slate-900 border-b pb-2 mb-4">Identité & Contact</h4>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
                <div><dt className="text-sm font-medium text-slate-500">Date de naissance</dt><dd className="mt-1 text-sm text-slate-900">{patient.date_naissance || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">Sexe</dt><dd className="mt-1 text-sm text-slate-900">{patient.sexe || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">CIN</dt><dd className="mt-1 text-sm text-slate-900">{patient.cin || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">Téléphone</dt><dd className="mt-1 text-sm text-slate-900">{patient.telephone || '-'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Adresse</dt><dd className="mt-1 text-sm text-slate-900">{patient.adresse || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">Profession</dt><dd className="mt-1 text-sm text-slate-900">{patient.profession || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">Statut Familial</dt><dd className="mt-1 text-sm text-slate-900">{patient.statut_familial || '-'}</dd></div>
              </dl>
            </div>

            {/* Informations Administratives */}
            <div>
              <h4 className="text-base font-medium text-slate-900 border-b pb-2 mb-4">Informations Administratives</h4>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
                <div><dt className="text-sm font-medium text-slate-500">ID Patient</dt><dd className="mt-1 text-sm text-slate-900">{patient.id_patient || patient.num_dossier || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">Mutuelle</dt><dd className="mt-1 text-sm text-slate-900">{patient.mutuelle || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">AMO</dt><dd className="mt-1 text-sm text-slate-900">{patient.amo || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">N° CNSS</dt><dd className="mt-1 text-sm text-slate-900">{patient.num_cnss || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-slate-500">Origine Patient</dt><dd className="mt-1 text-sm text-slate-900">{patient.origine_patient || '-'}{patient.detail_origine && ` (${patient.detail_origine})`}</dd></div>
              </dl>
            </div>

            {/* Données Médicales */}
            {!isAssistante && (
              <div>
                <h4 className="text-base font-medium text-slate-900 border-b pb-2 mb-4">Données Médicales</h4>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div><dt className="text-sm font-medium text-slate-500">Allergies</dt><dd className="mt-1 text-sm text-red-600 font-medium">{patient.allergies || 'Aucune'}</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Poids (kg)</dt><dd className="mt-1 text-sm text-slate-900">{patient.poids || '-'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Antécédents Médicaux</dt><dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{patient.antecedents_medicaux || 'Aucun'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Antécédents Personnels</dt><dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{patient.antecedents_personnels || patient.antecedents_digestifs || 'Aucun'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Antécédents Familiaux</dt><dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{patient.antecedents_familiaux || 'Aucun'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Antécédents Chirurgicaux</dt><dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{patient.antecedents_chirurgicaux || 'Aucun'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Habitudes Toxiques</dt><dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{patient.habitudes_toxiques || 'Aucune'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Traitement en cours</dt><dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{patient.traitement_en_cours || patient.traitements_chroniques || 'Aucun'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-500">Observations Médecin</dt><dd className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{patient.observations_medecin || 'Aucune'}</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Suivi Long Terme</dt><dd className="mt-1 text-sm text-slate-900">{patient.suivi_long_terme || 'Non'}</dd></div>
                </dl>
              </div>
            )}

            {/* Pré-consultation visible pour assistante */}
            {isAssistante && (
              <div>
                <h4 className="text-base font-medium text-slate-900 border-b pb-2 mb-4">Données Pré-consultation</h4>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div><dt className="text-sm font-medium text-slate-500">Allergies</dt><dd className="mt-1 text-sm text-red-600 font-medium">{patient.allergies || 'Aucune'}</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Poids (kg)</dt><dd className="mt-1 text-sm text-slate-900">{patient.poids || '-'}</dd></div>
                </dl>
              </div>
            )}
          </div>
        )}

        {activeTab === 'consultations' && <PatientConsultations patientId={patient.id} />}
        {activeTab === 'exams' && <PatientExams patientId={patient.id} />}
        {activeTab === 'prescriptions' && <PatientPrescriptions patientId={patient.id} />}
        {activeTab === 'documents' && <PatientDocuments patientId={patient.id} />}
        {activeTab === 'finance' && <PatientFinance patientId={patient.id} />}
      </div>

      {isEditOpen && <PatientForm patient={patient} onClose={() => setIsEditOpen(false)} />}
      {isConsultationFormOpen && <ConsultationForm patientId={patient.id} onClose={() => setIsConsultationFormOpen(false)} />}
    </div>
  );
}
