import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Eye, Printer, Edit, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import PrescriptionForm from '../components/prescriptions/PrescriptionForm';
import PrescriptionPrintView from '../components/prescriptions/PrescriptionPrintView';

const Prescriptions: React.FC = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [medicaments, setMedicaments] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [printPrescription, setPrintPrescription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Charger les patients
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'patients'), (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setPatients(map);
    });
    return unsub;
  }, []);

  // Charger les médicaments
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'medicaments'), (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setMedicaments(map);
    });
    return unsub;
  }, []);

  // Charger les prescriptions (dernières 50)
  useEffect(() => {
    let q;
    try {
      q = query(
        collection(db, 'prescriptions'),
        orderBy('date_prescription', 'desc'),
        limit(50)
      );
    } catch {
      q = query(collection(db, 'prescriptions'), limit(50));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Tri de secours côté client
        list.sort((a: any, b: any) => {
          const da = a.date_prescription || '';
          const db2 = b.date_prescription || '';
          return db2.localeCompare(da);
        });
        setPrescriptions(list);
        setLoading(false);
      },
      (error) => {
        console.error('Erreur chargement prescriptions:', error);
        // Fallback sans orderBy
        const fallbackQ = query(collection(db, 'prescriptions'), limit(50));
        onSnapshot(fallbackQ, (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => {
              const da = a.date_prescription || '';
              const db2 = b.date_prescription || '';
              return db2.localeCompare(da);
            });
          setPrescriptions(list);
          setLoading(false);
        });
      }
    );
    return unsub;
  }, []);

  // Filtrer par recherche
  const filtered = prescriptions.filter((p: any) => {
    if (!searchTerm) return true;
    const patient = patients[p.patient_id];
    const patientName = patient
      ? `${patient.nom || ''} ${patient.prenom || ''}`.toLowerCase()
      : '';
    return patientName.includes(searchTerm.toLowerCase());
  });

  const handleEdit = (prescription: any) => {
    setSelectedPrescription(prescription);
    setShowForm(true);
  };

  const handlePrint = (prescription: any) => {
    setPrintPrescription(prescription);
    setShowPrint(true);
  };

  const isAssistante = user?.role === 'assistante';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Chargement des ordonnances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordonnances</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} ordonnance{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
        {/* 
          BOUTON "Nouvelle ordonnance" SUPPRIMÉ de cette vue.
          La création se fait uniquement depuis Patient > Ordonnances.
        */}
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Rechercher par nom de patient..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Liste des ordonnances */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune ordonnance trouvée.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((prescription: any) => {
            const patient = patients[prescription.patient_id];
            const patientName = patient
              ? `${patient.nom || ''} ${patient.prenom || ''}`
              : 'Patient inconnu';

            return (
              <div
                key={prescription.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        to={`/patients/${prescription.patient_id}`}
                        className="text-base font-semibold text-indigo-600 hover:underline"
                      >
                        {patientName}
                      </Link>
                      <span className="text-xs text-gray-400">
                        {prescription.date_prescription
                          ? new Date(prescription.date_prescription).toLocaleDateString('fr-FR')
                          : '—'}
                      </span>
                    </div>

                    {/* Médicaments */}
                    {prescription.medicaments?.length > 0 && (
                      <div className="space-y-1">
                        {prescription.medicaments.map((med: any, idx: number) => {
                          const medData = medicaments[med.medicament_id];
                          return (
                            <div key={idx} className="text-sm text-gray-600">
                              <span className="font-medium">
                                {medData?.nomMedicament || med.nom || 'Médicament inconnu'}
                              </span>
                              {med.posologie && (
                                <span className="text-gray-400 ml-2">— {med.posologie}</span>
                              )}
                              {med.duree && (
                                <span className="text-gray-400 ml-1">({med.duree})</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {prescription.notes && (
                      <p className="text-xs text-gray-400 mt-2 italic">{prescription.notes}</p>
                    )}
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handlePrint(prescription)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Imprimer"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {!isAssistante && (
                      <button
                        onClick={() => handleEdit(prescription)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulaire (édition uniquement, pas de création) */}
      {showForm && (
        <PrescriptionForm
          prescription={selectedPrescription}
          onClose={() => {
            setShowForm(false);
            setSelectedPrescription(null);
          }}
        />
      )}

      {/* Vue impression */}
      {showPrint && printPrescription && (
        <PrescriptionPrintView
          prescription={printPrescription}
          patient={patients[printPrescription.patient_id]}
          medicaments={medicaments}
          onClose={() => {
            setShowPrint(false);
            setPrintPrescription(null);
          }}
        />
      )}
    </div>
  );
};

export default Prescriptions;
