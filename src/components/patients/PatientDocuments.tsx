import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit, Trash2, FileText, Calendar, Download, Eye, Printer } from 'lucide-react';
import DocumentForm from '../documents/DocumentForm';
import DocumentViewer from '../documents/DocumentViewer';

interface PatientDocumentsProps {
  patientId: string;
}

export default function PatientDocuments({ patientId }: PatientDocumentsProps) {
  const { appUser } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [viewDocument, setViewDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'documents'),
      where('patient_id', '==', patientId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort locally to avoid requiring composite index
      docs.sort((a: any, b: any) => {
        const dateA = a.date_ajout || a.created_at || '';
        const dateB = b.date_ajout || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
      setDocuments(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await deleteDoc(doc(db, 'documents', id));
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const handleEdit = (document: any) => {
    setSelectedDocument(document);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedDocument(null);
    setIsFormOpen(false);
  };

  if (loading) {
    return <div className="text-center py-4 text-slate-500">Chargement des documents...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-900">Documents</h3>
        <button
          onClick={() => {
            setSelectedDocument(null);
            setIsFormOpen(true);
          }}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="-ml-1 mr-2 h-4 w-4" />
          Ajouter
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <FileText className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">Aucun document</h3>
          <p className="mt-1 text-sm text-slate-500">
            Commencez par ajouter un document pour ce patient.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
          <ul className="divide-y divide-slate-200">
            {documents.map((document) => (
              <li key={document.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6 cursor-pointer" onClick={() => handleEdit(document)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <FileText className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-slate-900">
                          {document.titre}
                        </span>
                        <span className="mx-2 text-slate-300">•</span>
                        <span className="text-sm text-slate-500 capitalize">
                          {document.type_document}
                        </span>
                      </div>
                      
                      <div className="mt-1 flex items-center text-sm text-slate-500">
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        {new Date(document.date_ajout).toLocaleDateString('fr-FR')}
                      </div>
                      
                      {document.notes && (
                        <div className="mt-2 text-sm text-slate-600 italic">
                          Notes: {document.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    {document.url_fichier && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewDocument(document);
                          }}
                          className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-blue-100 text-blue-700 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          title="Voir le document"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const printWindow = window.open(document.url_fichier, '_blank');
                            if (printWindow) {
                              printWindow.onload = () => {
                                printWindow.print();
                              };
                            }
                          }}
                          className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-100 text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          title="Imprimer"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <a
                          href={document.url_fichier}
                          download={document.nom_fichier || 'document'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-green-100 text-green-700 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </>
                    )}
                    {appUser?.role !== 'assistante' && (
                      <button
                        onClick={(e) => handleDelete(e, document.id)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-100 text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Supprimer le document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isFormOpen && (
        <DocumentForm
          document={selectedDocument}
          onClose={handleCloseForm}
          patientId={patientId}
        />
      )}

      {viewDocument && (
        <DocumentViewer
          document={viewDocument}
          onClose={() => setViewDocument(null)}
        />
      )}
    </div>
  );
}
