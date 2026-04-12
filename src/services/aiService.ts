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

// URL du proxy Cloud Function
// En dev : utilise l'émulateur Firebase Functions ou l'URL de staging
// En prod : URL de production
const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

async function callProxy(action: string, payload: Record<string, unknown>): Promise<any> {
  if (!PROXY_URL) {
    throw new Error(
      'VITE_AI_PROXY_URL non configuré. Ajoutez-le dans .env.local (ex: http://localhost:5001/votre-projet/us-central1/geminiProxy)'
    );
  }

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
