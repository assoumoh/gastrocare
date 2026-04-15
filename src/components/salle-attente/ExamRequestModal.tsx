import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Trash2, FileText, Printer, SkipForward } from 'lucide-react';

interface ExamRequestModalProps {
    patientId: string;
    patientName: string;
    consultationId?: string;
    onComplete: () => void;
    onClose: () => void;
}

const EXAM_TYPES: Record<string, string[]> = {
    'Biologie': ['NFS', 'Bilan hépatique', 'Bilan pancréatique', 'CRP', 'Ionogramme', 'Sérologies', 'Marqueurs tumoraux'],
    'Imagerie': ['Échographie abdominale', 'Scanner abdomino-pelvien', 'IRM hépatique', 'Transit OG', 'Entéroscanner', 'Lavement baryté'],
    'Endoscopie': ['Gastroscopie', 'Coloscopie', 'Rectosigmoïdoscopie', 'Écho-endoscopie', 'CPRE', 'Capsule endoscopique'],
    'Fonctionnel': ['Manométrie', 'pH-métrie', 'Test respiratoire à l\'urée', 'Test au lactose'],
    'Anapath': ['Biopsie gastrique', 'Biopsie colique', 'Cytologie biliaire'],
    'Autre': ['Recherche sang occulte', 'Coproculture', 'Fibroscan', 'Autre à préciser'],
};

interface ExamLine {
    type_examen: string;
    nom_examen: string;
    commentaire: string;
}

