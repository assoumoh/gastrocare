import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, FileSignature, User, Calendar, Pill, Printer } from 'lucide-react';
import PrescriptionForm from '../components/prescriptions/PrescriptionForm';
import PrescriptionPrintView from '../components/prescriptions/PrescriptionPrintView';
import { Link } from 'react-router-dom';

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [medicaments, setMedicaments] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);

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
    const q = query(collection(db, 'prescriptions'), orderBy('date_prescription', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredPrescriptions = prescriptions.filter(p => {
    const patient = patients[p.patient_id];
    const patientName = patient ? `${patient.nom} ${patient.prenom}`.toLowerCase() : '';
    return patientName.includes(search.toLowerCase());
  });

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

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Ordonnances</h1>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouvelle Ordonnance
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
              placeholder="Rechercher par patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ul className="divide-y divide-slate-200">
          {filteredPrescriptions.map((prescription) => {
            const patient = patients[prescription.patient_id];
            return (
              <li key={prescription.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6 cursor-pointer" onClick={() => handleEdit(prescription)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <FileSignature className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <User className="mr-1.5 h-4 w-4 text-slate-400" />
                        <Link to={`/patients/${prescription.patient_id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900" onClick={(e) => e.stopPropagation()}>
                          {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                        </Link>
                        <span className="mx-2 text-slate-300">•</span>
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-500">
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
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={(e) => handlePrint(e, prescription)}
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      title="Imprimer l'ordonnance"
                    >
                      <Printer className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {filteredPrescriptions.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Aucune ordonnance trouvée.
            </li>
          )}
        </ul>
      </div>

      {isFormOpen && <PrescriptionForm prescription={selectedPrescription} onClose={handleCloseForm} />}
      
      {isPrintOpen && selectedPrescription && (
        <PrescriptionPrintView 
          prescription={selectedPrescription} 
          patient={patients[selectedPrescription.patient_id]} 
          medicaments={medicaments}
          onClose={handleClosePrint} 
        />
      )}
    </div>
  );
}
