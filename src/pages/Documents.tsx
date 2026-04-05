import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, File, User, Calendar, Eye, Printer, Download } from 'lucide-react';
import DocumentForm from '../components/documents/DocumentForm';
import DocumentViewer from '../components/documents/DocumentViewer';
import { Link } from 'react-router-dom';

export default function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [viewDocument, setViewDocument] = useState<any>(null);

  useEffect(() => {
    const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      const pts: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        pts[doc.id] = doc.data();
      });
      setPatients(pts);
    });
    return () => unsubPatients();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('date_ajout', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredDocuments = documents.filter(d => {
    const patient = patients[d.patient_id];
    const patientName = patient ? `${patient.nom} ${patient.prenom}`.toLowerCase() : '';
    return patientName.includes(search.toLowerCase()) || d.titre?.toLowerCase().includes(search.toLowerCase());
  });

  const handleEdit = (document: any) => {
    setSelectedDocument(document);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedDocument(null);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouveau Document
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
              placeholder="Rechercher par patient, titre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ul className="divide-y divide-slate-200">
          {filteredDocuments.map((doc) => {
            const patient = patients[doc.patient_id];
            return (
              <li key={doc.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6 cursor-pointer" onClick={() => handleEdit(doc)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <File className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <User className="mr-1.5 h-4 w-4 text-slate-400" />
                        <Link to={`/patients/${doc.patient_id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900" onClick={(e) => e.stopPropagation()}>
                          {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                        </Link>
                        <span className="mx-2 text-slate-300">•</span>
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-500">
                          {new Date(doc.date_ajout).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-900 font-medium">
                        {doc.titre}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 capitalize">
                        Type: {doc.type_document}
                      </div>
                      {doc.notes && (
                        <div className="mt-1 text-sm text-slate-600 truncate max-w-2xl">
                          {doc.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4 flex items-center space-x-2">
                    {doc.url_fichier && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewDocument(doc);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-full hover:bg-blue-50"
                          title="Voir le document"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const printWindow = window.open(doc.url_fichier, '_blank');
                            if (printWindow) {
                              printWindow.onload = () => {
                                printWindow.print();
                              };
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                          title="Imprimer"
                        >
                          <Printer className="h-5 w-5" />
                        </button>
                        <a
                          href={doc.url_fichier}
                          download={doc.nom_fichier || 'document'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-slate-400 hover:text-green-600 rounded-full hover:bg-green-50"
                          title="Télécharger"
                        >
                          <Download className="h-5 w-5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {filteredDocuments.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Aucun document trouvé.
            </li>
          )}
        </ul>
      </div>

      {isFormOpen && <DocumentForm document={selectedDocument} onClose={handleCloseForm} />}
      
      {viewDocument && (
        <DocumentViewer
          document={viewDocument}
          onClose={() => setViewDocument(null)}
        />
      )}
    </div>
  );
}
