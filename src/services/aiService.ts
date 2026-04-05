/**
 * aiService.ts
 * Tous les appels IA passent par le Cloud Function proxy.
 * La clé Gemini n'est JAMAIS dans ce fichier ni dans le bundle client.
 */

import { auth } from '../firebase';
import {
  anonymizePatient,
  anonymizeConsultations,
  anonymizePrescriptions,
} from '../lib/aiAnonymizer';

// URL du proxy Cloud Function (prod uniquement)
const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || '';

// En dev : appel direct si pas de proxy configuré
const USE_DIRECT_IN_DEV = import.meta.env.DEV && !PROXY_URL;

async function callProxy(action: string, payload: Record<string, unknown>): Promise<any> {
  if (USE_DIRECT_IN_DEV) return callDirect(action, payload);

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Utilisateur non authentifié');

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erreur proxy IA (${response.status})`);
  }

  return response.json();
}

async function callDirect(action: string, payload: Record<string, unknown>): Promise<any> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Clé Gemini manquante. Ajoutez VITE_GEMINI_API_KEY dans .env.local puis relancez npm run dev.');
  }
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash';

  switch (action) {
    case 'structureConsultation': {
      const res = await ai.models.generateContent({
        model,
        contents: `Tu es un assistant médical expert en gastroentérologie.
Structure ces notes brutes en compte rendu médical (Motif, Symptômes, Examen clinique, Diagnostic, Conduite à tenir).
Notes : "${payload.notesBrutes}"`,
      });
      return { text: res.text };
    }
    case 'summarizePatient': {
      const res = await ai.models.generateContent({
        model,
        contents: `Résumé dossier patient anonymisé :
Patient : ${JSON.stringify(payload.patientAnon)}
Consultations : ${JSON.stringify(payload.consultationsAnon)}
Prescriptions : ${JSON.stringify(payload.prescriptionsAnon)}
Génère : antécédents, synthèse consultations, traitements en cours, examens en attente.`,
      });
      return { text: res.text };
    }
    case 'suggestMedications': {
      const res = await ai.models.generateContent({
        model,
        contents: `Assistant gastroentérologie : pour le diagnostic "${payload.diagnostic}", suggère 2-3 médicaments avec posologie. Mentionner que c'est une suggestion.`,
      });
      return { text: res.text };
    }
    case 'generatePatientMessage': {
      const res = await ai.models.generateContent({
        model,
        contents: `Cabinet de gastroentérologie. Message ${payload.type} pour patient.\nContexte : ${payload.context}\nRédige un SMS/WhatsApp professionnel.`,
      });
      return { text: res.text };
    }
    case 'analyzeDocument': {
      const res = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { data: payload.base64Image as string, mimeType: payload.mimeType as string } },
            { text: 'Analyse ce document médical. Réponds en JSON : { "type_document", "resume", "texte_complet" }' },
          ],
        },
        config: { responseMimeType: 'application/json' },
      });
      return JSON.parse(res.text || '{}');
    }
    case 'chat': {
      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction:
            "Tu es un assistant IA pour GastroCare Pro, application de gestion de cabinet médical en gastroentérologie. Tu aides médecins et assistantes.",
        },
      });
      const res = await chat.sendMessage({ message: payload.prompt as string });
      return { text: res.text };
    }
    default:
      throw new Error(`Action inconnue : ${action}`);
  }
}

export const aiService = {
  async structureConsultation(notesBrutes: string): Promise<string> {
    const result = await callProxy('structureConsultation', { notesBrutes });
    return result.text ?? '';
  },

  async summarizePatient(
    patientData: Record<string, unknown>,
    consultations: unknown[],
    prescriptions: unknown[]
  ): Promise<string> {
    const result = await callProxy('summarizePatient', {
      patientAnon: anonymizePatient(patientData),
      consultationsAnon: anonymizeConsultations(consultations as Record<string, unknown>[]),
      prescriptionsAnon: anonymizePrescriptions(prescriptions as Record<string, unknown>[]),
    });
    return result.text ?? '';
  },

  async suggestMedications(diagnostic: string): Promise<string> {
    const result = await callProxy('suggestMedications', { diagnostic });
    return result.text ?? '';
  },

  async analyzeDocument(base64Image: string, mimeType: string): Promise<Record<string, unknown>> {
    return callProxy('analyzeDocument', { base64Image, mimeType });
  },

  async generatePatientMessage(
    context: string,
    type: 'rappel_rdv' | 'relance' | 'demande_examen'
  ): Promise<string> {
    const result = await callProxy('generatePatientMessage', { context, type });
    return result.text ?? '';
  },

  async chat(prompt: string): Promise<string> {
    const result = await callProxy('chat', { prompt });
    return result.text ?? '';
  },
};
