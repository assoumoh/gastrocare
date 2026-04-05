import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, FileText, User, Calendar, CheckCircle, Clock } from 'lucide-react';
import ExamForm from '../components/exams/ExamForm';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function Exams() {
  const [exams, setExams] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);

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
    const q = query(collection(db, 'exams'), orderBy('date_demande', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredExams = exams.filter(e => {
    const patient = patients[e.patient_id];
    const patientName = patient ? `${patient.nom} ${patient.prenom}`.toLowerCase() : '';
    return patientName.includes(search.toLowerCase()) || e.type_examen?.toLowerCase().includes(search.toLowerCase());
  });

  const handleEdit = (exam: any) => {
    setSelectedExam(exam);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedExam(null);
    setIsFormOpen(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'réalisé': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'demandé': return <Clock className="h-5 w-5 text-orange-500" />;
      default: return <FileText className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Examens Médicaux</h1>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouvel Examen
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
              placeholder="Rechercher par patient, type d'examen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ul className="divide-y divide-slate-200">
          {filteredExams.map((exam) => {
            const patient = patients[exam.patient_id];
            return (
              <li key={exam.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6 cursor-pointer" onClick={() => handleEdit(exam)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(exam.statut)}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <User className="mr-1.5 h-4 w-4 text-slate-400" />
                        <Link to={`/patients/${exam.patient_id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900" onClick={(e) => e.stopPropagation()}>
                          {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                        </Link>
                        <span className="mx-2 text-slate-300">•</span>
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-500">
                          Demandé le {new Date(exam.date_demande).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-900">
                        <span className="font-medium capitalize">{exam.type_examen}</span>
                        {exam.statut === 'réalisé' && exam.date_realisation && (
                          <span className="ml-2 text-slate-500 text-xs">
                            (Réalisé le {new Date(exam.date_realisation).toLocaleDateString('fr-FR')})
                          </span>
                        )}
                      </div>
                      {exam.resultat_resume && (
                        <div className="mt-1 text-sm text-slate-600 truncate max-w-2xl">
                          <span className="font-medium">Résultat:</span> {exam.resultat_resume}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <span className={clsx(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                      exam.statut === 'réalisé' ? 'bg-green-100 text-green-800' : 
                      exam.statut === 'annulé' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    )}>
                      {exam.statut}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
          {filteredExams.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Aucun examen trouvé.
            </li>
          )}
        </ul>
      </div>

      {isFormOpen && <ExamForm exam={selectedExam} onClose={handleCloseForm} />}
    </div>
  );
}
