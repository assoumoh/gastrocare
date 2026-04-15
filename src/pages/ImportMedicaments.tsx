import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ImportMedicaments() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error';
    read: number;
    imported: number;
    duplicates: number;
    errors: number;
    errorDetails: string[];
  }>({
    status: 'idle',
    read: 0,
    imported: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: []
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setImportStatus({ status: 'idle', read: 0, imported: 0, duplicates: 0, errors: 0, errorDetails: [] });
      readExcelPreview(selectedFile);
    }
  };

  const generateSearchKeywords = (nom: string, dci: string, dosage: string, famille: string) => {
    const keywords = new Set<string>();
    const addWords = (text: string) => {
      if (!text) return;
      const words = text.toLowerCase().split(/[\s/\-_]+/);
      words.forEach(w => { if (w.length > 2) keywords.add(w); });
      keywords.add(text.toLowerCase());
    };
    addWords(nom);
    addWords(dci);
    addWords(famille);
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
    let str = String(val).trim().replace('%', '');
    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  };

  const cleanString = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim().replace(/\s{2,}/g, ' ');
  };

  // Extraire dosage numérique et unité depuis une chaîne comme "250 mg" ou "1 g"
  const parseDosageString = (dosageStr: string): { dosage: string; unite: string } => {
    if (!dosageStr) return { dosage: '', unite: '' };
    const match = dosageStr.trim().match(/^([\d.,]+)\s*(.*)$/);
    if (match) {
      return { dosage: match[1].trim(), unite: match[2].trim() || 'mg' };
    }
    return { dosage: dosageStr, unite: '' };
  };

  // Détecte le format du fichier et transforme la ligne
  const detectFormat = (keys: string[]): 'appsheet' | 'standard' | 'unknown' => {
    const keysLower = keys.map(k => k.toLowerCase().trim());
    // Format AppSheet : Nom_Médicament, DCI, Famille, Forme, Dosage_Standard
    if (keysLower.some(k => k.includes('nom_m') || k.includes('nom_medicament'))) return 'appsheet';
    // Format standard : NOM, DCI1, DOSAGE1, FORME
    if (keysLower.some(k => k === 'nom')) return 'standard';
    return 'unknown';
  };

  // Cherche une clé dans l'objet de manière case-insensitive et accent-insensitive
  const findKey = (row: any, ...candidates: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const candidate of candidates) {
      // Exact match
      if (row[candidate] !== undefined) return row[candidate];
      // Case-insensitive
      const found = rowKeys.find(k => k.toLowerCase().trim() === candidate.toLowerCase().trim());
      if (found) return row[found];
      // Partial match
      const partial = rowKeys.find(k => k.toLowerCase().trim().includes(candidate.toLowerCase().trim()));
      if (partial) return row[partial];
    }
    return undefined;
  };

  const transformRow = (row: any, fileName: string, format: 'appsheet' | 'standard' | 'unknown') => {
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
      // Format du fichier Excel partagé
      nomMedicament = cleanString(findKey(row, 'Nom_Médicament', 'Nom_Medicament', 'NOM'));
      dci = cleanString(findKey(row, 'DCI', 'DCI1'));
      famille = cleanString(findKey(row, 'Famille', 'FAMILLE', 'Catégorie', 'Categorie'));
      forme = cleanString(findKey(row, 'Forme', 'FORME'));
      const dosageRaw = cleanString(findKey(row, 'Dosage_Standard', 'Dosage', 'DOSAGE1'));
      const parsed = parseDosageString(dosageRaw);
      dosage = parsed.dosage;
      uniteDosage = parsed.unite;
      presentation = cleanString(findKey(row, 'Présentation', 'Presentation', 'PRESENTATION'));
      ppv = parseNumber(findKey(row, 'PPV', 'Prix'));
    } else {
      // Format standard (ancien)
      nomMedicament = cleanString(row['NOM']);
      dci = cleanString(row['DCI1']);
      dosage = cleanString(row['DOSAGE1']);
      uniteDosage = cleanString(row['UNITE_DOSAGE1']);
      forme = cleanString(row['FORME']);
      presentation = cleanString(row['PRESENTATION']);
      ppv = parseNumber(row['PPV']);
      ph = parseNumber(row['PH']);
      prixBr = parseNumber(row['PRIX_BR']);
      princepsGenerique = cleanString(row['PRINCEPS_GENERIQUE']);
      tauxRemboursement = parsePercentage(row['TAUX_REMBOURSEMENT']);
      famille = cleanString(row['FAMILLE']);
    }

    if (!nomMedicament) return null;

    // ID déterministe pour déduplication
    const slugSource = `${nomMedicament}-${dci}-${dosage}-${uniteDosage}-${forme}-${presentation}`;
    const id = slugSource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 100);

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
      searchKeywords: generateSearchKeywords(nomMedicament, dci, dosage, famille)
    };

    // Champs optionnels : n'écrire que s'ils ont une valeur
    if (famille) result.famille = famille;
    if (ppv !== null) result.ppv = ppv;
    if (ph !== null) result.ph = ph;
    if (prixBr !== null) result.prixBr = prixBr;
    if (princepsGenerique) result.princepsGenerique = princepsGenerique;
    if (tauxRemboursement !== null) result.tauxRemboursement = tauxRemboursement;

    return result;
  };

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
          const preview = json.slice(0, 5).map(row => transformRow(row, file.name, format)).filter(Boolean);
          setPreviewData(preview);
          setImportStatus(prev => ({ ...prev, read: json.length, status: 'idle' }));
        }
      } catch (error) {
        console.error("Erreur de lecture du fichier:", error);
        alert("Erreur lors de la lecture du fichier Excel. Vérifiez le format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setImportStatus(prev => ({ ...prev, status: 'processing', imported: 0, duplicates: 0, errors: 0, errorDetails: [] }));

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const keys = json.length > 0 ? Object.keys(json[0] as object) : [];
        const format = detectFormat(keys);

        let importedCount = 0;
        let errorCount = 0;
        const errorDetails: string[] = [];
        const CHUNK_SIZE = 400;

        for (let i = 0; i < json.length; i += CHUNK_SIZE) {
          const chunk = json.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);

          for (const row of chunk) {
            try {
              const transformed = transformRow(row, file.name, format);
              if (!transformed) continue;

              const { id, ...docData } = transformed;
              const docRef = doc(db, 'medicaments', id);
              batch.set(docRef, docData, { merge: true });
              importedCount++;
            } catch (err: any) {
              errorCount++;
              errorDetails.push(`Ligne ${i + chunk.indexOf(row) + 2}: ${err.message}`);
            }
          }

          await batch.commit();

          // Progress update
          setImportStatus(prev => ({ ...prev, imported: importedCount }));
        }

        setImportStatus({
          status: 'success',
          read: json.length,
          imported: importedCount,
          duplicates: 0,
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
    reader.readAsBinaryString(file);
  };

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
              <p><strong>Format AppSheet :</strong> Colonnes <code>Nom_Médicament</code>, <code>DCI</code>, <code>Famille</code>, <code>Forme</code>, <code>Dosage_Standard</code> (ex: "250 mg")</p>
              <p><strong>Format standard :</strong> Colonnes <code>NOM</code>, <code>DCI1</code>, <code>DOSAGE1</code>, <code>UNITE_DOSAGE1</code>, <code>FORME</code>, <code>PRESENTATION</code>, <code>PPV</code>, <code>PH</code>, <code>PRIX_BR</code></p>
              <p>Le format est détecté automatiquement. Les doublons sont mis à jour (pas de duplication).</p>
            </div>
          </div>

          {/* 1. Zone d'upload */}
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
                <p className="text-xs text-slate-500">XLSX, XLS, CSV — jusqu'à 10MB</p>
              </div>
            </div>
            {file && (
              <p className="mt-2 text-sm text-green-600 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Fichier sélectionné : {file.name}
              </p>
            )}
          </div>

          {/* Colonnes détectées */}
          {columns.length > 0 && importStatus.status === 'idle' && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Colonnes détectées dans le fichier :</h3>
              <div className="flex flex-wrap gap-2">
                {columns.map((col, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 2. Prévisualisation */}
          {previewData.length > 0 && importStatus.status === 'idle' && (
            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-medium text-slate-900 mb-4">2. Prévisualisation</h2>
              <p className="text-sm text-slate-600 mb-4">
                {importStatus.read} lignes détectées. Voici un aperçu des 5 premières lignes transformées :
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nom</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">DCI</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Dosage</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Forme</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Famille</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Présentation</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900 font-medium">{row.nomMedicament}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.dci}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.dosage} {row.uniteDosage}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.forme}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.famille || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.presentation || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => { setFile(null); setPreviewData([]); setColumns([]); }}
                  className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {loading ? `Importation en cours... (${importStatus.imported})` : `Confirmer l'import de ${importStatus.read} médicaments`}
                </button>
              </div>
            </div>
          )}

          {/* Processing */}
          {importStatus.status === 'processing' && (
            <div className="border-t border-slate-200 pt-6">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">Importation en cours...</h3>
                    <p className="mt-1 text-sm text-blue-700">{importStatus.imported} / {importStatus.read} médicaments traités</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Rapport d'import */}
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
                        <li>Médicaments insérés/mis à jour : {importStatus.imported}</li>
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
