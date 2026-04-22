/**
 * Utilitaires partagés pour la génération et l'impression des demandes d'examens.
 * Utilisé par ExamRequestModal (workflow) et PatientExams (réimpression).
 */

export interface ExamEntryForPrint {
    type_examen: string;
    nom_examen: string;
    commentaire?: string;
}

export interface ExamDocument {
    key: string;
    exams: ExamEntryForPrint[];
    note: string;
}

/** Regroupe : tous les Biologie → 1 doc, chaque autre type → 1 doc par examen */
export function buildDocuments(exams: ExamEntryForPrint[]): ExamDocument[] {
    const biologieExams = exams.filter(e => e.type_examen === 'Biologie');
    const otherExams    = exams.filter(e => e.type_examen !== 'Biologie');
    const docs: ExamDocument[] = [];

    if (biologieExams.length > 0) {
        const mergedNote = biologieExams
            .map(e => e.commentaire?.trim())
            .filter(Boolean)
            .join(' · ');
        docs.push({ key: 'biologie', exams: biologieExams, note: mergedNote });
    }
    otherExams.forEach((e, i) => {
        docs.push({ key: `other-${i}`, exams: [e], note: (e.commentaire || '').trim() });
    });
    return docs;
}

const escHtml = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface CabinetInfoForPrint {
    nom_cabinet?: string;
    specialite?: string;
    adresse_cabinet?: string;
    numero_ordre?: string;
    inpe?: string;
}

/** Ouvre une nouvelle fenêtre vierge et lance l'impression des documents. */
export function printDocuments(
    documents: ExamDocument[],
    patientName: string,
    cabinet?: CabinetInfoForPrint,
) {
    const pw = window.open('', '_blank');
    if (!pw) {
        alert("Veuillez autoriser les popups pour ce site afin d'imprimer.");
        return;
    }

    const today       = new Date().toLocaleDateString('fr-FR');
    const nomCabinet  = cabinet?.nom_cabinet     || 'Docteur';
    const specialite  = cabinet?.specialite      || '';
    const adresse     = cabinet?.adresse_cabinet || '';
    const numeroOrdre = cabinet?.numero_ordre    || '';
    const inpe        = cabinet?.inpe            || '';

    const piedPage = (numeroOrdre || inpe)
        ? `<div class="footer-info">${numeroOrdre ? `N° Ordre&nbsp;: ${escHtml(numeroOrdre)}` : ''}${numeroOrdre && inpe ? '&emsp;|&emsp;' : ''}${inpe ? `INPE&nbsp;: ${escHtml(inpe)}` : ''}</div>`
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
            ${docu.note ? `<div class="note"><strong>Note&nbsp;:</strong>&nbsp;${escHtml(docu.note)}</div>` : ''}
            <div class="exams">
                ${docu.exams.map(e => `<div class="exam-item">&bull;&nbsp;${escHtml(e.nom_examen)}</div>`).join('')}
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
  .page { min-height: 24cm; display: flex; flex-direction: column; padding-bottom: 0.5cm; }
  .page + .page { page-break-before: always; }
  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 1rem; margin-bottom: 2rem; }
  .header h1 { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
  .header .sub { font-size: 12px; color: #555; margin-top: 3px; }
  .title-wrap { text-align: center; margin-bottom: 2rem; }
  .title-box { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; border: 2px solid #111; display: inline-block; padding: 7px 20px; }
  .patient-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 2rem; }
  .note { background: #f5f5f5; border-left: 4px solid #888; padding: 10px 14px; margin-bottom: 1.5rem; font-size: 13px; }
  .exams { flex: 1; margin-bottom: 1rem; }
  .exam-item { font-size: 15px; font-weight: 700; padding: 7px 0 7px 14px; border-left: 4px solid #ccc; margin-bottom: 8px; }
  .signature { margin-top: auto; text-align: right; padding-top: 2rem; }
  .signature span { font-size: 13px; font-weight: 600; display: block; margin-bottom: 2.5rem; }
  .sig-line { width: 160px; border-bottom: 1px solid #999; margin-left: auto; }
  .footer-info { text-align: center; font-size: 11px; color: #777; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 1rem; }
</style>
</head>
<body>${pages}</body>
</html>`);

    pw.document.close();
    setTimeout(() => { pw.focus(); pw.print(); }, 400);
}
