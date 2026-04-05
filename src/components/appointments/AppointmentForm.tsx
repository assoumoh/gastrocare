import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X } from 'lucide-react';

interface AppointmentFormProps {
  appointment?: any;
  patientId?: string;
  onClose: () => void;
}

export default function AppointmentForm({ appointment, patientId, onClose }: AppointmentFormProps) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    patient_id: appointment?.patient_id || patientId || '',
    date_rdv: appointment?.date_rdv || new Date().toISOString().split('T')[0],
    heure_rdv: appointment?.heure_rdv || '09:00',
    motif: appointment?.motif || '',
    statut: appointment?.statut || 'prévu',
    notes: appointment?.notes || '',
  });

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (appointment?.id) {
        await updateDoc(doc(db, 'appointments', appointment.id), {
          ...formData,
          updated_at: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'appointments'), {
          ...formData,
          created_by: appUser?.uid || 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving appointment:", error);
      alert("Erreur lors de l'enregistrement du rendez-vous.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment?.id) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'appointments', appointment.id));
      onClose();
    } catch (error) {
      console.error("Error deleting appointment:", error);
      alert("Erreur lors de la suppression du rendez-vous.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Patient *</label>
            <select required name="patient_id" value={formData.patient_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
              <option value="">Sélectionner un patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Date *</label>
              <input required type="date" name="date_rdv" value={formData.date_rdv} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Heure *</label>
              <input required type="time" name="heure_rdv" value={formData.heure_rdv} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Motif</label>
            <input type="text" name="motif" value={formData.motif} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Statut *</label>
            <select required name="statut" value={formData.statut} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
              <option value="prévu">Prévu</option>
              <option value="confirmé">Confirmé</option>
              <option value="annulé">Annulé</option>
              <option value="réalisé">Réalisé</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea name="notes" rows={3} value={formData.notes} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <div>
              {appointment && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
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

        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-white/90 rounded-xl flex items-center justify-center z-20 p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-slate-900 mb-2">Confirmer la suppression</h3>
              <p className="text-sm text-slate-500 mb-6">Êtes-vous sûr de vouloir supprimer ce rendez-vous ? Cette action est irréversible.</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  disabled={loading}
                >
                  {loading ? 'Suppression...' : 'Oui, supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
