import React, { useState } from 'react';
import {
    addDoc,
    collection,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
    X,
    Plus,
    Trash2,
    Printer,
    Loader2,
    SkipForward,
    Save,
    CheckCircle,
} from 'lucide-react';

interface ExamRequestModalProps {
    patientId: string;
    patientName: string;
    consultationId?: string;
    onComplete: () => void;
    onClose: () => void;
}

interface ExamEntry {
    type_examen: string;
    nom_examen: string;
    commentaire: string;
}

const EXAM_TYPES: Record<string, string[]> = {
    Biologie: [
        'NFS', 'Bilan hépatique', 'Bilan rénal', 'Ionogramme', 'CRP',
        'VS', 'Glycémie', 'HbA1c', 'Bilan lipidique', 'TSH',
        'Ferritine', 'Vitamine B12', 'Folates', 'Albumine',
        'TP/INR', 'Sérologie Hépatite B', 'Sérologie Hépatite C',
        'Sérologie HIV', 'Calprotectine fécale', 'Hémoccult',
        'Marqueurs tumoraux (ACE, CA19-9, AFP)', 'Autre biologie',
    ],
    Imagerie: [
        'Échographie abdominale', 'Scanner abdominal', 'IRM abdominale',
        'IRM hépatique', 'ASP', 'Transit baryté',
        'Entéro-IRM', 'Entéro-scanner', 'Autre imagerie',
    ],
    Endoscopie: [
        'FOGD (Fibroscopie)', 'Coloscopie', 'Rectosigmoïdoscopie',
        'Écho-endoscopie', 'CPRE', 'Entéroscopie',
        'Vidéocapsule', 'Autre endoscopie',
    ],
    Fonctionnel: [
        'pHmétrie', 'Manométrie œsophagienne',
        'Manométrie ano-rectale', 'Breath test',
        'Test respiratoire au lactose', 'Électrogastrographie',
        'Autre examen fonctionnel',
    ],
    Anapath: [
        'Biopsie gastrique', 'Biopsie colique', 'Biopsie hépatique',
        'Cytologie', 'Autre anapath',
    ],
    Autre: ['Autre'],
};

