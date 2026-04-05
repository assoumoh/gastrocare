import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Sparkles } from 'lucide-react';
import { aiService } from '../../services/aiService';

interface ConsultationFormProps {
  consultation?: any;
  patientId?: string;
  onClose: () => void;
}

export default function ConsultationForm({ consultation, patientId, onClose }: ConsultationFormProps) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [notesBrutes, setNotesBrutes] = useState('');
  
  const [formData, setFormData] = useState({
    patient_id: consultation?.patient_id || patientId || '',
    date_consultation: consultation?.date_consultation || new Date().toISOString().split('T')[0],
    poids: consultation?.poids || '',
    tension: consultation?.tension || '',
    allergies: consultation?.allergies || '',
    commentaire_assistante: consultation?.commentaire_assistante || '',
    statutConsultation: consultation?.statutConsultation || 'pre_consultation',
    motif: consultation?.motif || '',
    symptomes: consultation?.symptomes || '',
    examen_clinique: consultation?.examen_clinique || '',
    diagnostic_principal: consultation?.diagnostic_principal || '',
    conduite_a_tenir: consultation?.conduite_a_tenir || '',
    synthese: consultation?.synthese || '',
    prescription: consultation?.prescription || '',
    observations: consultation?.observations || '',
    notes: consultation?.notes || '',
  });

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setPatients(pts);
      
      // If creating a new consultation and patient is selected, pre-fill allergies
      if (!consultation?.id && (consultation?.patient_id || patientId)) {
        const pId = consultation?.patient_id || patientId;
        const p = pts.find(pt => pt.id === pId);
        if (p && !formData.allergies) {
          setFormData(prev => ({ ...prev, allergies: p.allergies || '' }));
        }
      }
    });
    return () => unsubscribe();
  }, [consultation, patientId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAiStructure = async () => {
    if (!notesBrutes.trim()) return;
    setIsAiLoading(true);
    try {
      const structuredText = await aiService.structureConsultation(notesBrutes);
      setFormData(prev => ({
        ...prev,
        notes: prev.notes + '\n\n--- Structuration IA ---\n' + structuredText
      }));
      setNotesBrutes('');
    } catch (error) {
      console.error("AI Error:", error);
      alert("Erreur lors de la structuration par l'IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let dataToSave: any = { ...formData };
      
      if (appUser?.role === 'assistante') {
        dataToSave = {
          patient_id: formData.patient_id,
          date_consultation: formData.date_consultation,
          poids: formData.poids,
          tension: formData.tension,
          allergies: formData.allergies,
          commentaire_assistante: formData.commentaire_assistante,
          statutConsultation: formData.statutConsultation,
        };
      }

      // Update consultation document
      if (consultation?.id) {
        await updateDoc(doc(db, 'consultations', consultation.id), {
          ...dataToSave,
          updated_at: new Date().toISOString(),
          updated_by: appUser?.uid
        });
      } else {
        await addDoc(collection(db, 'consultations'), {
          ...dataToSave,
          created_by: appUser?.uid || 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: appUser?.uid
        });
      }

      // Update patient document with latest allergies and poids
      if (formData.patient_id) {
        const patientRef = doc(db, 'patients', formData.patient_id);
        await updateDoc(patientRef, {
          allergies: formData.allergies,
          poids: formData.poids,
          updated_at: new Date().toISOString()
        });
      }

      onClose();
    } catch (error) {
      console.error("Error saving consultation:", error);
      alert("Erreur lors de l'enregistrement de la consultation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 overflow-y-auto flex justify-center items-start p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {consultation ? 'Modifier la consultation' : 'Nouvelle consultation'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className={`p-6 grid grid-cols-1 ${appUser?.role !== 'assistante' ? 'lg:grid-cols-3' : ''} gap-6`}>
          
          {/* AI Assistant Sidebar (Hidden for assistante) */}
          {appUser?.role !== 'assistante' && (
            <div className="lg:col-span-1 border-r border-slate-200 pr-6 space-y-4">
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <h3 className="text-sm font-medium text-indigo-900 flex items-center mb-2">
                  <Sparkles className="h-4 w-4 mr-1 text-indigo-600" />
                  Assistant IA
                </h3>
                <p className="text-xs text-indigo-700 mb-3">
                  Prenez vos notes en vrac, l'IA se chargera de les structurer dans le dossier.
                </p>
                <textarea
                  rows={6}
                  value={notesBrutes}
                  onChange={(e) => setNotesBrutes(e.target.value)}
                  placeholder="Ex: Patient 45 ans, dlr fosse iliaque dte depuis 2j, fievre 38.5, pas de N/V. Abdo souple mais sensible FID. Faire echo abdo + NFS CRP."
                  className="block w-full rounded-md border-indigo-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAiStructure}
                  disabled={isAiLoading || !notesBrutes.trim()}
                  className="mt-3 w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isAiLoading ? 'Analyse...' : 'Structurer les notes'}
                </button>
              </div>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className={`${appUser?.role !== 'assistante' ? 'lg:col-span-2' : ''} space-y-4`}>
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
                <input required type="date" name="date_consultation" value={formData.date_consultation} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700">Statut de la consultation</label>
                <select name="statutConsultation" value={formData.statutConsultation} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                  <option value="pre_consultation">Pré-consultation saisie</option>
                  <option value="en_attente">Patient en salle d'attente</option>
                  <option value="en_cours">Consultation en cours</option>
                  <option value="terminee">Consultation terminée</option>
                </select>
              </div>
            </div>

            {/* Pre-consultation fields (Visible to all) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="md:col-span-2">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Pré-consultation (Assistante)</h4>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Poids (kg)</label>
                <input type="number" step="0.1" name="poids" value={formData.poids} onChange={handleChange} placeholder="Ex: 75.5" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tension artérielle</label>
                <input type="text" name="tension" value={formData.tension} onChange={handleChange} placeholder="Ex: 12/8" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Allergies</label>
                <input type="text" name="allergies" value={formData.allergies} onChange={handleChange} placeholder="Ex: Pénicilline, Arachides..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Observations Pré-consultation</label>
                <textarea name="commentaire_assistante" rows={2} value={formData.commentaire_assistante} onChange={handleChange} placeholder="Ex: Patient à jeun, anxieux..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white" />
              </div>
            </div>

            {/* Medical fields (Hidden for assistante) */}
            {appUser?.role !== 'assistante' && (
              <>
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">Consultation Médicale</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Motif</label>
                  <input type="text" name="motif" value={formData.motif} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Symptômes</label>
                  <textarea name="symptomes" rows={2} value={formData.symptomes} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Examen clinique</label>
                  <textarea name="examen_clinique" rows={2} value={formData.examen_clinique} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Diagnostic principal</label>
                  <input type="text" name="diagnostic_principal" value={formData.diagnostic_principal} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Synthèse</label>
                  <textarea name="synthese" rows={2} value={formData.synthese} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Conduite à tenir</label>
                  <textarea name="conduite_a_tenir" rows={2} value={formData.conduite_a_tenir} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Prescription</label>
                  <textarea name="prescription" rows={2} value={formData.prescription} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Observations</label>
                  <textarea name="observations" rows={2} value={formData.observations} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Notes (Générées par l'IA ou manuelles)</label>
                  <textarea name="notes" rows={4} value={formData.notes} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 font-mono text-xs" />
                </div>
              </>
            )}

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
    </div>
  );
}
