import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X } from 'lucide-react';

interface PatientFormProps {
  patient?: any;
  onClose: () => void;
}

export default function PatientForm({ patient, onClose }: PatientFormProps) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [datePremiereConsultation, setDatePremiereConsultation] = useState<string>('');

  const [formData, setFormData] = useState({
    // Identité
    nom: patient?.nom || '',
    prenom: patient?.prenom || '',
    date_naissance: patient?.date_naissance || '',
    sexe: patient?.sexe || 'Homme',
    cin: patient?.cin || '',
    telephone: patient?.telephone || '',
    adresse: patient?.adresse || '',
    profession: patient?.profession || '',
    statut_familial: patient?.statut_familial || 'Célibataire',

    // Informations administratives
    num_dossier: patient?.num_dossier || '',
    statutPatient: patient?.statutPatient || 'nouveau_patient',
    mutuelle: patient?.mutuelle || '',
    amo: patient?.amo || 'Non',
    num_cnss: patient?.num_cnss || '',
    origine_patient: patient?.origine_patient || 'Direct',
    detail_origine: patient?.detail_origine || '',

    // Données médicales
    allergies: patient?.allergies || '',
    antecedents_medicaux: patient?.antecedents_medicaux || '',
    antecedents_digestifs: patient?.antecedents_digestifs || '',
    antecedents_familiaux: patient?.antecedents_familiaux || '',
    antecedents_chirurgicaux: patient?.antecedents_chirurgicaux || '',
    habitudes_toxiques: patient?.habitudes_toxiques || '',
    traitement_en_cours: patient?.traitement_en_cours || patient?.traitements_chroniques || '',
    observations_medecin: patient?.observations_medecin || '',
    suivi_long_terme: patient?.suivi_long_terme || 'Non',
    poids: patient?.poids || '',
  });

  useEffect(() => {
    const fetchFirstConsultation = async () => {
      if (patient?.id) {
        try {
          const q = query(
            collection(db, 'consultations'),
            where('patient_id', '==', patient.id),
            orderBy('date_consultation', 'asc'),
            limit(1)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            setDatePremiereConsultation(snapshot.docs[0].data().date_consultation);
          } else {
            setDatePremiereConsultation('Aucune consultation');
          }
        } catch (error) {
          console.error("Erreur lors de la récupération de la première consultation:", error);
          setDatePremiereConsultation('Erreur de calcul');
        }
      } else {
        setDatePremiereConsultation('Nouveau patient');
      }
    };

    fetchFirstConsultation();
  }, [patient?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let dataToSave: any = { ...formData };
      
      if (appUser?.role === 'assistante') {
        dataToSave = {
          nom: formData.nom,
          prenom: formData.prenom,
          date_naissance: formData.date_naissance,
          sexe: formData.sexe,
          cin: formData.cin,
          telephone: formData.telephone,
          adresse: formData.adresse,
          profession: formData.profession,
          statut_familial: formData.statut_familial,
          num_dossier: formData.num_dossier,
          statutPatient: formData.statutPatient,
          mutuelle: formData.mutuelle,
          amo: formData.amo,
          num_cnss: formData.num_cnss,
          origine_patient: formData.origine_patient,
          detail_origine: formData.detail_origine,
          allergies: formData.allergies,
          poids: formData.poids,
        };
      }

      if (patient?.id) {
        await updateDoc(doc(db, 'patients', patient.id), {
          ...dataToSave,
          updated_at: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'patients'), {
          ...dataToSave,
          created_by: appUser?.uid || 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving patient:", error);
      alert("Erreur lors de l'enregistrement du patient.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {patient ? 'Modifier le patient' : 'Nouveau patient'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* Section: Identité */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900 border-b pb-2">Identité</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nom *</label>
                <input required type="text" name="nom" value={formData.nom} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Prénom *</label>
                <input required type="text" name="prenom" value={formData.prenom} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Date de naissance</label>
                <input type="date" name="date_naissance" value={formData.date_naissance} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Sexe</label>
                <select name="sexe" value={formData.sexe} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                  <option value="Homme">Homme</option>
                  <option value="Femme">Femme</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">CIN</label>
                <input type="text" name="cin" value={formData.cin} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Téléphone *</label>
                <input required type="tel" name="telephone" value={formData.telephone} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Adresse</label>
                <textarea name="adresse" rows={2} value={formData.adresse} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Profession</label>
                <input type="text" name="profession" value={formData.profession} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Statut Familial</label>
                <select name="statut_familial" value={formData.statut_familial} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                  <option value="Célibataire">Célibataire</option>
                  <option value="Marié(e)">Marié(e)</option>
                  <option value="Divorcé(e)">Divorcé(e)</option>
                  <option value="Veuf(ve)">Veuf(ve)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Informations administratives */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900 border-b pb-2">Informations administratives</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Statut Patient</label>
                <select name="statutPatient" value={formData.statutPatient} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-indigo-50 font-medium text-indigo-700">
                  <option value="nouveau_patient">Nouveau patient</option>
                  <option value="patient_habituel">Patient habituel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">N° Dossier</label>
                <input type="text" name="num_dossier" value={formData.num_dossier} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Mutuelle</label>
                <input type="text" name="mutuelle" value={formData.mutuelle} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">AMO</label>
                <select name="amo" value={formData.amo} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">N° CNSS</label>
                <input type="text" name="num_cnss" value={formData.num_cnss} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Origine Patient</label>
                <select name="origine_patient" value={formData.origine_patient} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                  <option value="Direct">Direct</option>
                  <option value="Référé par un confrère">Référé par un confrère</option>
                  <option value="Réseaux sociaux">Réseaux sociaux</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              {(formData.origine_patient === 'Référé par un confrère' || formData.origine_patient === 'Autre') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Détail Origine</label>
                  <input type="text" name="detail_origine" value={formData.detail_origine} onChange={handleChange} placeholder="Précisez..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
              )}
            </div>
          </div>

          {/* Section: Données médicales */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900 border-b pb-2">Données médicales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Allergies</label>
                <input type="text" name="allergies" value={formData.allergies} onChange={handleChange} placeholder="Ex: Pénicilline, Arachides..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Poids (kg)</label>
                <input type="number" step="0.1" name="poids" value={formData.poids} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              
              {appUser?.role !== 'assistante' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Antécédents Médicaux</label>
                    <textarea name="antecedents_medicaux" rows={2} value={formData.antecedents_medicaux} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Antécédents Digestifs</label>
                    <textarea name="antecedents_digestifs" rows={2} value={formData.antecedents_digestifs} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Antécédents Familiaux</label>
                    <textarea name="antecedents_familiaux" rows={2} value={formData.antecedents_familiaux} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Antécédents Chirurgicaux</label>
                    <textarea name="antecedents_chirurgicaux" rows={2} value={formData.antecedents_chirurgicaux} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Habitudes Toxiques</label>
                    <textarea name="habitudes_toxiques" rows={2} value={formData.habitudes_toxiques} onChange={handleChange} placeholder="Tabac, Alcool..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Traitement en cours</label>
                    <textarea name="traitement_en_cours" rows={2} value={formData.traitement_en_cours} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Observations Médecin</label>
                    <textarea name="observations_medecin" rows={3} value={formData.observations_medecin} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Suivi Long Terme</label>
                    <select name="suivi_long_terme" value={formData.suivi_long_terme} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                      <option value="Oui">Oui</option>
                      <option value="Non">Non</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section: Informations calculées */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-medium text-slate-900">Informations calculées</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500">Date Première Consultation</label>
                <div className="mt-1 text-sm text-slate-900 font-medium">
                  {datePremiereConsultation}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 sticky bottom-0 bg-white py-4">
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
