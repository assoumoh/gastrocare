import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, doc, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Upload } from 'lucide-react';

interface DocumentFormProps {
  document?: any;
  patientId?: string;
  examenId?: string;
  onClose: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const UPLOAD_TIMEOUT_MS = 30000; // 30s max

export default function DocumentForm({ document, patientId, examenId, onClose }: DocumentFormProps) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef(false);

  const [formData, setFormData] = useState({
    patient_id: document?.patient_id || patientId || '',
    examen_id: document?.examen_id || examenId || '',
    type_document: document?.type_document || 'ordonnance',
    titre: document?.titre || '',
    url_fichier: document?.url_fichier || '',
    date_ajout: document?.date_ajout || new Date().toISOString().split('T')[0],
    notes: document?.notes || '',
  });

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsub = onSnapshot(q, snap => {
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!formData.patient_id) { setExams([]); return; }
    const q = query(
      collection(db, 'exams'),
      where('patient_id', '==', formData.patient_id),
      orderBy('date_examen', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [formData.patient_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setErrorMsg('Type non supporté. Utilisez PDF, JPG ou PNG.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setErrorMsg('Fichier trop volumineux (max 10 MB).');
      return;
    }
    setFile(f);
  };

  // Annuler force-ferme même en cours d'upload
  const handleCancel = () => {
    abortRef.current = true;
    setLoading(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id) { setErrorMsg('Veuillez sélectionner un patient.'); return; }
    
    setLoading(true);
    setErrorMsg(null);
    abortRef.current = false;

    try {
      let fileUrl = formData.url_fichier;
      let fileName = document?.nom_fichier || formData.titre || 'document';
      let fileType = document?.type_fichier || '';
      let fileSize = document?.taille_fichier || 0;
      let storagePath = document?.storage_path || '';

      // Upload avec timeout de 30s
      if (file) {
        fileName = file.name;
        fileType = file.type;
        fileSize = file.size;
        storagePath = `documents/${formData.patient_id}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);

        // uploadBytes est simple et sans retry infini
        const uploadPromise = uploadBytes(storageRef, file);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Upload trop long (>30s). Vérifiez votre connexion ou la config Firebase Storage.')), UPLOAD_TIMEOUT_MS)
        );

        const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
        if (abortRef.current) return; // annulé pendant l'upload

        fileUrl = await getDownloadURL((snapshot as any).ref);
      }

      if (abortRef.current) return;

      const payload = {
        patient_id: formData.patient_id,
        examen_id: formData.examen_id || null,
        type_document: formData.type_document,
        titre: formData.titre,
        date_ajout: formData.date_ajout,
        notes: formData.notes,
        url_fichier: fileUrl || '',
        nom_fichier: fileName,
        type_fichier: fileType,
        taille_fichier: fileSize,
        storage_path: storagePath,
        uploaded_by: appUser?.uid || 'unknown',
        updated_at: new Date().toISOString(),
      };

      if (document?.id) {
        await updateDoc(doc(db, 'documents', document.id), payload);
      } else {
        await addDoc(collection(db, 'documents'), {
          ...payload,
          created_at: new Date().toISOString(),
        });
      }

      onClose();
    } catch (error: any) {
      if (!abortRef.current) {
        let msg = error.message || "Erreur lors de l'enregistrement.";
        if (error.code === 'storage/unauthorized') msg = "Accès Storage refusé. Vérifiez que vous êtes connecté.";
        if (error.code === 'storage/quota-exceeded') msg = "Quota Firebase Storage dépassé. Passez au plan Blaze.";
        setErrorMsg(msg);
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {document ? 'Modifier le document' : 'Nouveau document'}
          </h2>
          {/* Croix toujours cliquable */}
          <button onClick={handleCancel} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700 rounded">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Patient *</label>
            <select required name="patient_id" value={formData.patient_id} onChange={handleChange} disabled={loading || !!patientId} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 sm:text-sm border px-3 py-2 disabled:bg-slate-100">
              <option value="">Sélectionner un patient</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Examen lié (Optionnel)</label>
            <select name="examen_id" value={formData.examen_id} onChange={handleChange} disabled={loading || !!examenId} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 sm:text-sm border px-3 py-2 disabled:bg-slate-100">
              <option value="">Aucun examen lié</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.nom_examen} - {e.date_examen}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Titre *</label>
            <input required type="text" name="titre" value={formData.titre} onChange={handleChange} disabled={loading} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Type de document *</label>
              <select required name="type_document" value={formData.type_document} onChange={handleChange} disabled={loading} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 sm:text-sm border px-3 py-2">
                <option value="ordonnance">Ordonnance</option>
                <option value="résultat examen">Résultat d'examen</option>
                <option value="lettre confrère">Lettre confrère</option>
                <option value="compte rendu">Compte rendu</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Date d'ajout *</label>
              <input required type="date" name="date_ajout" value={formData.date_ajout} onChange={handleChange} disabled={loading} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Fichier (PDF, JPG, PNG)</label>
            <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${file ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300'}`}>
              <div className="space-y-1 text-center">
                <Upload className={`mx-auto h-12 w-12 ${file ? 'text-indigo-500' : 'text-slate-400'}`} />
                <label htmlFor="file-upload" className={`relative cursor-pointer rounded-md font-medium text-sm ${loading ? 'text-slate-400' : 'text-indigo-600 hover:text-indigo-500'}`}>
                  <span>{file ? 'Changer de fichier' : 'Téléverser un fichier'}</span>
                  <input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" disabled={loading} />
                </label>
                <p className="text-xs text-slate-500">
                  {file
                    ? <span className="font-semibold text-indigo-700">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    : 'PDF, PNG, JPG jusqu\'à 10MB'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">URL du fichier (Optionnel)</label>
            <input type="url" name="url_fichier" value={formData.url_fichier} onChange={handleChange} disabled={loading || !!file} placeholder="https://..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 sm:text-sm border px-3 py-2 disabled:bg-slate-100" />
            {file && <p className="text-xs text-slate-400 mt-1">L'URL sera générée automatiquement lors de l'upload.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea name="notes" rows={2} value={formData.notes} onChange={handleChange} disabled={loading} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            {/* Annuler toujours cliquable */}
            <button type="button" onClick={handleCancel} className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              )}
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
