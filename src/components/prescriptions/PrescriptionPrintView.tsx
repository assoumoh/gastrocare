import React from 'react';
import { X, Printer } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

interface PrescriptionPrintViewProps {
  prescription: any;
  patient: any;
  medicaments: Record<string, any>;
  onClose: () => void;
}

function calculateAge(birthDateString: string): string {
    if (!birthDateString) return '';
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return `${age} ans`;
}

const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function PrescriptionPrintView({
    prescription,
    patient,
    medicaments,
    onClose,
}: PrescriptionPrintViewProps) {
    const { settings } = useSettings();

    const handlePrint = () => {
        const pw = window.open('', '_blank');
        if (!pw) {
            alert("Veuillez autoriser les popups pour ce site afin d'imprimer.");
            return;
        }

        const age          = calculateAge(patient?.date_naissance);
        const dateOrdonnance = new Date(prescription?.date_prescription || new Date()).toLocaleDateString('fr-FR');

        // Infos cabinet dynamiques avec fallback
        const nomCabinet  = settings?.nom_cabinet   || 'Docteur';
        const specialite  = settings?.specialite    || '';
        const adresse     = settings?.adresse_cabinet || '';
        const numeroOrdre = settings?.numero_ordre  || '';
        const inpe        = settings?.inpe          || '';

        const piedPage = (numeroOrdre || inpe)
            ? `<div class="footer-info">${numeroOrdre ? `N° Ordre : ${escHtml(numeroOrdre)}` : ''}${numeroOrdre && inpe ? '&emsp;|&emsp;' : ''}${inpe ? `INPE : ${escHtml(inpe)}` : ''}</div>`
            : '';

        const medsHtml = (prescription?.medicaments || []).map((med: any, idx: number) => {
            const medInfo      = medicaments[med.medicament_id];
            const nomMed       = medInfo ? (medInfo.nomMedicament || medInfo.nom_commercial) : (med.nomMedicament || 'Médicament inconnu');
            const dosage       = medInfo?.dosage ? ` ${medInfo.dosage} ${medInfo.uniteDosage || ''}` : '';
            const forme        = medInfo?.forme  ? ` — ${medInfo.forme}` : '';
            return `
            <div class="med-item">
                <p class="med-name">&bull;&nbsp;${escHtml(nomMed)}${escHtml(dosage)}${escHtml(forme)}</p>
                <p class="med-detail"><strong>Posologie :</strong>&nbsp;${escHtml(med.posologie || '')}</p>
                <p class="med-detail"><strong>Durée :</strong>&nbsp;${escHtml(med.duree || '')}</p>
                ${med.instructions_speciales ? `<p class="med-note">Note : ${escHtml(med.instructions_speciales)}</p>` : ''}
            </div>`;
        }).join('');

        const notesHtml = prescription?.notes
            ? `<div class="notes-block"><p class="notes-title">Notes :</p><p class="notes-body">${escHtml(prescription.notes)}</p></div>`
            : '';

        pw.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Ordonnance — ${escHtml((patient?.nom || '') + ' ' + (patient?.prenom || ''))}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111; }
  @page { size: A4; margin: 1.5cm; }

  .page { min-height: 24cm; display: flex; flex-direction: column; padding-bottom: 0.5cm; }

  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 1rem; margin-bottom: 2rem; }
  .header h1 { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
  .header .sub { font-size: 12px; color: #555; margin-top: 3px; }

  .title-wrap { text-align: center; margin-bottom: 2rem; }
  .title-box { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border: 2px solid #111; display: inline-block; padding: 7px 24px; }

  .patient-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 0.5rem; }
  .patient-info { margin-bottom: 1.5rem; }
  .patient-meta { font-size: 13px; color: #444; margin-top: 3px; }
  .allergies { font-size: 13px; color: #c00; font-weight: 600; margin-top: 4px; }

  .meds { flex: 1; margin-bottom: 1rem; }
  .med-item { padding: 10px 0 10px 14px; border-left: 4px solid #ccc; margin-bottom: 12px; }
  .med-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .med-detail { font-size: 13px; color: #333; margin-left: 12px; margin-top: 2px; }
  .med-note { font-size: 12px; color: #666; font-style: italic; margin-left: 12px; margin-top: 3px; }

  .notes-block { border-top: 1px solid #ddd; padding-top: 1rem; margin-bottom: 1rem; }
  .notes-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .notes-body { font-size: 13px; white-space: pre-wrap; }

  .signature { margin-top: auto; text-align: right; padding-top: 2rem; }
  .signature span { font-size: 13px; font-weight: 600; display: block; margin-bottom: 2.5rem; }
  .sig-line { width: 160px; border-bottom: 1px solid #999; margin-left: auto; }

  .footer-info { text-align: center; font-size: 11px; color: #777; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 1rem; }
</style>
</head>
<body>
<div class="page">
    <div class="header">
        <h1>${escHtml(nomCabinet)}</h1>
        ${specialite ? `<p class="sub">${escHtml(specialite)}</p>` : ''}
        ${adresse    ? `<p class="sub">${escHtml(adresse)}</p>`    : ''}
    </div>

    <div class="title-wrap">
        <span class="title-box">Ordonnance Médicale</span>
    </div>

    <div class="patient-info">
        <div class="patient-row">
            <span><strong>Patient&nbsp;:</strong>&nbsp;${escHtml((patient?.nom || '') + ' ' + (patient?.prenom || ''))}</span>
            <span>Le&nbsp;${dateOrdonnance}</span>
        </div>
        ${(age || patient?.poids) ? `<p class="patient-meta">${age ? age : ''}${age && patient?.poids ? ', ' : ''}${patient?.poids ? patient.poids + ' kg' : ''}</p>` : ''}
        ${patient?.allergies ? `<p class="allergies">Allergies : ${escHtml(patient.allergies)}</p>` : ''}
    </div>

    <div class="meds">
        ${medsHtml}
    </div>

    ${notesHtml}

    <div class="signature">
        <span>Signature&nbsp;/&nbsp;Cachet</span>
        <div class="sig-line"></div>
    </div>

    ${piedPage}
</div>
</body>
</html>`);

        pw.document.close();
        setTimeout(() => { pw.focus(); pw.print(); }, 400);
    };

    const age = calculateAge(patient?.date_naissance);

    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Ordonnance médicale</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {patient?.nom} {patient?.prenom}{age ? ` — ${age}` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimer
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Aperçu screen simplifié */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="text-center border-b pb-3">
                        <p className="font-bold text-slate-900">{settings?.nom_cabinet || 'Docteur'}</p>
                        {settings?.specialite && <p className="text-xs text-slate-500">{settings.specialite}</p>}
                        {settings?.adresse_cabinet && <p className="text-xs text-slate-400">{settings.adresse_cabinet}</p>}
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="font-medium">{patient?.nom} {patient?.prenom}{age ? ` (${age})` : ''}</span>
                        <span className="text-slate-500">
                            {new Date(prescription?.date_prescription || new Date()).toLocaleDateString('fr-FR')}
                        </span>
                    </div>

                    {patient?.allergies && (
                        <p className="text-sm text-red-600 font-medium">Allergies : {patient.allergies}</p>
                    )}

                    <div className="space-y-3">
                        {prescription?.medicaments?.map((med: any, idx: number) => {
                            const medInfo = medicaments[med.medicament_id];
                            const nomMed = medInfo ? (medInfo.nomMedicament || medInfo.nom_commercial) : (med.nomMedicament || 'Médicament inconnu');
                            return (
                                <div key={idx} className="pl-3 border-l-4 border-slate-200">
                                    <p className="font-bold text-sm text-slate-900">• {nomMed}</p>
                                    <p className="text-sm text-slate-700 ml-3">Posologie : {med.posologie}</p>
                                    <p className="text-sm text-slate-700 ml-3">Durée : {med.duree}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end p-5 border-t border-slate-200">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}
