import React, { useState } from 'react';
import {
    addDoc,
    collection,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
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

/** Regroupe les examens : biologie → 1 doc, autres types → 1 doc par examen */
function buildDocuments(exams: ExamEntry[]) {
    const biologieExams = exams.filter(e => e.type_examen === 'Biologie');
    const otherExams    = exams.filter(e => e.type_examen !== 'Biologie');
    const docs: { key: string; exams: ExamEntry[]; note: string }[] = [];

    if (biologieExams.length > 0) {
        const mergedNote = biologieExams.map(e => e.commentaire?.trim()).filter(Boolean).join(' · ');
        docs.push({ key: 'biologie', exams: biologieExams, note: mergedNote });
    }
    otherExams.forEach((e, i) => {
        docs.push({ key: `other-${i}`, exams: [e], note: (e.commentaire || '').trim() });
    });
    return docs;
}

/** Ouvre une nouvelle fenêtre vierge et lance l'impression — aucune dépendance
 *  vis-à-vis du DOM React, des modals, de Tailwind ou des media queries. */
function printDocuments(
    documents: { key: string; exams: ExamEntry[]; note: string }[],
    patientName: string,
    cabinetSettings?: {
        nom_cabinet?: string;
        specialite?: string;
        adresse_cabinet?: string;
        numero_ordre?: string;
        inpe?: string;
    },
) {
    const pw = window.open('', '_blank');
    if (!pw) {
        alert("Veuillez autoriser les popups pour ce site afin d'imprimer.");
        return;
    }

    const today = new Date().toLocaleDateString('fr-FR');

    const escHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Infos cabinet dynamiques avec fallback
    const nomCabinet   = cabinetSettings?.nom_cabinet   || 'Docteur';
    const specialite   = cabinetSettings?.specialite    || '';
    const adresse      = cabinetSettings?.adresse_cabinet || '';
    const numeroOrdre  = cabinetSettings?.numero_ordre  || '';
    const inpe         = cabinetSettings?.inpe          || '';

    const piedPage = (numeroOrdre || inpe)
        ? `<div class="footer-info">${numeroOrdre ? `N° Ordre : ${escHtml(numeroOrdre)}` : ''}${numeroOrdre && inpe ? '&emsp;|&emsp;' : ''}${inpe ? `INPE : ${escHtml(inpe)}` : ''}</div>`
        : '';

    const pages = documents.map(docu => `
        <div class="page">
            <div class="header">
                <h1>${escHtml(nomCabinet)}</h1>
                ${specialite ? `<p class="sub">${escHtml(specialite)}</p>` : ''}
                ${adresse    ? `<p class="sub">${escHtml(adresse)}</p>`    : ''}
            </div>

            <div class="title-wrap">
                <span class="title-box">Demande d&rsquo;Examens Complémentaires</span>
            </div>

            <div class="patient-row">
                <span><strong>Patient&nbsp;:</strong>&nbsp;${escHtml(patientName)}</span>
                <span>Le&nbsp;${today}</span>
            </div>

            ${docu.note ? `
            <div class="note">
                <strong>Note&nbsp;:</strong>&nbsp;${escHtml(docu.note)}
            </div>` : ''}

            <div class="exams">
                ${docu.exams.map(e => `
                <div class="exam-item">&bull;&nbsp;${escHtml(e.nom_examen)}</div>
                `).join('')}
            </div>

            <div class="signature">
                <span>Signature&nbsp;/&nbsp;Cachet</span>
                <div class="sig-line"></div>
            </div>
            ${piedPage}
        </div>
    `).join('\n');

    pw.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Demandes d'examens — ${escHtml(patientName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111; }

  @page { size: A4; margin: 1.5cm; }

  /* Chaque .page = une feuille A4 */
  .page {
    width: 100%;
    min-height: 24cm;          /* occupe toute la feuille */
    display: flex;
    flex-direction: column;
    padding-bottom: 0.5cm;
  }
  /* Saut de page ENTRE pages (pas de trailing blank page) */
  .page + .page { page-break-before: always; }

  /* En-tête médecin */
  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 1rem; margin-bottom: 2rem; }
  .header h1 { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
  .header .sub { font-size: 12px; color: #555; margin-top: 3px; }

  /* Titre encadré */
  .title-wrap { text-align: center; margin-bottom: 2rem; }
  .title-box {
    font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 2px; border: 2px solid #111;
    display: inline-block; padding: 7px 20px;
  }

  /* Ligne patient / date */
  .patient-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 2rem; }

  /* Note */
  .note { background: #f5f5f5; border-left: 4px solid #888; padding: 10px 14px; margin-bottom: 1.5rem; font-size: 13px; }

  /* Liste examens */
  .exams { flex: 1; margin-bottom: 1rem; }
  .exam-item { font-size: 15px; font-weight: 700; padding: 7px 0 7px 14px; border-left: 4px solid #ccc; margin-bottom: 8px; }

  /* Signature en bas */
  .signature { margin-top: auto; text-align: right; padding-top: 2rem; }
  .signature span { font-size: 13px; font-weight: 600; display: block; margin-bottom: 2.5rem; }
  .sig-line { width: 160px; border-bottom: 1px solid #999; margin-left: auto; }
  .footer-info { text-align: center; font-size: 11px; color: #777; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 1rem; }
</style>
</head>
<body>
${pages}
</body>
</html>`);

    pw.document.close();
    // Laisser le temps au navigateur de rendre avant d'ouvrir la boîte d'impression
    setTimeout(() => { pw.focus(); pw.print(); }, 400);
}

// ─────────────────────────────────────────────────────────────────────────────

const ExamRequestModal: React.FC<ExamRequestModalProps> = ({
    patientId,
    patientName,
    consultationId,
    onComplete,
    onClose,
}) => {
    const { appUser } = useAuth();
    const { settings } = useSettings();
    const [exams, setExams] = useState<ExamEntry[]>([
        { type_examen: 'Biologie', nom_examen: EXAM_TYPES['Biologie'][0], commentaire: '' },
    ]);
    const [savedExams, setSavedExams] = useState<ExamEntry[]>([]);
    const [saving, setSaving]         = useState(false);
    const [saved, setSaved]           = useState(false);

    const handleAddExam = () => {
        setExams(prev => [...prev, { type_examen: 'Biologie', nom_examen: EXAM_TYPES['Biologie'][0], commentaire: '' }]);
    };

    const handleRemoveExam = (index: number) => {
        setExams(prev => prev.filter((_, i) => i !== index));
    };

    const handleChangeExam = (index: number, field: keyof ExamEntry, value: string) => {
        setExams(prev => {
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
        if (exams.length === 0) { onComplete(); return; }

        setSaving(true);
        try {
            const now   = new Date().toISOString();
            const today = now.split('T')[0];

            for (const exam of exams) {
                await addDoc(collection(db, 'exams'), {
                    patient_id:      patientId,
                    consultation_id: consultationId || null,
                    type_examen:     exam.type_examen,
                    nom_examen:      exam.nom_examen,
                    commentaire:     exam.commentaire || '',
                    statut:          'demandé',
                    date_demande:    today,
                    date_examen:     today,
                    created_by:      appUser?.uid || '',
                    created_at:      now,
                    updated_at:      now,
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

    // ======= VUE APRÈS SAUVEGARDE =======
    if (saved) {
        const documents = buildDocuments(savedExams);

        return (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">

                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">
                                    {savedExams.length} examen{savedExams.length > 1 ? 's' : ''} enregistré{savedExams.length > 1 ? 's' : ''}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {documents.length} document{documents.length > 1 ? 's' : ''} prêt{documents.length > 1 ? 's' : ''} à imprimer
                                </p>
                            </div>
                        </div>
                        <button onClick={onComplete} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Récapitulatif des documents */}
                    <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
                        {documents.map((docu, idx) => (
                            <div key={docu.key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800">
                                        {docu.exams.length === 1 ? docu.exams[0].nom_examen : `Biologie (${docu.exams.length} examens)`}
                                    </p>
                                    {docu.note && (
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">Note : {docu.note}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center p-5 border-t border-slate-200">
                        <button
                            onClick={() => printDocuments(documents, patientName, settings)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimer {documents.length} document{documents.length > 1 ? 's' : ''}
                        </button>
                        <button
                            onClick={onComplete}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Continuer
                            <SkipForward className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ======= VUE FORMULAIRE SAISIE =======
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
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">Examen #{index + 1}</span>
                                {exams.length > 1 && (
                                    <button onClick={() => handleRemoveExam(index)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Type d'examen</label>
                                    <select
                                        value={exam.type_examen}
                                        onChange={e => handleChangeExam(index, 'type_examen', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {Object.keys(EXAM_TYPES).map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom de l'examen</label>
                                    <select
                                        value={exam.nom_examen}
                                        onChange={e => handleChangeExam(index, 'nom_examen', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {(EXAM_TYPES[exam.type_examen] || ['Autre']).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire (optionnel)</label>
                                <input
                                    type="text"
                                    value={exam.commentaire}
                                    onChange={e => handleChangeExam(index, 'commentaire', e.target.value)}
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
                        onClick={onComplete}
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
                            <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</>
                        ) : (
                            <><Save className="w-4 h-4" />Enregistrer les examens</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamRequestModal;
