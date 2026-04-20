// src/components/prescriptions/PrescriptionForm.tsx

import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  onSnapshot,
  orderBy,
  getDocs,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Trash2, Printer, ArrowRight } from 'lucide-react';
import Select from 'react-select';
import PrescriptionPrintView from './PrescriptionPrintView';

interface PrescriptionFormProps {
  prescription?: any;
  patientId?: string;
  consultationId?: string;
  inline?: boolean;
  onClose: () => void;
}

interface PosologieSuggestion {
  posologie: string;
  duree: string;
  instructions_speciales?: string;
}

const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  prescription,
  patientId,
  consultationId,
  inline = false,
  onClose,
}) => {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [medicamentsList, setMedicamentsList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    patient_id: patientId || prescription?.patient_id || '',
    date_prescription: prescription?.date_prescription || new Date().toISOString().split('T')[0],
    notes: prescription?.notes || '',
    consultation_id: consultationId || prescription?.consultation_id || '',
  });
  const [medicaments, setMedicaments] = useState<any[]>(
    prescription?.medicaments || [
      {
        medicament_id: '',
        nom: '',
        dosage: '',
        forme: '',
        posologie: '',
        duree: '',
        instructions_speciales: '',
      },
    ]
  );
  const [suggestionsMap, setSuggestionsMap] = useState<Record<number, PosologieSuggestion[]>>({});
  const [savedPrescription, setSavedPrescription] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // ─── Charger les patients ───
  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsub = onSnapshot(q, (snap) => {
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // ─── Charger les médicaments ───
  useEffect(() => {
    const q = query(collection(db, 'medicaments'), orderBy('nom'));
    const unsub = onSnapshot(q, (snap) => {
      setMedicamentsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // ─── Synchroniser patientId prop → formData ───
  useEffect(() => {
    if (patientId && patientId !== formData.patient_id) {
      setFormData((prev) => ({ ...prev, patient_id: patientId }));
    }
  }, [patientId]);

  // ─── Synchroniser consultationId prop → formData ───
  useEffect(() => {
    if (consultationId && consultationId !== formData.consultation_id) {
      setFormData((prev) => ({ ...prev, consultation_id: consultationId }));
    }
  }, [consultationId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMedChange = async (index: number, field: string, value: string) => {
    const updated = [...medicaments];
    updated[index] = { ...updated[index], [field]: value };

    // Si on change le médicament, chercher les suggestions de posologie
    if (field === 'medicament_id' && value) {
      const med = medicamentsList.find((m) => m.id === value);
      if (med) {
        updated[index].nom = med.nom;
        updated[index].dosage = med.dosage || '';
        updated[index].forme = med.forme || '';
      }

      // Chercher les dernières posologies utilisées pour ce médicament
      try {
        const prescQ = query(collection(db, 'prescriptions'), orderBy('created_at', 'desc'), limit(50));
        const prescSnap = await getDocs(prescQ);
        const suggestions: PosologieSuggestion[] = [];
        const seen = new Set<string>();

        prescSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.medicaments && Array.isArray(data.medicaments)) {
            data.medicaments.forEach((m: any) => {
              if (m.medicament_id === value && m.posologie && !seen.has(m.posologie)) {
                seen.add(m.posologie);
                suggestions.push({
                  posologie: m.posologie,
                  duree: m.duree || '',
                  instructions_speciales: m.instructions_speciales || '',
                });
              }
            });
          }
        });

        setSuggestionsMap((prev) => ({
          ...prev,
          [index]: suggestions.slice(0, 5),
        }));
      } catch (err) {
        console.error('Erreur chargement suggestions:', err);
      }
    }

    setMedicaments(updated);
  };

  const applySuggestion = (index: number, suggestion: PosologieSuggestion) => {
    const updated = [...medicaments];
    updated[index] = {
      ...updated[index],
      posologie: suggestion.posologie,
      duree: suggestion.duree,
      instructions_speciales: suggestion.instructions_speciales || '',
    };
    setMedicaments(updated);
  };

  const addMedicament = () => {
    setMedicaments([
      ...medicaments,
      {
        medicament_id: '',
        nom: '',
        dosage: '',
        forme: '',
        posologie: '',
        duree: '',
        instructions_speciales: '',
      },
    ]);
  };

  const removeMedicament = (index: number) => {
    if (medicaments.length > 1) {
      setMedicaments(medicaments.filter((_, i) => i !== index));
      // Nettoyer les suggestions pour cet index
      setSuggestionsMap((prev) => {
        const newMap = { ...prev };
        delete newMap[index];
        return newMap;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id) {
      alert('Veuillez sélectionner un patient');
      return;
    }

    const validMeds = medicaments.filter((m) => m.medicament_id && m.posologie);
    if (validMeds.length === 0) {
      alert('Ajoutez au moins un médicament avec sa posologie');
      return;
    }

    setLoading(true);
    try {
      const patient = patients.find((p) => p.id === formData.patient_id);
      const patientName = patient ? `${patient.prenom} ${patient.nom}` : '';

      const payload: any = {
        patient_id: formData.patient_id,
        patient_nom: patientName,
        date_prescription: formData.date_prescription,
        medicaments: validMeds,
        notes: formData.notes,
        updated_at: Timestamp.now(),
        updated_by: appUser?.uid || '',
      };

      if (formData.consultation_id) {
        payload.consultation_id = formData.consultation_id;
      }

      if (prescription?.id) {
        await updateDoc(doc(db, 'prescriptions', prescription.id), payload);
        // Afficher aperçu impression après mise à jour
        setSavedPrescription({ id: prescription.id, ...payload });
        setShowPrintPreview(true);
      } else {
        payload.created_at = Timestamp.now();
        payload.created_by = appUser?.uid || '';
        payload.statut = 'active';
        const docRef = await addDoc(collection(db, 'prescriptions'), payload);
        // Afficher aperçu impression après création
        setSavedPrescription({ id: docRef.id, ...payload });
        setShowPrintPreview(true);
      }
    } catch (err) {
      console.error('Erreur sauvegarde ordonnance:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  // ─── Patient options pour react-select ───
  const patientOptions = patients.map((p) => ({
    value: p.id,
    label: `${p.prenom} ${p.nom}`,
  }));

  const selectedPatient = patientOptions.find((o) => o.value === formData.patient_id) || null;

  // ─── Médicament options pour react-select ───
  const medOptions = medicamentsList.map((m) => ({
    value: m.id,
    label: `${m.nom}${m.dosage ? ' – ' + m.dosage : ''}${m.forme ? ' (' + m.forme + ')' : ''}`,
  }));

  // ─── APERÇU IMPRESSION ───
  if (showPrintPreview && savedPrescription) {
    const patient = patients.find((p) => p.id === savedPrescription.patient_id);
    return (
      <>
        <PrescriptionPrintView
          prescription={savedPrescription}
          patient={patient}
          medicaments={medicamentsList}
          onClose={onClose}
        />
        {/* ── Boutons Imprimer / Continuer ── */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg shadow-lg hover:bg-teal-700 transition-colors font-medium"
          >
            Continuer
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </>
    );
  }

  // ─── FORMULAIRE PRINCIPAL ───
  return (
    <div className={inline ? '' : 'fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto'}>
      <div className={inline ? 'w-full' : 'bg-white rounded-xl shadow-xl w-full max-w-3xl my-8'}>
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {prescription ? 'Modifier l\'ordonnance' : 'Nouvelle ordonnance'}
          </h2>
          {!inline && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ── Patient ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
            {patientId ? (
              // Patient pré-sélectionné (workflow consultation) — afficher en lecture seule
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                {selectedPatient?.label || 'Patient sélectionné'}
              </div>
            ) : (
              <Select
                options={patientOptions}
                value={selectedPatient}
                onChange={(opt) =>
                  setFormData({ ...formData, patient_id: opt?.value || '' })
                }
                placeholder="Rechercher un patient..."
                isClearable
                classNamePrefix="react-select"
              />
            )}
          </div>

          {/* ── Date ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              name="date_prescription"
              value={formData.date_prescription}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* ── Médicaments ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Médicaments</label>
              <button
                type="button"
                onClick={addMedicament}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            <div className="space-y-4">
              {medicaments.map((med, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                  {/* Ligne médicament */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Select
                        options={medOptions}
                        value={medOptions.find((o) => o.value === med.medicament_id) || null}
                        onChange={(opt) => handleMedChange(index, 'medicament_id', opt?.value || '')}
                        placeholder="Sélectionner un médicament..."
                        isClearable
                        classNamePrefix="react-select"
                      />
                    </div>
                    {medicaments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicament(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Posologie */}
                  <div>
                    <input
                      type="text"
                      placeholder="Posologie (ex: 1 cp matin et soir)"
                      value={med.posologie}
                      onChange={(e) => handleMedChange(index, 'posologie', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {/* Suggestions de posologie */}
                    {suggestionsMap[index] && suggestionsMap[index].length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Suggestions récentes :</p>
                        <div className="flex flex-wrap gap-1">
                          {suggestionsMap[index].map((s, si) => (
                            <button
                              key={si}
                              type="button"
                              onClick={() => applySuggestion(index, s)}
                              className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors"
                            >
                              {s.posologie}
                              {s.duree ? ` (${s.duree})` : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Durée */}
                  <input
                    type="text"
                    placeholder="Durée (ex: 7 jours)"
                    value={med.duree}
                    onChange={(e) => handleMedChange(index, 'duree', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />

                  {/* Instructions spéciales */}
                  <input
                    type="text"
                    placeholder="Instructions spéciales (optionnel)"
                    value={med.instructions_speciales}
                    onChange={(e) => handleMedChange(index, 'instructions_speciales', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Notes supplémentaires..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* ── Boutons ── */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            {!inline && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer l\'ordonnance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrescriptionForm;