export default function ExamRequestModal({ patientId, patientName, consultationId, onComplete, onClose }: ExamRequestModalProps) {
    const { appUser } = useAuth();
    const [saving, setSaving] = useState(false);
    const [showPrint, setShowPrint] = useState(false);
    const [savedExams, setSavedExams] = useState<ExamLine[]>([]);

    const [examens, setExamens] = useState<ExamLine[]>([
        { type_examen: 'Biologie', nom_examen: 'NFS', commentaire: '' },
    ]);

    const addExam = () => {
        setExamens([...examens, { type_examen: 'Biologie', nom_examen: 'NFS', commentaire: '' }]);
    };

    const removeExam = (index: number) => {
        if (examens.length <= 1) return;
        setExamens(examens.filter((_, i) => i !== index));
    };

    const updateExam = (index: number, field: keyof ExamLine, value: string) => {
        const updated = [...examens];
        updated[index] = { ...updated[index], [field]: value };

        // Si on change le type, mettre le premier nom dispo
        if (field === 'type_examen') {
            const availableNames = EXAM_TYPES[value] || [];
            if (availableNames.length > 0 && !availableNames.includes(updated[index].nom_examen)) {
                updated[index].nom_examen = availableNames[0];
            }
        }

        setExamens(updated);
    };

    const handleSaveAndPrint = async () => {
        if (examens.length === 0) return;
        setSaving(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const nowISO = new Date().toISOString();

            for (const exam of examens) {
                await addDoc(collection(db, 'exams'), {
                    patient_id: patientId,
                    consultation_id: consultationId || null,
                    type_examen: exam.type_examen,
                    nom_examen: exam.nom_examen,
                    commentaire: exam.commentaire,
                    statut: 'demande',
                    statutExamen: 'demande',
                    date_demande: today,
                    date_examen: today,
                    dateDemande: today,
                    created_by: appUser?.uid || 'unknown',
                    created_at: nowISO,
                    updated_at: nowISO,
                });
            }

            setSavedExams([...examens]);
            setShowPrint(true);
        } catch (error) {
            console.error('Erreur sauvegarde examens:', error);
            alert('Erreur lors de l\'enregistrement des examens.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const calculateAge = (birthDateString: string) => {
        if (!birthDateString) return '';
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return `${age} ans`;
    };

    // --- PRINT VIEW ---
    if (showPrint) {
        return (
            <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto print:bg-white print:p-0">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 relative print:shadow-none print:my-0 print:max-w-none print:rounded-none flex flex-col max-h-[90vh] print:max-h-none print:h-auto">

                    {/* Header - Hidden on print */}
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 print:hidden shrink-0">
                        <h2 className="text-lg font-semibold text-slate-900">Aperçu — Demande d'examens</h2>
                        <div className="flex space-x-2">
                            <button onClick={handlePrint} className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                                <Printer className="mr-2 h-4 w-4" />Imprimer
                            </button>
                            <button onClick={() => { setShowPrint(false); onComplete(); }} className="inline-flex items-center px-3 py-2 border border-slate-300 text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
                                Continuer
                            </button>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-500 rounded-full hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Printable Area */}
                    <div className="p-12 print:p-8 bg-white text-black overflow-y-auto grow">
                        <div className="text-center mb-12 border-b-2 border-slate-800 pb-6">
                            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">Docteur Elidrissi Laila</h1>
                            <p className="text-sm text-slate-600 mt-1">Spécialiste en Gastro-entérologie et Hépatologie</p>
                            <p className="text-sm text-slate-600">339, immeuble FENNI, bd Mohamed V</p>
                        </div>

                        <div className="text-center mb-10">
                            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 border-2 border-slate-900 inline-block px-6 py-2">
                                Demande d'Examens
                            </h2>
                        </div>

                        <div className="flex justify-between items-start mb-12 text-base">
                            <div className="space-y-1">
                                <p><span className="font-semibold">Patient :</span> {patientName}</p>
                            </div>
                            <div className="text-right">
                                <p>Le {new Date().toLocaleDateString('fr-FR')}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-16 min-h-[200px]">
                            <p className="text-base font-semibold mb-4">Prière de bien vouloir réaliser les examens suivants :</p>
                            {savedExams.map((exam, idx) => (
                                <div key={idx} className="pl-4 border-l-4 border-slate-200">
                                    <p className="font-bold text-lg text-slate-900">
                                        {idx + 1}. {exam.nom_examen}
                                    </p>
                                    <p className="text-sm text-slate-600 ml-4">{exam.type_examen}</p>
                                    {exam.commentaire && (
                                        <p className="text-sm text-slate-500 italic ml-4 mt-1">Note : {exam.commentaire}</p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end mt-20">
                            <div className="text-center">
                                <p className="font-semibold mb-16">Signature / Cachet</p>
                                <div className="w-48 border-b border-slate-300"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- FORM VIEW ---
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col z-50">
                <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
                    <div>
                        <h3 className="text-lg font-medium text-slate-900 flex items-center">
                            <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                            Demander des examens ?
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto grow">
                    {examens.map((exam, index) => {
                        const availableNames = EXAM_TYPES[exam.type_examen] || [];
                        return (
                            <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
                                {examens.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeExam(index)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Type d'examen</label>
                                        <select
                                            value={exam.type_examen}
                                            onChange={(e) => updateExam(index, 'type_examen', e.target.value)}
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                        >
                                            {Object.keys(EXAM_TYPES).map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'examen</label>
                                        <select
                                            value={exam.nom_examen}
                                            onChange={(e) => updateExam(index, 'nom_examen', e.target.value)}
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                        >
                                            {availableNames.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Note (optionnel)</label>
                                        <input
                                            type="text"
                                            value={exam.commentaire}
                                            onChange={(e) => updateExam(index, 'commentaire', e.target.value)}
                                            placeholder="Précisions, urgence..."
                                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={addExam}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                    >
                        <Plus className="h-4 w-4 mr-1" />Ajouter un examen
                    </button>
                </div>

                <div className="flex gap-3 p-6 border-t border-slate-200 shrink-0">
                    <button
                        onClick={() => onComplete()}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                    >
                        <SkipForward className="h-4 w-4 mr-2" />
                        Passer (pas d'examens)
                    </button>
                    <button
                        onClick={handleSaveAndPrint}
                        disabled={saving}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        {saving ? 'Enregistrement...' : `Enregistrer ${examens.length} examen(s) et imprimer`}
                    </button>
                </div>
            </div>
        </div>
    );
}
