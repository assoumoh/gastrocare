import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  Edit,
  User,
  FileText,
  Calendar,
  CreditCard,
  Stethoscope,
  Pill,
  FlaskConical,
  AlertTriangle,
  Weight,
} from 'lucide-react';
import PatientForm from '../components/patients/PatientForm';
import PatientConsultations from '../components/patients/PatientConsultations';
import PatientPrescriptions from '../components/patients/PatientPrescriptions';
import PatientExams from '../components/patients/PatientExams';
import PatientDocuments from '../components/patients/PatientDocuments';
import PatientPayments from '../components/patients/PatientPayments';

// Onglets pour chaque rôle
const MEDECIN_TABS = [
  { id: 'info', label: 'Informations', icon: User },
  { id: 'consultations', label: 'Consultations', icon: Stethoscope },
  { id: 'exams', label: 'Examens', icon: FlaskConical },
  { id: 'prescriptions', label: 'Ordonnances', icon: Pill },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'finance', label: 'Paiements', icon: CreditCard },
];

const ASSISTANTE_TABS = [
  { id: 'info', label: 'Informations', icon: User },
  { id: 'consultations', label: 'Consultations', icon: Stethoscope },
  { id: 'prescriptions', label: 'Ordonnances', icon: Pill },
  { id: 'finance', label: 'Paiements', icon: CreditCard },
];

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [showForm, setShowForm] = useState(false);

  const isAssistante = user?.role === 'assistante';
  const tabs = isAssistante ? ASSISTANTE_TABS : MEDECIN_TABS;

  // Charger le patient
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'patients', id),
      (snap) => {
        if (snap.exists()) {
          setPatient({ id: snap.id, ...snap.data() });
        } else {
          setError('Patient non trouvé.');
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Erreur lors du chargement du patient.');
        setLoading(false);
      }
    );
    return unsub;
  }, [id]);

  // Gérer le paramètre ?tab= dans l'URL
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab) {
      // Mapper les noms d'URL aux IDs d'onglet
      const tabMap: Record<string, string> = {
        info: 'info',
        informations: 'info',
        consultations: 'consultations',
        examens: 'exams',
        exams: 'exams',
        ordonnances: 'prescriptions',
        prescriptions: 'prescriptions',
        documents: 'documents',
        paiements: 'finance',
        finance: 'finance',
      };
      const mappedTab = tabMap[requestedTab.toLowerCase()] || requestedTab;
      // Vérifier que l'onglet est disponible pour le rôle
      if (tabs.some((t) => t.id === mappedTab)) {
        setActiveTab(mappedTab);
      }
    }
  }, [searchParams, tabs]);

  // Gérer le mode consultation active (depuis la salle d'attente)
  useEffect(() => {
    const mode = searchParams.get('consultationMode');
    if (mode === 'active') {
      setActiveTab('consultations');
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Chargement du patient...</span>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">{error || 'Patient non trouvé.'}</p>
        <button
          onClick={() => navigate('/patients')}
          className="mt-4 text-indigo-600 hover:underline"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  // Alerte patient supprimé (soft delete)
  const isDeleted = patient.actif === false || patient.deleted;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/patients')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {patient.nom} {patient.prenom}
            </h1>
            {isDeleted && (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Inactif
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
        >
          <Edit className="w-4 h-4" />
          Modifier
        </button>
      </div>

      {/* Section pré-consultation (visible par tous) */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          Informations pré-consultation
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Weight className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Poids</p>
              <p className="text-sm font-medium">{patient.poids ? `${patient.poids} kg` : '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Allergies</p>
            <p className="text-sm font-medium">{patient.allergies || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Groupe sanguin</p>
            <p className="text-sm font-medium">{patient.groupe_sanguin || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Antécédents</p>
            <p className="text-sm font-medium text-gray-600 truncate">
              {patient.antecedents || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenu onglet */}
      <div>
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Nom complet</p>
                <p className="font-medium">{patient.nom} {patient.prenom}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Date de naissance</p>
                <p className="font-medium">
                  {patient.date_naissance
                    ? new Date(patient.date_naissance).toLocaleDateString('fr-FR')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Téléphone</p>
                <p className="font-medium">{patient.telephone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium">{patient.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Adresse</p>
                <p className="font-medium">{patient.adresse || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">CIN / N° Dossier</p>
                <p className="font-medium">{patient.cin || patient.numero_dossier || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Mutuelle</p>
                <p className="font-medium">{patient.mutuelle || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Groupe sanguin</p>
                <p className="font-medium">{patient.groupe_sanguin || '—'}</p>
              </div>
            </div>
            {patient.allergies && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 uppercase">Allergies</p>
                <p className="text-sm text-red-800 mt-1">{patient.allergies}</p>
              </div>
            )}
            {patient.antecedents && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-yellow-700 uppercase">Antécédents</p>
                <p className="text-sm text-yellow-800 mt-1">{patient.antecedents}</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'consultations' && id && <PatientConsultations patientId={id} />}
        {activeTab === 'exams' && id && <PatientExams patientId={id} />}
        {activeTab === 'prescriptions' && id && <PatientPrescriptions patientId={id} />}
        {activeTab === 'documents' && id && <PatientDocuments patientId={id} />}
        {activeTab === 'finance' && id && <PatientPayments patientId={id} />}
      </div>

      {/* Formulaire édition patient */}
      {showForm && (
        <PatientForm
          patient={patient}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default PatientDetail;
