import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, Shield, UserCheck, UserX, Key, AlertTriangle, X } from 'lucide-react';
import UserForm from '../components/admin/UserForm';
import { useAuth } from '../contexts/AuthContext';

export default function Admin() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [saveCodeMessage, setSaveCodeMessage] = useState('');

  // Delete modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleteCodeInput, setDeleteCodeInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeUsers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((u: any) => u.deleted !== true);
      setUsers(activeUsers);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'admin');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDeleteCode(docSnap.data().delete_patient_code || '');
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des paramètres:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveCode = async () => {
    setIsSavingCode(true);
    setSaveCodeMessage('');
    try {
      await setDoc(doc(db, 'settings', 'admin'), { delete_patient_code: deleteCode }, { merge: true });
      setSaveCodeMessage('Code enregistré avec succès');
      setTimeout(() => setSaveCodeMessage(''), 3000);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du code:", error);
      setSaveCodeMessage('Erreur lors de l\'enregistrement');
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (userId === appUser?.uid) {
      alert("Vous ne pouvez pas désactiver votre propre compte.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { actif: !currentStatus });
    } catch (error) {
      console.error("Erreur lors de la modification du statut:", error);
    }
  };

  const handleDeleteClick = (user: any) => {
    if (user.id === appUser?.uid) {
      alert("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }
    setUserToDelete(user);
    setDeleteCodeInput('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    setDeleteError('');
    
    try {
      // Verify code
      const settingsDoc = await getDoc(doc(db, 'settings', 'admin'));
      const correctCode = settingsDoc.exists() ? settingsDoc.data().delete_patient_code : '';
      
      if (!correctCode) {
        setDeleteError("Aucun code de suppression n'a été configuré par l'administrateur.");
        setIsDeleting(false);
        return;
      }
      
      if (deleteCodeInput !== correctCode) {
        setDeleteError("Code confidentiel incorrect.");
        setIsDeleting(false);
        return;
      }
      
      // Soft delete
      await updateDoc(doc(db, 'users', userToDelete.id), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: appUser?.uid,
        actif: false // Also deactivate the user
      });
      
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      setDeleteError("Une erreur est survenue lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-slate-900">Administration</h1>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvel utilisateur
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-slate-200">
          <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center">
            <Key className="h-5 w-5 mr-2 text-indigo-500" />
            Sécurité
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Paramètres de sécurité globaux de l'application.
          </p>
        </div>
        <div className="p-6">
          <div className="max-w-md">
            <label htmlFor="deleteCode" className="block text-sm font-medium text-slate-700">
              Code confidentiel pour la suppression (patients et utilisateurs)
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="password"
                name="deleteCode"
                id="deleteCode"
                className="focus:ring-indigo-500 focus:border-indigo-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-slate-300"
                placeholder="Ex: 1234"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSaveCode}
                disabled={isSavingCode}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSavingCode ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
            {saveCodeMessage && (
              <p className={`mt-2 text-sm ${saveCodeMessage.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
                {saveCodeMessage}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Ce code sera demandé à tout utilisateur tentant de supprimer un patient ou un utilisateur de la base de données.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-slate-200">
          <h3 className="text-lg leading-6 font-medium text-slate-900">Gestion des accès</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Seuls les utilisateurs présents dans cette liste et "Actifs" peuvent se connecter à l'application avec leur compte Google.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Utilisateur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rôle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date d'ajout</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className={!user.actif ? 'bg-slate-50 opacity-75' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase">
                        {user.prenom?.[0] || ''}{user.nom?.[0] || ''}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">{user.prenom} {user.nom}</div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'medecin' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleUserStatus(user.id, user.actif)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        user.actif ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                      title={user.actif ? "Désactiver" : "Activer"}
                    >
                      {user.actif ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
                      {user.actif ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.date_creation ? new Date(user.date_creation).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                      title="Modifier"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user)}
                      className="text-red-600 hover:text-red-900"
                      title="Supprimer"
                      disabled={user.id === appUser?.uid}
                    >
                      <Trash2 className={`h-5 w-5 ${user.id === appUser?.uid ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <UserForm
          user={selectedUser}
          onClose={handleCloseForm}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => !isDeleting && setIsDeleteModalOpen(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                      Supprimer l'utilisateur
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-slate-500">
                        Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{userToDelete?.prenom} {userToDelete?.nom}</strong> ? Cette action est irréversible.
                      </p>
                      
                      <div className="mt-4">
                        <label htmlFor="deleteCodeInput" className="block text-sm font-medium text-slate-700">
                          Code de sécurité requis
                        </label>
                        <input
                          type="password"
                          name="deleteCodeInput"
                          id="deleteCodeInput"
                          className="mt-1 focus:ring-red-500 focus:border-red-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                          placeholder="Entrez le code confidentiel"
                          value={deleteCodeInput}
                          onChange={(e) => setDeleteCodeInput(e.target.value)}
                        />
                        {deleteError && (
                          <p className="mt-2 text-sm text-red-600">{deleteError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isDeleting || !deleteCodeInput}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={confirmDelete}
                >
                  {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
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
