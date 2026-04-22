import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Edit, Trash2, FileSignature, Calendar, Pill, Printer, Eye, Plus, FileText, Paperclip } from 'lucide-react';
import PrescriptionForm from '../prescriptions/PrescriptionForm';
import PrescriptionPrintView from '../prescriptions/PrescriptionPrintView';
import PaperPrescriptionForm from '../prescriptions/PaperPrescriptionForm';
import { useAuth } from '../../contexts/AuthContext';

interface PatientPrescriptionsProps {
  patientId: string;
}

export default function PatientPrescriptions({ patientId }: PatientPrescriptionsProps) {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medicaments, setMedicaments] = useState<Record<string, any>>({});
  const [patient, setPatient] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaperFormOpen, setIsPaperFormOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { appUser } = useAuth();

  // Filters
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    const unsubPatient = onSnapshot(doc(db, 'patients', patientId), (docSnap) => {
      if (docSnap.exists()) {
        setPatient({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsubPatient();
  }, [patientId]);

  useEffect(() => {
    const unsubMeds = onSnapshot(collection(db, 'medicaments'), (snapshot) => {
      const meds: Record<string, any> = {};
      snapshot.docs.forEach(d => {
        meds[d.id] = d.data();
      });
      setMedicaments(meds);
    });
    return () => unsubMeds();
  }, []);

  // FIX: fallback sans orderBy si index manquant (comme PatientConsultations)
  useEffect(() => {
    const q = query(
      collection(db, 'prescriptions'),
      where('patient_id', '==', patientId),
      orderBy('date_prescription', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.warn('Index manquant pour prescriptions, fallback sans orderBy:', error);
      const qFallback = query(
        collection(db, 'prescriptions'),
        where('patient_id', '==', patientId)
      );
      const unsubFallback = onSnapshot(qFallback, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a: any, b: any) => (b.date_prescription || '').localeCompare(a.date_prescription || ''));
        setPrescriptions(data);
        setLoading(false);
      });
      return () => unsubFallback();
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
    if (prescription?.type === 'papier') {
      setIsPaperFormOpen(true);
    } else {
      setIsFormOpen(true);
    }
  };

  const handlePrint = (e: React.MouseEvent, prescription: any) => {
    e.stopPropagation();
    setSelectedPrescription(prescription);
    setIsPrintOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedPrescription(null);
    setIsFormOpen(false);
    setIsPaperFormOpen(false);
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
          <label htmlFor="dateDebutP" className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
          <input type="date" id="dateDebutP" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
        </div>
        <div>
          <label htmlFor="dateFinP" className="block text-sm font-medium text-slate-700 mb-1">Date de fin</label>
          <input type="date" id="dateFinP" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
        </div>
        {(dateDebut || dateFin) && (
          <button onClick={() => { setDateDebut(''); setDateFin(''); }} className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
            Effacer les filtres
          </button>
        )}
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-medium text-slate-900">Ordonnances</h3>
        {appUser?.role !== 'assistante' && (
          <div className="flex gap-2">
            <button
              onClick={() => { setSelectedPrescription(null); setIsPaperFormOpen(true); }}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700"
              title="Répertorier une ordonnance papier / externe"
            >
              <FileText className="-ml-0.5 mr-2 h-4 w-4" />Ordonnance papier
            </button>
            <button
              onClick={() => { setSelectedPrescription(null); setIsFormOpen(true); }}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              title="Créer une nouvelle ordonnance structurée"
            >
              <Plus className="-ml-0.5 mr-2 h-4 w-4" />Nouvelle ordonnance
            </button>
          </div>
        )}
      </div>

      {filteredPrescriptions.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <FileSignature className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">Aucune ordonnance</h3>
          <p className="mt-1 text-sm text-slate-500">
            Créez une nouvelle ordonnance ou répertoriez une ordonnance papier existante.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
          <ul className="divide-y divide-slate-200">
            {filteredPrescriptions.map((prescription) => {
              const isPapier = prescription.type === 'papier';
              return (
              <li key={prescription.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6 cursor-pointer" onClick={() => appUser?.role !== 'assistante' && handleEdit(prescription)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      {isPapier ? (
                        <FileText className="h-6 w-6 text-amber-600" />
                      ) : (
                        <FileSignature className="h-6 w-6 text-indigo-500" />
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Calendar className="mr-0.5 h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {new Date(prescription.date_prescription + 'T12:00:00').toLocaleDateString('fr-FR')}
                        </span>
                        {isPapier && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Papier / externe
                          </span>
                        )}
                        {isPapier && prescription.prescripteur && (
                          <span className="text-xs text-slate-500">· Dr {prescription.prescripteur}</span>
                        )}
                      </div>

                      {isPapier ? (
                        <>
                          {prescription.contenu && (
                            <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-md p-3">
                              {prescription.contenu}
                            </div>
                          )}
                          {prescription.fichier_url && (
                            <a
                              href={prescription.fichier_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                            >
                              <Paperclip className="h-3 w-3" />
                              {prescription.fichier_nom || 'Fichier joint'}
                            </a>
                          )}
                          {prescription.commentaire && (
                            <div className="mt-2 text-sm text-slate-500 italic">
                              Note: {prescription.commentaire}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="mt-3 space-y-2">
                            {prescription.medicaments?.map((med: any, idx: number) => {
                              const medInfo = medicaments[med.medicament_id];
                              return (
                                <div key={idx} className="flex items-start text-sm">
                                  <Pill className="h-4 w-4 text-slate-400 mr-2 mt-0.5" />
                                  <div>
                                    <span className="font-medium text-slate-900">
                                      {med.nomMedicament || (medInfo ? (medInfo.nomMedicament || medInfo.nom_commercial) : 'Médicament inconnu')}
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
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    {appUser?.role !== 'assistante' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(prescription); }}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm bg-blue-100 text-blue-700 hover:bg-blue-200"
                        title="Modifier l'ordonnance"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {!isPapier && (
                      <button
                        onClick={(e) => handlePrint(e, prescription)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        title="Imprimer l'ordonnance"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                    {appUser?.role !== 'assistante' && (
                      <button
                        onClick={(e) => handleDelete(e, prescription.id)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm bg-red-100 text-red-700 hover:bg-red-200"
                        title="Supprimer l'ordonnance"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {isFormOpen && (
        <PrescriptionForm prescription={selectedPrescription} onClose={handleCloseForm} patientId={patientId} />
      )}

      {isPaperFormOpen && (
        <PaperPrescriptionForm prescription={selectedPrescription} patientId={patientId} onClose={handleCloseForm} />
      )}

      {isPrintOpen && selectedPrescription && (
        <PrescriptionPrintView prescription={selectedPrescription} patient={patient} medicaments={medicaments} onClose={handleClosePrint} />
      )}
    </div>
  );
}
