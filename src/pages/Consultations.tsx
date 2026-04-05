import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, User, Calendar, Stethoscope, Edit } from 'lucide-react';
import ConsultationForm from '../components/consultations/ConsultationForm';
import { Link } from 'react-router-dom';

const STATUT_BADGES: Record<string, { label: string, className: string }> = {
  'pre_consultation': { label: 'Pré-consultation', className: 'bg-yellow-100 text-yellow-800' },
  'en_attente': { label: 'En attente', className: 'bg-orange-100 text-orange-800' },
  'en_cours': { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
  'terminee': { label: 'Terminé', className: 'bg-green-100 text-green-800' },
};

export default function Consultations() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);

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
    const q = query(collection(db, 'consultations'), orderBy('date_consultation', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredConsultations = consultations.filter(c => {
    const patient = patients[c.patient_id];
    const patientName = patient ? `${patient.nom} ${patient.prenom}`.toLowerCase() : '';
    return patientName.includes(search.toLowerCase()) || c.motif?.toLowerCase().includes(search.toLowerCase());
  });

  const handleEdit = (consultation: any) => {
    setSelectedConsultation(consultation);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedConsultation(null);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Consultations</h1>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouvelle Consultation
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative rounded-md shadow-sm max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Rechercher par patient, motif..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ul className="divide-y divide-slate-200">
          {filteredConsultations.map((consultation) => {
            const patient = patients[consultation.patient_id];
            const statusInfo = STATUT_BADGES[consultation.statutConsultation || 'pre_consultation'];
            return (
              <li key={consultation.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <Stethoscope className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <span className={`mr-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                        <User className="mr-1.5 h-4 w-4 text-slate-400" />
                        <Link to={`/patients/${consultation.patient_id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900">
                          {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                        </Link>
                        {patient?.statutPatient === 'patient_habituel' ? (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Habituel
                          </span>
                        ) : patient?.statutPatient === 'nouveau_patient' ? (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            Nouveau
                          </span>
                        ) : null}
                        <span className="mx-2 text-slate-300">•</span>
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-500">
                          {new Date(consultation.date_consultation).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-900">
                        <span className="font-medium">Motif:</span> {consultation.motif || 'Non spécifié'}
                      </div>
                      {consultation.diagnostic_principal && (
                        <div className="mt-1 text-sm text-slate-600">
                          <span className="font-medium">Diagnostic:</span> {consultation.diagnostic_principal}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(consultation)}
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Modifier la consultation"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {filteredConsultations.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Aucune consultation trouvée.
            </li>
          )}
        </ul>
      </div>

      {isFormOpen && <ConsultationForm consultation={selectedConsultation} onClose={handleCloseForm} />}
    </div>
  );
}
