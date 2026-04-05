import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, getDocs, query, limit } from 'firebase/firestore';
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
      readExcelPreview(selectedFile);
    }
  };

  const generateSearchKeywords = (nom: string, dci: string, dosage: string) => {
    const keywords = new Set<string>();
    
    const addWords = (text: string) => {
      if (!text) return;
      // Split by spaces, slashes, dashes
      const words = text.toLowerCase().split(/[\s/\-]+/);
      words.forEach(w => {
        if (w.length > 2) keywords.add(w);
      });
      keywords.add(text.toLowerCase());
    };

    addWords(nom);
    addWords(dci);
    if (nom && dosage) {
      keywords.add(`${nom.toLowerCase()} ${dosage.toLowerCase()}`);
    }

    return Array.from(keywords);
  };

  const parseNumber = (val: any): number | null => {
    if (val === undefined || val === null || val === '-' || val === '') return null;
    if (typeof val === 'number') return val;
    
    // Handle string like "2 882,00" -> 2882.00
    let str = String(val).trim();
    str = str.replace(/\s/g, ''); // Remove spaces
    str = str.replace(/,/g, '.'); // Replace comma with dot
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  const parsePercentage = (val: any): number | null => {
    if (val === undefined || val === null || val === '-' || val === '') return null;
    if (typeof val === 'number') return val;
    
    let str = String(val).trim();
    str = str.replace('%', '');
    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  };

  const cleanString = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim().replace(/\s{2,}/g, ' ');
  };

  const transformRow = (row: any, fileName: string) => {
    const nomMedicament = cleanString(row['NOM']);
    const dci = cleanString(row['DCI1']);
    const dosage = cleanString(row['DOSAGE1']);
    const uniteDosage = cleanString(row['UNITE_DOSAGE1']);
    const forme = cleanString(row['FORME']);
    const presentation = cleanString(row['PRESENTATION']);

    if (!nomMedicament) return null; // Skip empty rows

    // Create a deterministic ID to avoid duplicates
    // We use a combination of nom, dci, dosage, forme to create a unique slug
    const slugSource = `${nomMedicament}-${dci}-${dosage}-${uniteDosage}-${forme}-${presentation}`;
    const id = slugSource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    return {
      id,
      nomMedicament,
      dci,
      dosage,
      uniteDosage,
      forme,
      presentation,
      ppv: parseNumber(row['PPV']),
      ph: parseNumber(row['PH']),
      prixBr: parseNumber(row['PRIX_BR']),
      princepsGenerique: cleanString(row['PRINCEPS_GENERIQUE']),
      tauxRemboursement: parsePercentage(row['TAUX_REMBOURSEMENT']),
      sourceImport: 'excel',
      nomFichierImport: fileName,
      dateImport: new Date().toISOString(),
      actif: true,
      searchKeywords: generateSearchKeywords(nomMedicament, dci, dosage)
    };
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
          setColumns(Object.keys(json[0] as object));
          
          // Transform first 5 rows for preview
          const preview = json.slice(0, 5).map(row => transformRow(row, file.name)).filter(Boolean);
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
        
        let importedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        const errorDetails: string[] = [];

        // Chunk processing to avoid memory/batch limits
        const CHUNK_SIZE = 400; // Firestore batch limit is 500
        
        for (let i = 0; i < json.length; i += CHUNK_SIZE) {
          const chunk = json.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          
          for (const row of chunk) {
            try {
              const transformed = transformRow(row, file.name);
              if (!transformed) continue; // Skip invalid rows

              const docRef = doc(db, 'medicaments', transformed.id);
              
              // We use set with merge: true to update existing or create new
              // This acts as a simple deduplication strategy (upsert)
              batch.set(docRef, transformed, { merge: true });
              importedCount++;
              
            } catch (err: any) {
              errorCount++;
              errorDetails.push(`Ligne ${i + chunk.indexOf(row) + 2}: ${err.message}`);
            }
          }
          
          await batch.commit();
        }

        setImportStatus({
          status: 'success',
          read: json.length,
          imported: importedCount,
          duplicates: duplicateCount, // With upsert, we don't strictly count skipped duplicates unless we read first
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
          
          {/* 1. Zone d'upload */}
          <div>
            <h2 className="text-lg font-medium text-slate-900 mb-4">1. Sélectionner le fichier Excel</h2>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-slate-400" />
                <div className="flex text-sm text-slate-600 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Uploader un fichier</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} />
                  </label>
                </div>
                <p className="text-xs text-slate-500">XLSX, XLS jusqu'à 10MB</p>
              </div>
            </div>
            {file && (
              <p className="mt-2 text-sm text-green-600 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Fichier sélectionné : {file.name}
              </p>
            )}
          </div>

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
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Prix BR</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Taux R.</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-900">{row.nomMedicament}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.dci}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.dosage} {row.uniteDosage}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.forme}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.prixBr}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-500">{row.tauxRemboursement !== null ? `${row.tauxRemboursement}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 3. Validation */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {loading ? 'Importation en cours...' : 'Confirmer l\'import vers Firebase'}
                </button>
              </div>
            </div>
          )}

          {/* 4. Rapport d'import */}
          {importStatus.status === 'success' && (
            <div className="border-t border-slate-200 pt-6">
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" aria-hidden="true" />
                  </div>
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
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                    </div>
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
                <button
                  onClick={() => navigate('/medicaments')}
                  className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Retour à la liste des médicaments
                </button>
              </div>
            </div>
          )}

          {importStatus.status === 'error' && (
            <div className="border-t border-slate-200 pt-6">
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
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
