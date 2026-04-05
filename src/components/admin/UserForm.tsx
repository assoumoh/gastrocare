import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { X } from 'lucide-react';

interface UserFormProps {
  user?: any;
  onClose: () => void;
}

export default function UserForm({ user, onClose }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    role: user?.role || 'assistante',
    actif: user?.actif !== undefined ? user.actif : true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user?.id) {
        await updateDoc(doc(db, 'users', user.id), formData);
      } else {
        await setDoc(doc(db, 'users', formData.email.toLowerCase()), {
          ...formData,
          email: formData.email.toLowerCase(),
          date_creation: new Date().toISOString(),
        });
      }
      onClose();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'utilisateur:", error);
      alert("Erreur lors de l'enregistrement de l'utilisateur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Prénom *</label>
              <input required type="text" name="prenom" value={formData.prenom} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Nom *</label>
              <input required type="text" name="nom" value={formData.nom} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Email *</label>
            <input required type="email" name="email" value={formData.email} onChange={handleChange} disabled={!!user} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" />
            {!user && <p className="mt-1 text-xs text-slate-500">L'utilisateur pourra se connecter avec ce compte Google.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Rôle *</label>
            <select required name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
              <option value="assistante">Assistante</option>
              <option value="medecin">Médecin</option>
              <option value="admin">Administrateur</option>
            </select>
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
              Compte actif
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 mt-6">
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
