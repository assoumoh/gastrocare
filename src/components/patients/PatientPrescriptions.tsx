import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, Edit, Trash2, FileSignature, Calendar, Pill, Printer, Eye } from 'lucide-react';
import PrescriptionForm from '../prescriptions/PrescriptionForm';
import PrescriptionPrintView from '../prescriptions/PrescriptionPrintView';
import { useAuth } from '../../contexts/AuthContext';

interface PatientPrescriptionsProps {
  patientId: string;
}

export default function PatientPrescriptions({ patientId }: PatientPrescriptionsProps) {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medicaments, setMedicaments] = useState<Record<string, any>>({});
  const [patient, setPatient] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { appUser } = useAuth();
  
  // Filters
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    const unsubPatient = onSnapshot(doc(db, 'patients', patientId), (doc) => {
      if (doc.exists()) {
        setPatient({ id: doc.id, ...doc.data() });
      }
    });
    return () => unsubPatient();
  }, [patientId]);

  useEffect(() => {
    const unsubMeds = onSnapshot(collection(db, 'medicaments'), (snapshot) => {
      const meds: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        meds[doc.id] = doc.data();
      });
      setMedicaments(meds);
    });
    return () => unsubMeds();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'prescriptions'),
      where('patient_id', '==', patientId),
      orderBy('date_prescription', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette ordonnance ?')) {
      try {
        await deleteDoc(doc(db, 'prescriptions', id));
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const handleEdit = (prescription: any) => {
    setSelectedPrescription(prescription);
    setIsFormOpen(true);
  };

  const handlePrint = (e: React.MouseEvent, prescription: any) => {
    e.stopPropagation();
    setSelectedPrescription(prescription);
    setIsPrintOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedPrescription(null);
    setIsFormOpen(false);
  };

  const handleClosePrint = () => {
    setSelectedPrescription(null);
    setIsPrintOpen(false);
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    if (dateDebut && p.date_prescription < dateDebut) return false;
    if (dateFin && p.date_prescription > dateFin) return false;
    return true;
  });

  if (loading) {
    return <div className="text-center py-4 text-slate-500">Chargement des ordonnances...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="dateDebut" className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
          <input
            type="date"
            id="dateDebut"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="dateFin" className="block text-sm font-medium text-slate-700 mb-1">Date de fin</label>
          <input
            type="date"
            id="dateFin"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
          />
        </div>
        {(dateDebut || dateFin) && (
          <button
            onClick={() => { setDateDebut(''); setDateFin(''); }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-900">Ordonnances</h3>
        {appUser?.role !== 'assistante' && (
          <button
            onClick={() => {
              setSelectedPrescription(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            Ajouter
          </button>
        )}
      </div>

      {filteredPrescriptions.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <FileSignature className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">Aucune ordonnance</h3>
          {appUser?.role !== 'assistante' && (
            <p className="mt-1 text-sm text-slate-500">
              Commencez par créer une nouvelle ordonnance pour ce patient.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
          <ul className="divide-y divide-slate-200">
            {filteredPrescriptions.map((prescription) => (
              <li key={prescription.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6 cursor-pointer" onClick={() => appUser?.role !== 'assistante' && handleEdit(prescription)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <FileSignature className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {new Date(prescription.date_prescription).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        {prescription.medicaments?.map((med: any, idx: number) => {
                          const medInfo = medicaments[med.medicament_id];
                          return (
                            <div key={idx} className="flex items-start text-sm">
                              <Pill className="h-4 w-4 text-slate-400 mr-2 mt-0.5" />
                              <div>
                                <span className="font-medium text-slate-900">
                                  {medInfo ? (medInfo.nomMedicament || medInfo.nom_commercial) : 'Médicament inconnu'}
                                </span>
                                <span className="text-slate-500 ml-2">
                                  {med.posologie} - {med.duree}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {prescription.notes && (
                        <div className="mt-2 text-sm text-slate-600 italic">
                          Notes: {prescription.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    {appUser?.role !== 'assistante' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(prescription);
                        }}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-blue-100 text-blue-700 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Voir l'ordonnance"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handlePrint(e, prescription)}
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Imprimer l'ordonnance"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {appUser?.role !== 'assistante' && (
                      <button
                        onClick={(e) => handleDelete(e, prescription.id)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Supprimer l'ordonnance"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isFormOpen && (
        <PrescriptionForm
          prescription={selectedPrescription}
          onClose={handleCloseForm}
          patientId={patientId}
        />
      )}

      {isPrintOpen && selectedPrescription && (
        <PrescriptionPrintView 
          prescription={selectedPrescription} 
          patient={patient} 
          medicaments={medicaments}
          onClose={handleClosePrint} 
        />
      )}
    </div>
  );
}