const ExamRequestModal: React.FC<ExamRequestModalProps> = ({
    patientId,
    patientName,
    consultationId,
    onComplete,
    onClose,
}) => {
    // *** FIX: appUser au lieu de user ***
    const { appUser } = useAuth();
    const [exams, setExams] = useState<ExamEntry[]>([
        { type_examen: 'Biologie', nom_examen: EXAM_TYPES['Biologie'][0], commentaire: '' },
    ]);
    const [savedExams, setSavedExams] = useState<ExamEntry[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleAddExam = () => {
        setExams((prev) => [
            ...prev,
            { type_examen: 'Biologie', nom_examen: EXAM_TYPES['Biologie'][0], commentaire: '' },
        ]);
    };

    const handleRemoveExam = (index: number) => {
        setExams((prev) => prev.filter((_, i) => i !== index));
    };

    const handleChangeExam = (index: number, field: keyof ExamEntry, value: string) => {
        setExams((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            if (field === 'type_examen') {
                const names = EXAM_TYPES[value] || ['Autre'];
                updated[index].nom_examen = names[0];
            }
            return updated;
        });
    };

    const handleSave = async () => {
        if (exams.length === 0) {
            onComplete();
            return;
        }

        setSaving(true);
        try {
            const now = new Date().toISOString();
            const today = now.split('T')[0];

            for (const exam of exams) {
                await addDoc(collection(db, 'exams'), {
                    patient_id: patientId,
                    consultation_id: consultationId || null,
                    type_examen: exam.type_examen,
                    nom_examen: exam.nom_examen,
                    commentaire: exam.commentaire || '',
                    statut: 'demandé',
                    date_demande: today,
                    date_examen: today,
                    // *** FIX: appUser au lieu de user ***
                    created_by: appUser?.uid || '',
                    created_at: now,
                    updated_at: now,
                });
            }

            setSavedExams([...exams]);
            setSaved(true);
        } catch (error) {
            console.error('Erreur sauvegarde examens:', error);
            alert('Erreur lors de la sauvegarde des examens.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleSkip = () => {
        onComplete();
    };

    // ======= VUE APRÈS SAUVEGARDE — style aligné avec ordonnance =======
    if (saved) {
        return (
            <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto print:bg-white print:p-0">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 relative print:shadow-none print:my-0 print:max-w-none print:rounded-none flex flex-col max-h-[90vh] print:max-h-none print:h-auto">

                    {/* Header écran — masqué à l'impression */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 print:hidden shrink-0">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <h2 className="text-lg font-semibold text-slate-900">
                                Examens enregistrés ({savedExams.length})
                            </h2>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handlePrint}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimer
                            </button>
                            <button onClick={() => onComplete()} className="p-2 text-slate-400 hover:text-slate-500 rounded-full hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* ZONE IMPRIMABLE — même style que PrescriptionPrintView */}
                    <div className="p-12 print:p-8 bg-white text-black overflow-y-auto grow">

                        {/* En-tête médecin — identique à l'ordonnance */}
                        <div className="text-center mb-12 border-b-2 border-slate-800 pb-6">
                            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">Docteur Elidrissi Laila</h1>
                            <p className="text-sm text-slate-600 mt-1">Spécialiste en Gastro-entérologie et Hépatologie</p>
                            <p className="text-sm text-slate-600">339, immeuble FENNI, bd Mohamed V</p>
                        </div>

                        {/* Titre du document */}
                        <div className="text-center mb-10">
                            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 border-2 border-slate-900 inline-block px-6 py-2">
                                Demande d'Examens Complémentaires
                            </h2>
                        </div>

                        {/* Infos patient + date */}
                        <div className="flex justify-between items-start mb-12 text-base">
                            <div className="space-y-1">
                                <p><span className="font-semibold">Patient :</span> {patientName}</p>
                            </div>
                            <div className="text-right">
                                <p>Le {new Date().toLocaleDateString('fr-FR')}</p>
                            </div>
                        </div>

                        {/* Tableau des examens */}
                        <div className="space-y-6 mb-16 min-h-[200px]">
                            {savedExams.map((exam, idx) => (
                                <div key={idx} className="pl-4 border-l-4 border-slate-200">
                                    <p className="font-bold text-lg text-slate-900">
                                        • {exam.nom_examen}
                                    </p>
                                    <p className="text-base text-slate-800 mt-1 ml-4">
                                        <span className="font-semibold">Type :</span> {exam.type_examen}
                                    </p>
                                    {exam.commentaire && (
                                        <p className="text-sm text-slate-600 italic ml-4 mt-1">
                                            Note : {exam.commentaire}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Signature */}
                        <div className="flex justify-end mt-20">
                            <div className="text-center">
                                <p className="font-semibold mb-16">Signature / Cachet</p>
                                <div className="w-48 border-b border-slate-300"></div>
                            </div>
                        </div>
                    </div>

                    {/* Bouton continuer — masqué à l'impression */}
                    <div className="flex justify-between items-center p-4 border-t border-slate-200 print:hidden shrink-0">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimer
                        </button>
                        <button
                            onClick={onComplete}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Continuer
                            <SkipForward className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ======= VUE FORMULAIRE SAISIE (inchangée) =======
    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Demande d'examens</h2>
                        <p className="text-sm text-gray-500 mt-1">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Liste des examens */}
                <div className="p-6 space-y-4">
                    {exams.map((exam, index) => (
                        <div
                            key={index}
                            className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">
                                    Examen #{index + 1}
                                </span>
                                {exams.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveExam(index)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Type d'examen
                                    </label>
                                    <select
                                        value={exam.type_examen}
                                        onChange={(e) => handleChangeExam(index, 'type_examen', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {Object.keys(EXAM_TYPES).map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Nom de l'examen
                                    </label>
                                    <select
                                        value={exam.nom_examen}
                                        onChange={(e) => handleChangeExam(index, 'nom_examen', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {(EXAM_TYPES[exam.type_examen] || ['Autre']).map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Commentaire (optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={exam.commentaire}
                                    onChange={(e) => handleChangeExam(index, 'commentaire', e.target.value)}
                                    placeholder="Précisions, contexte clinique..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleAddExam}
                        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter un examen
                    </button>
                </div>

                {/* Boutons */}
                <div className="flex justify-between items-center p-6 border-t">
                    <button
                        onClick={handleSkip}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <SkipForward className="w-4 h-4" />
                        Passer sans examen
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || exams.length === 0}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enregistrement...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Enregistrer les examens
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamRequestModal;
