import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import PatientForm from '../components/patients/PatientForm';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 20;

export default function Patients() {
  const { appUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<any>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Mettre à jour la recherche si le paramètre URL change
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const q = query(collection(db, 'patients'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
        .filter(p => p.deleted !== true);

      pts.sort((a: any, b: any) => (a.nom || '').localeCompare(b.nom || ''));
      setPatients(pts);
    });
    return () => unsubscribe();
  }, []);

  const filteredPatients = patients.filter(p =>
    p.nom?.toLowerCase().includes(search.toLowerCase()) ||
    p.prenom?.toLowerCase().includes(search.toLowerCase()) ||
    p.telephone?.includes(search)
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page quand la recherche change
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleEdit = (e: React.MouseEvent, patient: any) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPatient(patient);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedPatient(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, patient: any) => {
    e.preventDefault();
    e.stopPropagation();
    setPatientToDelete(patient);
    setDeleteCode('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!patientToDelete) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'admin'));
      const correctCode = settingsDoc.exists() ? settingsDoc.data().delete_patient_code : '';

      if (!correctCode) {
        setDeleteError("Aucun code de suppression n'a été configuré par l'administrateur.");
        setIsDeleting(false);
        return;
      }

      if (deleteCode !== correctCode) {
        setDeleteError("Code confidentiel incorrect.");
        setIsDeleting(false);
        return;
      }

      await updateDoc(doc(db, 'patients', patientToDelete.id), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: appUser?.uid
      });

      setIsDeleteModalOpen(false);
      setPatientToDelete(null);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      setDeleteError("Une erreur est survenue lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouveau Patient
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative rounded-md shadow-sm max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Rechercher par nom, prénom, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-slate-500">{filteredPatients.length} patient(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Patient</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mutuelle</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Allergies</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase">
                        {patient.nom?.[0] || ''}{patient.prenom?.[0] || ''}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">{patient.nom} {patient.prenom}</div>
                        <div className="text-sm text-slate-500">
                          {patient.date_naissance ? `Né(e) le ${patient.date_naissance}` : 'Date de naissance non renseignée'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{patient.telephone || '-'}</div>
                    <div className="text-sm text-slate-500">{patient.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {patient.statutPatient === 'patient_habituel' ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Habituel</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Nouveau</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{patient.mutuelle || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {patient.allergies ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800" title={patient.allergies}>Oui</span>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Link to={`/patients/${patient.id}`} className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50" title="Ouvrir la fiche">
                        <Eye className="h-5 w-5" />
                      </Link>
                      <button onClick={(e) => handleEdit(e, patient)} className="text-slate-600 hover:text-slate-900 p-1 rounded-full hover:bg-slate-100" title="Modifier">
                        <Edit className="h-5 w-5" />
                      </button>
                      {appUser?.role === 'admin' && (
                        <button onClick={(e) => handleDeleteClick(e, patient)} className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50" title="Supprimer">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedPatients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">Aucun patient trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="text-sm text-slate-500">
              Page {currentPage} sur {totalPages} — {filteredPatients.length} résultat(s)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && <PatientForm patient={selectedPatient} onClose={handleCloseForm} />}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsDeleteModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Trash2 className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">Supprimer le patient</h3>
                  <div className="mt-2">
                    <p className="text-sm text-slate-500">
                      Êtes-vous sûr de vouloir supprimer le patient <strong>{patientToDelete?.nom} {patientToDelete?.prenom}</strong> ? Cette action masquera le patient de la liste.
                    </p>
                    <div className="mt-4">
                      <label htmlFor="deleteCode" className="block text-sm font-medium text-slate-700">Code confidentiel Administrateur</label>
                      <input
                        type="password"
                        name="deleteCode"
                        id="deleteCode"
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        placeholder="Saisissez le code"
                        value={deleteCode}
                        onChange={(e) => setDeleteCode(e.target.value)}
                        autoFocus
                      />
                      {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={confirmDelete} disabled={isDeleting || !deleteCode}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                  {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
                </button>
                <button type="button" onClick={() => setIsDeleteModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
