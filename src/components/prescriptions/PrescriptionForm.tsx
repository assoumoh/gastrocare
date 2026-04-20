import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, onSnapshot, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Trash2, Lightbulb, ChevronDown, Printer } from 'lucide-react';
import Select from 'react-select';
import PrescriptionPrintView from './PrescriptionPrintView';

interface PrescriptionFormProps {
  prescription?: any;
  patientId?: string;
  consultationId?: string;
  onClose: () => void;
}

interface PosologieSuggestion {
  posologie: string;
  duree: string;
  instructions_speciales: string;
}

export default function PrescriptionForm({ prescription, patientId, consultationId, onClose }: PrescriptionFormProps) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [medicamentsList, setMedicamentsList] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    patient_id: prescription?.patient_id || patientId || '',
    consultation_id: prescription?.consultation_id || consultationId || '',
    date_prescription: prescription?.date_prescription || new Date().toISOString().split('T')[0],
    notes: prescription?.notes || '',
  });

  const [medicaments, setMedicaments] = useState<any[]>(
    prescription?.medicaments || [{ medicament_id: '', posologie: '', duree: '', instructions_speciales: '' }]
  );

  // Changé : on stocke maintenant un TABLEAU de suggestions (max 5) par index de médicament
  const [suggestionsMap, setSuggestionsMap] = useState<{ [index: number]: PosologieSuggestion[] }>({});

  // ===== AJOUT: état pour proposer l'impression après sauvegarde =====
  const [savedPrescription, setSavedPrescription] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  // ===== FIN AJOUT =====

  const applySuggestion = (index: number, suggestionIndex: number = 0) => {
    const suggestions = suggestionsMap[index];
    if (suggestions && suggestions[suggestionIndex]) {
      const newMeds = [...medicaments];
      newMeds[index].posologie = suggestions[suggestionIndex].posologie;
      newMeds[index].duree = suggestions[suggestionIndex].duree;
      newMeds[index].instructions_speciales = suggestions[suggestionIndex].instructions_speciales;
      setMedicaments(newMeds);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'medicaments'), orderBy('nomMedicament'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMedicamentsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMedChange = async (index: number, field: string, value: string) => {
    const newMeds = [...medicaments];
    newMeds[index][field] = value;
    setMedicaments(newMeds);

    // Si on change le médicament sélectionné
    if (field === 'medicament_id' && value) {
      try {
        // Chercher dans les 50 dernières ordonnances
        const q = query(
          collection(db, 'prescriptions'),
          orderBy('date_prescription', 'desc'),
          limit(50)
        );

        const snapshot = await getDocs(q);

        // Collecter toutes les posologies distinctes pour ce médicament
        const foundPosologies: PosologieSuggestion[] = [];
        const seenKeys = new Set<string>();

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (data.medicaments && Array.isArray(data.medicaments)) {
            const med = data.medicaments.find((m: any) => m.medicament_id === value);
            if (med && (med.posologie || med.duree)) {
              // Clé unique pour dédupliquer les posologies identiques
              const key = `${(med.posologie || '').trim().toLowerCase()}|${(med.duree || '').trim().toLowerCase()}|${(med.instructions_speciales || '').trim().toLowerCase()}`;

              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                foundPosologies.push({
                  posologie: med.posologie || '',
                  duree: med.duree || '',
                  instructions_speciales: med.instructions_speciales || ''
                });
              }

              // On s'arrête à 5 posologies distinctes
              if (foundPosologies.length >= 5) break;
            }
          }
        }

        if (foundPosologies.length > 0) {
          setSuggestionsMap(prev => ({
            ...prev,
            [index]: foundPosologies
          }));
        } else {
          setSuggestionsMap(prev => {
            const newSugg = { ...prev };
            delete newSugg[index];
            return newSugg;
          });
        }
      } catch (error) {
        console.error("Erreur lors de la recherche de suggestions de posologie:", error);
      }
    } else if (field === 'medicament_id' && !value) {
      setSuggestionsMap(prev => {
        const newSugg = { ...prev };
        delete newSugg[index];
        return newSugg;
      });
    }
  };

  const addMedicament = () => {
    setMedicaments([...medicaments, { medicament_id: '', posologie: '', duree: '', instructions_speciales: '' }]);
  };

  const removeMedicament = (index: number) => {
    const newMeds = [...medicaments];
    newMeds.splice(index, 1);
    setMedicaments(newMeds);
    // Nettoyer les suggestions pour cet index
    setSuggestionsMap(prev => {
      const newSugg = { ...prev };
      delete newSugg[index];
      return newSugg;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validMeds = medicaments
        .filter(m => m.medicament_id)
        .map(m => {
          const medInfo = medicamentsList.find(ml => ml.id === m.medicament_id);
          return {
            medicament_id: m.medicament_id,
            nomMedicament: medInfo?.nomMedicament || medInfo?.nom_commercial || 'Inconnu',
            posologie: m.posologie || '',
            duree: m.duree || '',
            instructions_speciales: m.instructions_speciales || ''
          };
        });

      const prescriptionData: any = {
        patient_id: formData.patient_id || '',
        consultation_id: formData.consultation_id || '',
        date_prescription: formData.date_prescription || new Date().toISOString().split('T')[0],
        notes: formData.notes || '',
        medicaments: validMeds,
      };

      Object.keys(prescriptionData).forEach(key => {
        if (prescriptionData[key] === undefined) {
          delete prescriptionData[key];
        }
      });

      if (prescription?.id) {
        const updatePayload = {
          ...prescriptionData,
          updated_at: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'prescriptions', prescription.id), updatePayload);
      } else {
        const createPayload = {
          ...prescriptionData,
          medecin_id: appUser?.uid || 'unknown',
          created_by: appUser?.uid || 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await addDoc(collection(db, 'prescriptions'), createPayload);
      }

      // ===== AJOUT: proposer l'impression au lieu de fermer directement =====
      const savedData = {
        ...prescriptionData,
        medicaments: validMeds,
      };
      setSavedPrescription(savedData);
      setShowPrintPreview(true);
      // ===== FIN AJOUT =====

    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);

      let errorMessage = "Erreur lors de l'enregistrement de l'ordonnance.";

      if (error.code === 'permission-denied') {
        errorMessage = "Permission refusée : Vérifiez que tous les champs obligatoires sont remplis (notamment le patient) et que vous avez les droits nécessaires.";
      } else if (error.message) {
        errorMessage = `Erreur: ${error.message}`;
      }

      if (!formData.patient_id) {
        errorMessage = "Le patient est manquant. Veuillez sélectionner un patient.";
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ===== AJOUT: Aperçu impression après sauvegarde =====
  if (showPrintPreview && savedPrescription) {
    const medsMap: Record<string, any> = {};
    medicamentsList.forEach(m => { medsMap[m.id] = m; });

    const patientData = patients.find(p => p.id === (savedPrescription.patient_id || formData.patient_id));

    return (
      <div className="fixed inset-0 z-50">
        <PrescriptionPrintView
          prescription={savedPrescription}
          patient={patientData || {}}
          medicaments={medsMap}
          onClose={onClose}
        />
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] print:hidden">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 shadow-lg"
          >
            Fermer sans imprimer
          </button>
        </div>
      </div>
    );
  }
  // ===== FIN AJOUT =====

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {prescription ? 'Modifier l\'ordonnance' : 'Nouvelle ordonnance'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Patient *</label>
              <select required name="patient_id" value={formData.patient_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                <option value="">Sélectionner un patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Date *</label>
              <input required type="date" name="date_prescription" value={formData.date_prescription} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-slate-900">Médicaments</h3>
              <button type="button" onClick={addMedicament} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200">
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </button>
            </div>

            {medicaments.map((med, index) => {
              const suggestions = suggestionsMap[index] || [];
              const latestSuggestion = suggestions[0] || null;

              return (
                <div key={index} className="p-4 border border-slate-200 rounded-md bg-slate-50 relative">
                  <button type="button" onClick={() => removeMedicament(index)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Médicament *</label>
                      <Select
                        required
                        value={medicamentsList.find(m => m.id === med.medicament_id) ? {
                          value: med.medicament_id,
                          label: `${medicamentsList.find(m => m.id === med.medicament_id)?.nomMedicament || medicamentsList.find(m => m.id === med.medicament_id)?.nom_commercial} ${medicamentsList.find(m => m.id === med.medicament_id)?.dosage ? `- ${medicamentsList.find(m => m.id === med.medicament_id)?.dosage} ${medicamentsList.find(m => m.id === med.medicament_id)?.uniteDosage || ''}` : ''}`
                        } : null}
                        onChange={(selectedOption) => handleMedChange(index, 'medicament_id', selectedOption?.value || '')}
                        options={medicamentsList.filter(m => m.actif !== false || med.medicament_id === m.id).map(m => ({
                          value: m.id,
                          label: `${m.nomMedicament || m.nom_commercial} ${m.dosage ? `- ${m.dosage} ${m.uniteDosage || ''}` : ''}${m.actif === false ? ' (Inactif)' : ''}`
                        }))}
                        placeholder="Rechercher un médicament..."
                        isClearable
                        className="react-select-container"
                        classNamePrefix="react-select"
                      />
                      {med.medicament_id && medicamentsList.find(m => m.id === med.medicament_id) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {medicamentsList.find(m => m.id === med.medicament_id)?.forme && (
                            <span className="mr-3">Forme: {medicamentsList.find(m => m.id === med.medicament_id)?.forme}</span>
                          )}
                          {medicamentsList.find(m => m.id === med.medicament_id)?.presentation && (
                            <span>Présentation: {medicamentsList.find(m => m.id === med.medicament_id)?.presentation}</span>
                          )}
                        </div>
                      )}

                      {/* ── Bloc suggestions posologie (NOUVEAU : 5 dernières) ── */}
                      {suggestions.length > 0 && (
                        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-md p-3 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start flex-1">
                              <Lightbulb className="h-5 w-5 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-indigo-800">Dernière posologie utilisée</p>
                                <p className="text-xs text-indigo-600 mt-1">
                                  {latestSuggestion!.posologie} {latestSuggestion!.duree ? `pendant ${latestSuggestion!.duree}` : ''}
                                </p>
                                {latestSuggestion!.instructions_speciales && (
                                  <p className="text-xs text-indigo-500 mt-0.5 italic">
                                    "{latestSuggestion!.instructions_speciales}"
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => applySuggestion(index, 0)}
                              className="ml-4 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium py-1.5 px-3 rounded-md transition-colors flex-shrink-0"
                            >
                              Appliquer
                            </button>
                          </div>

                          {/* Liste déroulante des 5 dernières posologies distinctes */}
                          {suggestions.length > 1 && (
                            <div className="mt-3 pt-3 border-t border-indigo-200">
                              <label className="block text-xs font-medium text-indigo-700 mb-1.5 flex items-center">
                                <ChevronDown className="h-3.5 w-3.5 mr-1" />
                                Historique des posologies ({suggestions.length})
                              </label>
                              <select
                                className="block w-full rounded-md border-indigo-200 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2"
                                defaultValue=""
                                onChange={(e) => {
                                  const selectedIdx = parseInt(e.target.value, 10);
                                  if (!isNaN(selectedIdx)) {
                                    applySuggestion(index, selectedIdx);
                                    e.target.value = '';
                                  }
                                }}
                              >
                                <option value="" disabled>Choisir une posologie précédente...</option>
                                {suggestions.map((sugg, sIdx) => (
                                  <option key={sIdx} value={sIdx}>
                                    {sugg.posologie}{sugg.duree ? ` — ${sugg.duree}` : ''}{sugg.instructions_speciales ? ` (${sugg.instructions_speciales})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Posologie *</label>
                      <input required type="text" value={med.posologie} onChange={(e) => handleMedChange(index, 'posologie', e.target.value)} placeholder="ex: 1 comprimé matin et soir" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Durée *</label>
                      <input required type="text" value={med.duree} onChange={(e) => handleMedChange(index, 'duree', e.target.value)} placeholder="ex: 7 jours" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700">Instructions spéciales</label>
                      <input type="text" value={med.instructions_speciales} onChange={(e) => handleMedChange(index, 'instructions_speciales', e.target.value)} placeholder="ex: à prendre au milieu du repas" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                    </div>
                  </div>
                </div>
              );
            })}
            {medicaments.length === 0 && (
              <p className="text-sm text-slate-500 italic">Aucun médicament ajouté.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea name="notes" rows={2} value={formData.notes} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
