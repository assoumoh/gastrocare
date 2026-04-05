import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { X } from 'lucide-react';

interface MedicamentFormProps {
  medicament?: any;
  onClose: () => void;
}

export default function MedicamentForm({ medicament, onClose }: MedicamentFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nomMedicament: medicament?.nomMedicament || medicament?.nom_commercial || '',
    dci: medicament?.dci || '',
    dosage: medicament?.dosage || '',
    uniteDosage: medicament?.uniteDosage || '',
    forme: medicament?.forme || '',
    presentation: medicament?.presentation || '',
    ppv: medicament?.ppv || '',
    ph: medicament?.ph || '',
    prixBr: medicament?.prixBr || '',
    princepsGenerique: medicament?.princepsGenerique || '',
    tauxRemboursement: medicament?.tauxRemboursement || '',
    actif: medicament?.actif !== undefined ? medicament.actif : true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (medicament?.id) {
        await updateDoc(doc(db, 'medicaments', medicament.id), formData);
      } else {
        await addDoc(collection(db, 'medicaments'), formData);
      }
      onClose();
    } catch (error) {
      console.error("Error saving medicament:", error);
      alert("Erreur lors de l'enregistrement du médicament.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {medicament ? 'Modifier le médicament' : 'Nouveau médicament'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nom du médicament *</label>
            <input required type="text" name="nomMedicament" value={formData.nomMedicament} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">DCI (Principe actif)</label>
            <input type="text" name="dci" value={formData.dci} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Dosage</label>
              <input type="text" name="dosage" value={formData.dosage} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Unité</label>
              <input type="text" name="uniteDosage" value={formData.uniteDosage} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Forme</label>
              <input type="text" name="forme" value={formData.forme} onChange={handleChange} placeholder="ex: Comprimé..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Présentation</label>
              <input type="text" name="presentation" value={formData.presentation} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Princeps / Générique</label>
              <input type="text" name="princepsGenerique" value={formData.princepsGenerique} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">PPV</label>
              <input type="number" step="0.01" name="ppv" value={formData.ppv} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">PH</label>
              <input type="number" step="0.01" name="ph" value={formData.ph} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Prix BR</label>
              <input type="number" step="0.01" name="prixBr" value={formData.prixBr} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Taux Remb. (%)</label>
              <input type="number" name="tauxRemboursement" value={formData.tauxRemboursement} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          <div className="flex items-center mt-4">
            <input
              id="actif"
              name="actif"
              type="checkbox"
              checked={formData.actif}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
            />
            <label htmlFor="actif" className="ml-2 block text-sm text-slate-900">
              Médicament actif (disponible pour prescription)
            </label>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <div>
              {medicament?.id && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce médicament ? Il sera désactivé et masqué de la liste principale.')) {
                      setLoading(true);
                      try {
                        await updateDoc(doc(db, 'medicaments', medicament.id), { actif: false });
                        onClose();
                      } catch (error) {
                        console.error("Error deleting medicament:", error);
                        alert("Erreur lors de la suppression.");
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
                >
                  Supprimer
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
                Annuler
              </button>
              <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
