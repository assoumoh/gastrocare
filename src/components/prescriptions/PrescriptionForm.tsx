import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, onSnapshot, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Trash2, Lightbulb } from 'lucide-react';
import Select from 'react-select';

interface PrescriptionFormProps {
  prescription?: any;
  patientId?: string;
  consultationId?: string;
  onClose: () => void;
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

  const [suggestions, setSuggestions] = useState<{[index: number]: {posologie: string, duree: string, instructions_speciales: string}}>({});

  const applySuggestion = (index: number) => {
    if (suggestions[index]) {
      const newMeds = [...medicaments];
      newMeds[index].posologie = suggestions[index].posologie;
      newMeds[index].duree = suggestions[index].duree;
      newMeds[index].instructions_speciales = suggestions[index].instructions_speciales;
      setMedicaments(newMeds);
      
      setSuggestions(prev => {
        const newSugg = { ...prev };
        delete newSugg[index];
        return newSugg;
      });
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

    // Si on change le médicament et qu'on a sélectionné une valeur
    if (field === 'medicament_id' && value) {
      try {
        // On cherche dans les ordonnances récentes pour trouver la dernière posologie utilisée pour ce médicament
        const q = query(
          collection(db, 'prescriptions'),
          orderBy('date_prescription', 'desc'),
          limit(50)
        );
        
        const snapshot = await getDocs(q);
        let found = false;
        
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (data.medicaments && Array.isArray(data.medicaments)) {
            const med = data.medicaments.find((m: any) => m.medicament_id === value);
            // Si on trouve une ancienne prescription avec une posologie non vide
            if (med && (med.posologie || med.duree)) {
              setSuggestions(prev => ({
                ...prev,
                [index]: {
                  posologie: med.posologie || '',
                  duree: med.duree || '',
                  instructions_speciales: med.instructions_speciales || ''
                }
              }));
              found = true;
              break; // On s'arrête à la première trouvée (la plus récente)
            }
          }
        }
        
        // Si aucune suggestion n'est trouvée, on nettoie d'éventuelles anciennes suggestions
        if (!found) {
          setSuggestions(prev => {
            const newSugg = { ...prev };
            delete newSugg[index];
            return newSugg;
          });
        }
      } catch (error) {
        console.error("Erreur lors de la recherche de suggestions de posologie:", error);
      }
    } else if (field === 'medicament_id' && !value) {
      // Si on efface le médicament, on enlève la suggestion
      setSuggestions(prev => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    console.log("--- DEBUG: DÉBUT SAUVEGARDE ORDONNANCE ---");
    console.log("1. Utilisateur connecté:", appUser);
    console.log("2. Patient sélectionné ID:", formData.patient_id);
    console.log("3. Médicaments bruts:", medicaments);

    try {
      // 5. Nettoyer automatiquement le payload avant sauvegarde
      const validMeds = medicaments
        .filter(m => m.medicament_id)
        .map(m => {
          // 6. Vérifier et mapper les champs du médicament
          const medInfo = medicamentsList.find(ml => ml.id === m.medicament_id);
          return {
            medicament_id: m.medicament_id,
            nomMedicament: medInfo?.nomMedicament || medInfo?.nom_commercial || 'Inconnu',
            posologie: m.posologie || '',
            duree: m.duree || '',
            instructions_speciales: m.instructions_speciales || ''
          };
        });
      
      console.log("4. Médicaments nettoyés et mappés:", validMeds);

      const prescriptionData: any = {
        patient_id: formData.patient_id || '',
        consultation_id: formData.consultation_id || '',
        date_prescription: formData.date_prescription || new Date().toISOString().split('T')[0],
        notes: formData.notes || '',
        medicaments: validMeds,
      };

      // Supprimer les champs undefined pour éviter les erreurs Firestore
      Object.keys(prescriptionData).forEach(key => {
        if (prescriptionData[key] === undefined) {
          delete prescriptionData[key];
        }
      });

      console.log("5. Payload de base:", prescriptionData);

      if (prescription?.id) {
        const updatePayload = {
          ...prescriptionData,
          updated_at: new Date().toISOString(),
        };
        console.log("6. Payload final (UPDATE):", updatePayload);
        await updateDoc(doc(db, 'prescriptions', prescription.id), updatePayload);
        console.log("-> Ordonnance mise à jour avec succès.");
      } else {
        const createPayload = {
          ...prescriptionData,
          medecin_id: appUser?.uid || 'unknown',
          created_by: appUser?.uid || 'unknown', // CORRECTION: Requis par les règles Firestore
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        console.log("6. Payload final (CREATE):", createPayload);
        await addDoc(collection(db, 'prescriptions'), createPayload);
        console.log("-> Ordonnance créée avec succès.");
      }
      onClose();
    } catch (error: any) {
      // 3. Capturer et afficher l'erreur exacte
      console.error("!!! ERREUR EXACTE LORS DE L'ENREGISTREMENT !!!", error);
      
      // 9. Améliorer le message frontend
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
      console.log("--- DEBUG: FIN SAUVEGARDE ORDONNANCE ---");
    }
  };

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
            
            {medicaments.map((med, index) => (
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
                    {suggestions[index] && (
                      <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-md p-3 flex items-start justify-between shadow-sm">
                        <div className="flex items-start">
                          <Lightbulb className="h-5 w-5 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-indigo-800">Dernière posologie utilisée</p>
                            <p className="text-xs text-indigo-600 mt-1">
                              {suggestions[index].posologie} {suggestions[index].duree ? `pendant ${suggestions[index].duree}` : ''}
                            </p>
                            {suggestions[index].instructions_speciales && (
                              <p className="text-xs text-indigo-500 mt-0.5 italic">
                                "{suggestions[index].instructions_speciales}"
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => applySuggestion(index)}
                          className="ml-4 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium py-1.5 px-3 rounded-md transition-colors"
                        >
                          Appliquer
                        </button>
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
            ))}
            {medicaments.length === 0 && (
              <p className="text-sm text-slate-500 italic">Aucun médicament ajouté.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes générales</label>
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
