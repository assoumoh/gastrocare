import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react';

export default function ImportMedicaments() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [allTransformed, setAllTransformed] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeBeforeImport, setPurgeBeforeImport] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error';
    read: number;
    imported: number;
    skipped: number;
    errors: number;
    errorDetails: string[];
  }>({
    status: 'idle',
    read: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setImportStatus({ status: 'idle', read: 0, imported: 0, skipped: 0, errors: 0, errorDetails: [] });
      setProgress(0);
      readExcelPreview(selectedFile);
    }
  };

  // ── Helpers ──────────────────────────────────────────────

  const generateSearchKeywords = (nom: string, dci: string, dosage: string, famille: string, forme: string) => {
    const keywords = new Set<string>();
    const addWords = (text: string) => {
      if (!text) return;
      const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const words = normalized.split(/[\s/\-_,;.()]+/);
      words.forEach(w => { if (w.length > 1) keywords.add(w); });
      keywords.add(normalized);
    };
    addWords(nom);
    addWords(dci);
    addWords(famille);
    addWords(forme);
    if (nom && dosage) keywords.add(`${nom.toLowerCase()} ${dosage.toLowerCase()}`);
    return Array.from(keywords);
  };

  const parseNumber = (val: any): number | null => {
    if (val === undefined || val === null || val === '-' || val === '') return null;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace(/\s/g, '').replace(/,/g, '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  const parsePercentage = (val: any): number | null => {
    if (val === undefined || val === null || val === '-' || val === '') return null;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace('%', '').replace(/\s/g, '').replace(/,/g, '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  const cleanString = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim().replace(/\s{2,}/g, ' ');
  };

  const parseDosageString = (dosageStr: string): { dosage: string; unite: string } => {
    if (!dosageStr) return { dosage: '', unite: '' };
    const match = dosageStr.trim().match(/^([\d.,/]+)\s*(.*)$/);
    if (match) return { dosage: match[1].trim(), unite: match[2].trim() || 'mg' };
    return { dosage: dosageStr, unite: '' };
  };

  // Robust key finder: case-insensitive, accent-insensitive, trimmed, partial match
  const findKey = (row: any, ...candidates: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const candidate of candidates) {
      const candNorm = candidate.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // Exact (after normalization)
      for (const k of rowKeys) {
        const kNorm = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (kNorm === candNorm) return row[k];
      }
    }
    // Partial match fallback
    for (const candidate of candidates) {
      const candNorm = candidate.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const k of rowKeys) {
        const kNorm = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (kNorm.includes(candNorm) || candNorm.includes(kNorm)) return row[k];
      }
    }
    return undefined;
  };

  const detectFormat = (keys: string[]): 'appsheet' | 'standard' | 'unknown' => {
    const keysLower = keys.map(k => k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    // AppSheet: Nom_Médicament, DCI, Famille, Dosage_Standard
    if (keysLower.some(k => k.includes('nom_medicament') || k.includes('nom_m'))) {
      // Exclude false positives: make sure it's not "ID_Médicament" only
      if (keysLower.some(k => k.startsWith('nom_m') || k.startsWith('nom medicament'))) {
        return 'appsheet';
      }
    }
    // Standard: NOM, DCI1, DOSAGE1, FORME
    if (keysLower.some(k => k === 'nom') || keysLower.some(k => k === 'dci1')) return 'standard';
    return 'unknown';
  };

  const transformRow = (row: any, fileName: string, format: 'appsheet' | 'standard' | 'unknown', rowIndex: number) => {
    let nomMedicament = '';
    let dci = '';
    let dosage = '';
    let uniteDosage = '';
    let forme = '';
    let presentation = '';
    let ppv: number | null = null;
    let ph: number | null = null;
    let prixBr: number | null = null;
    let princepsGenerique = '';
    let tauxRemboursement: number | null = null;
    let famille = '';

    if (format === 'appsheet') {
      nomMedicament = cleanString(findKey(row, 'Nom_Médicament', 'Nom_Medicament', 'NOM'));
      dci = cleanString(findKey(row, 'DCI', 'DCI1'));
      famille = cleanString(findKey(row, 'Famille', 'FAMILLE', 'Catégorie'));
      forme = cleanString(findKey(row, 'Forme', 'FORME'));
      const dosageRaw = cleanString(findKey(row, 'Dosage_Standard', 'Dosage', 'DOSAGE1'));
      const parsed = parseDosageString(dosageRaw);
      dosage = parsed.dosage;
      uniteDosage = parsed.unite;
      presentation = cleanString(findKey(row, 'Présentation', 'Presentation', 'PRESENTATION'));
      ppv = parseNumber(findKey(row, 'PPV', 'Prix'));
    } else {
      // Standard format — NOW uses findKey for robustness
      nomMedicament = cleanString(findKey(row, 'NOM', 'Nom', 'nom'));
      dci = cleanString(findKey(row, 'DCI1', 'DCI', 'dci1', 'dci'));
      dosage = cleanString(findKey(row, 'DOSAGE1', 'Dosage', 'dosage1', 'dosage'));
      uniteDosage = cleanString(findKey(row, 'UNITE_DOSAGE1', 'Unite_Dosage', 'unite_dosage1', 'unité'));
      forme = cleanString(findKey(row, 'FORME', 'Forme', 'forme'));
      presentation = cleanString(findKey(row, 'PRESENTATION', 'Présentation', 'presentation'));
      ppv = parseNumber(findKey(row, 'PPV', 'ppv'));
      ph = parseNumber(findKey(row, 'PH', 'ph'));
      prixBr = parseNumber(findKey(row, 'PRIX_BR', 'Prix_BR', 'prix_br'));
      princepsGenerique = cleanString(findKey(row, 'PRINCEPS_GENERIQUE', 'Princeps_Generique', 'princeps'));
      tauxRemboursement = parsePercentage(findKey(row, 'TAUX_REMBOURSEMENT', 'Taux_Remboursement', 'taux'));
      famille = cleanString(findKey(row, 'FAMILLE', 'Famille', 'famille'));
    }

    if (!nomMedicament) return null;

    // FIX Bug 2: Include PPV and princeps in slug to avoid collisions
    // for identical meds with different prices/generics
    const slugSource = `${nomMedicament}-${dci}-${dosage}-${uniteDosage}-${forme}-${presentation}-${princepsGenerique}`;
    const id = slugSource
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 120);

    const result: Record<string, any> = {
      id,
      nomMedicament,
      dci,
      dosage,
      uniteDosage,
      forme,
      presentation,
      actif: true,
      sourceImport: 'excel',
      nomFichierImport: fileName,
      dateImport: new Date().toISOString(),
      searchKeywords: generateSearchKeywords(nomMedicament, dci, dosage, famille, forme)
    };

    if (famille) result.famille = famille;
    if (ppv !== null) result.ppv = ppv;
    if (ph !== null) result.ph = ph;
    if (prixBr !== null) result.prixBr = prixBr;
    if (princepsGenerique) result.princepsGenerique = princepsGenerique;
    if (tauxRemboursement !== null) result.tauxRemboursement = tauxRemboursement;

    return result;
  };

  // ── File reading ─────────────────────────────────────────

  const readExcelPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length > 0) {
          const keys = Object.keys(json[0] as object);
          setColumns(keys);
          const format = detectFormat(keys);

          // Transform ALL rows for accurate count and duplicate detection
          const all = json
            .map((row, idx) => transformRow(row, file.name, format, idx))
            .filter(Boolean);
          setAllTransformed(all);

          // Preview first 5
          setPreviewData(all.slice(0, 5));

          // Detect duplicates
          const idSet = new Set<string>();
          let dupes = 0;
          all.forEach((row: any) => {
            if (idSet.has(row.id)) dupes++;
            idSet.add(row.id);
          });

          setImportStatus(prev => ({
            ...prev,
            read: json.length,
            skipped: json.length - all.length,
            errors: 0,
            status: 'idle'
          }));

          if (dupes > 0) {
            console.warn(`${dupes} doublons détectés (seront fusionnés à l'import)`);
          }
        }
      } catch (error) {
        console.error("Erreur de lecture du fichier:", error);
        alert("Erreur lors de la lecture du fichier Excel. Vérifiez le format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Purge collection ─────────────────────────────────────

  const handlePurge = async () => {
    if (!window.confirm(
      'ATTENTION : Ceci va supprimer TOUS les médicaments existants dans la base.\n\n' +
      'Cette action est irréversible. Continuer ?'
    )) return;

    setPurging(true);
    try {
      const snapshot = await getDocs(collection(db, 'medicaments'));
      const CHUNK = 400;
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      alert(`${docs.length} médicaments supprimés. Vous pouvez maintenant importer le nouveau fichier.`);
    } catch (error: any) {
      console.error("Erreur purge:", error);
      alert("Erreur lors de la suppression : " + error.message);
    } finally {
      setPurging(false);
    }
  };

  // ── Import ───────────────────────────────────────────────

  const handleImport = async () => {
    if (!file || allTransformed.length === 0) return;

    // Purge first if requested
    if (purgeBeforeImport) {
      if (!window.confirm(
        `Vous avez coché "Vider la base avant import".\n` +
        `Cela supprimera TOUS les médicaments existants, puis importera ${allTransformed.length} nouveaux enregistrements.\n\nContinuer ?`
      )) return;

      setPurging(true);
      try {
        const snapshot = await getDocs(collection(db, 'medicaments'));
        const CHUNK = 400;
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += CHUNK) {
          const batch = writeBatch(db);
          docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (error: any) {
        alert("Erreur lors de la purge : " + error.message);
        setPurging(false);
        return;
      }
      setPurging(false);
    }

    setLoading(true);
    setProgress(0);
    setImportStatus(prev => ({
      ...prev,
      status: 'processing',
      imported: 0,
      errors: 0,
      errorDetails: []
    }));

    try {
      let importedCount = 0;
      let errorCount = 0;
      const errorDetails: string[] = [];
      const CHUNK_SIZE = 400;
      const total = allTransformed.length;

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = allTransformed.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        let chunkValid = 0;

        for (const transformed of chunk) {
          try {
            const { id, ...docData } = transformed;
            const docRef = doc(db, 'medicaments', id);
            batch.set(docRef, docData, { merge: true });
            chunkValid++;
          } catch (err: any) {
            errorCount++;
            errorDetails.push(`ID ${transformed.id}: ${err.message}`);
          }
        }

        // FIX Bug 3: Retry batch once on failure
        try {
          await batch.commit();
          importedCount += chunkValid;
        } catch (batchError: any) {
          console.warn(`Batch ${Math.floor(i / CHUNK_SIZE) + 1} failed, retrying...`, batchError);
          // Wait 1s and retry
          await new Promise(r => setTimeout(r, 1000));
          try {
            const retryBatch = writeBatch(db);
            for (const transformed of chunk) {
              const { id, ...docData } = transformed;
              retryBatch.set(doc(db, 'medicaments', id), docData, { merge: true });
            }
            await retryBatch.commit();
            importedCount += chunkValid;
          } catch (retryError: any) {
            errorCount += chunkValid;
            errorDetails.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1} (${chunkValid} docs): ${retryError.message}`);
          }
        }

        const pct = Math.round(((i + chunk.length) / total) * 100);
        setProgress(pct);
        setImportStatus(prev => ({ ...prev, imported: importedCount, errors: errorCount }));
      }

      setProgress(100);
      setImportStatus({
        status: importedCount > 0 ? 'success' : 'error',
        read: total,
        imported: importedCount,
        skipped: importStatus.skipped,
        errors: errorCount,
        errorDetails
      });
    } catch (error: any) {
      console.error("Erreur d'import:", error);
      setImportStatus(prev => ({
        ...prev,
        status: 'error',
        errorDetails: [error.message || "Erreur inconnue lors de l'importation"]
      }));
    } finally {
      setLoading(false);
    }
  };

  // ── Detected format label ────────────────────────────────

  const detectedFormatLabel = columns.length > 0
    ? detectFormat(columns) === 'standard'
      ? 'Format standard (NOM, DCI1, DOSAGE1…)'
      : detectFormat(columns) === 'appsheet'
        ? 'Format AppSheet (Nom_Médicament, DCI…)'
        : 'Format non reconnu'
    : '';

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/medicaments')} className="text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-semibold text-slate-900">Import Base Médicaments</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">

          {/* Info format */}
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Formats acceptés</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>Format standard :</strong> Colonnes <code>NOM</code>, <code>DCI1</code>, <code>DOSAGE1</code>, <code>UNITE_DOSAGE1</code>, <code>FORME</code>, <code>PRESENTATION</code>, <code>PPV</code>, <code>PH</code>, <code>PRIX_BR</code>, <code>PRINCEPS_GENERIQUE</code>, <code>TAUX_REMBOURSEMENT</code></p>
              <p><strong>Format AppSheet :</strong> Colonnes <code>Nom_Médicament</code>, <code>DCI</code>, <code>Famille</code>, <code>Forme</code>, <code>Dosage_Standard</code></p>
              <p>Le format est détecté automatiquement. Les doublons sont fusionnés (pas de duplication).</p>
            </div>
          </div>

          {/* Purge standalone */}
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-red-800">Vider la base existante</h3>
                <p className="text-xs text-red-600 mt-1">Supprimer tous les médicaments actuels avant un nouvel import</p>
              </div>
              <button
                onClick={handlePurge}
                disabled={purging || loading}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {purging ? 'Suppression...' : 'Vider la base'}
              </button>
            </div>
          </div>

          {/* 1. Upload zone */}
          <div>
            <h2 className="text-lg font-medium text-slate-900 mb-4">1. Sélectionner le fichier Excel</h2>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
              <div className="space-y-1 text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-slate-400" />
                <div className="flex text-sm text-slate-600 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Uploader un fichier</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
                  </label>
                </div>
                <p className="text-xs text-slate-500">XLSX, XLS, CSV — jusqu'à 10 MB</p>
              </div>
            </div>
            {file && (
              <p className="mt-2 text-sm text-green-600 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Fichier sélectionné : {file.name}
              </p>
            )}
          </div>

          {/* Detected columns & format */}
          {columns.length > 0 && importStatus.status === 'idle' && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-700">Colonnes détectées :</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {detectedFormatLabel}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {columns.map((col, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {col}
                  </span>
                ))}
              </div>
              {importStatus.skipped > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ {importStatus.skipped} lignes sans nom de médicament seront ignorées.
                </p>
              )}
            </div>
          )}

          {/* 2. Preview */}
          {previewData.length > 0 && importStatus.status === 'idle' && (
            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-medium text-slate-900 mb-4">2. Prévisualisation</h2>
              <p className="text-sm text-slate-600 mb-4">
                <strong>{allTransformed.length}</strong> médicaments valides sur <strong>{importStatus.read}</strong> lignes lues. Aperçu des 5 premiers :
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">DCI</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Dosage</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Forme</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Présentation</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">PPV</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">P/G</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Remb.</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {previewData.map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-900">{row.nomMedicament}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.dci}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.dosage} {row.uniteDosage}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.forme}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.presentation || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.ppv ?? '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.princepsGenerique || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.tauxRemboursement != null ? `${row.tauxRemboursement}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Options */}
              <div className="mt-4 flex items-center">
                <input
                  id="purge-before"
                  type="checkbox"
                  checked={purgeBeforeImport}
                  onChange={(e) => setPurgeBeforeImport(e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-slate-300 rounded"
                />
                <label htmlFor="purge-before" className="ml-2 text-sm text-red-700">
                  Vider la base avant l'import (recommandé si vous repartez de zéro)
                </label>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => { setFile(null); setPreviewData([]); setAllTransformed([]); setColumns([]); }}
                  className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || purging}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {loading ? `Import en cours… ${progress}%` : `Confirmer l'import de ${allTransformed.length} médicaments`}
                </button>
              </div>
            </div>
          )}

          {/* Processing with progress bar */}
          {importStatus.status === 'processing' && (
            <div className="border-t border-slate-200 pt-6">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex items-center mb-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">
                      {purging ? 'Suppression en cours…' : 'Importation en cours…'}
                    </h3>
                    <p className="mt-1 text-sm text-blue-700">
                      {importStatus.imported} / {allTransformed.length} médicaments traités
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-blue-200 rounded-full h-2.5">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-blue-600 mt-1 text-right">{progress}%</p>
              </div>
            </div>
          )}

          {/* Success */}
          {importStatus.status === 'success' && (
            <div className="border-t border-slate-200 pt-6">
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Importation terminée avec succès</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Lignes lues : {importStatus.read}</li>
                        <li>Médicaments importés/mis à jour : {importStatus.imported}</li>
                        {importStatus.skipped > 0 && <li>Lignes ignorées (sans nom) : {importStatus.skipped}</li>}
                        <li>Erreurs : {importStatus.errors}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              {importStatus.errorDetails.length > 0 && (
                <div className="mt-4 rounded-md bg-yellow-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Détails des erreurs</h3>
                      <div className="mt-2 text-sm text-yellow-700 max-h-40 overflow-y-auto">
                        <ul className="list-disc pl-5 space-y-1">
                          {importStatus.errorDetails.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6">
                <button onClick={() => navigate('/medicaments')} className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
                  Retour à la liste des médicaments
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {importStatus.status === 'error' && (
            <div className="border-t border-slate-200 pt-6">
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Erreur lors de l'importation</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc pl-5 space-y-1">
                        {importStatus.errorDetails.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
