import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, Pill, Edit, Upload } from 'lucide-react';
import MedicamentForm from '../components/medicaments/MedicamentForm';
import { useNavigate } from 'react-router-dom';

export default function Medicaments() {
  const navigate = useNavigate();
  const [medicaments, setMedicaments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'medicaments'), orderBy('nomMedicament'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMedicaments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const activeMedicaments = medicaments.filter(m => m.actif !== false);

  const filteredMedicaments = activeMedicaments.filter(m => 
    (m.nomMedicament || m.nom_commercial || '')?.toLowerCase().includes(search.toLowerCase()) || 
    m.dci?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (med: any) => {
    setSelectedMed(med);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedMed(null);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Base de Médicaments</h1>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button 
            onClick={() => navigate('/medicaments/import')}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Upload className="-ml-1 mr-2 h-5 w-5 text-slate-400" />
            Importer Excel
          </button>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouveau Médicament
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
              placeholder="Rechercher par nom commercial ou DCI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ul className="divide-y divide-slate-200">
          {filteredMedicaments.map((med) => (
            <li key={med.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <Pill className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-indigo-600">{med.nomMedicament || med.nom_commercial}</p>
                      {!med.actif && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {med.dci && <span className="mr-3">DCI: {med.dci}</span>}
                      {med.dosage && <span className="mr-3">Dosage: {med.dosage} {med.uniteDosage}</span>}
                      {med.forme && <span>Forme: {med.forme}</span>}
                    </div>
                    {med.presentation && (
                      <div className="mt-1 text-xs text-slate-400">
                        Présentation: {med.presentation}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button onClick={() => handleEdit(med)} className="text-slate-400 hover:text-indigo-600 p-2">
                    <Edit className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {filteredMedicaments.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Aucun médicament trouvé.
            </li>
          )}
        </ul>
      </div>

      {isFormOpen && <MedicamentForm medicament={selectedMed} onClose={handleCloseForm} />}
    </div>
  );
}
