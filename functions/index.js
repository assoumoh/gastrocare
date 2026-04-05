const { onRequest } = require('firebase-functions/v2/https');
const { GoogleGenAI } = require('@google/genai');

// La clé est stockée dans les secrets Firebase Functions — jamais dans le client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Modèle centralisé — un seul endroit à changer
const GEMINI_MODEL = 'gemini-1.5-pro';

exports.geminiProxy = onRequest(
  {
    cors: true,
    secrets: ['GEMINI_API_KEY'],
    maxInstances: 10,
  },
  async (req, res) => {
    // Vérifier que la requête vient de notre app (Firebase Auth token)
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    try {
      const { action, payload } = req.body;

      let result;

      switch (action) {
        case 'structureConsultation': {
          const { notesBrutes } = payload;
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Tu es un assistant médical expert en gastroentérologie.
Voici des notes brutes prises par un médecin pendant une consultation.
Structure ces notes en un compte rendu médical professionnel avec les sections :
- Motif de consultation
- Symptômes
- Examen clinique
- Diagnostic (ou hypothèses)
- Conduite à tenir

Notes brutes : "${notesBrutes}"

Réponds uniquement avec le compte rendu structuré en Markdown.`,
          });
          result = { text: response.text };
          break;
        }

        case 'summarizePatient': {
          // Payload déjà anonymisé côté client (voir aiAnonymizer.ts)
          const { patientAnon, consultationsAnon, prescriptionsAnon } = payload;
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Tu es un assistant médical. Résumé du dossier patient (données anonymisées) :
Patient : ${JSON.stringify(patientAnon)}
Dernières consultations : ${JSON.stringify(consultationsAnon)}
Dernières prescriptions : ${JSON.stringify(prescriptionsAnon)}

Génère un résumé avec : antécédents principaux, synthèse des consultations, traitements en cours, examens en attente.`,
          });
          result = { text: response.text };
          break;
        }

        case 'suggestMedications': {
          const { diagnostic } = payload;
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Tu es un assistant médical en gastroentérologie.
Pour le diagnostic : "${diagnostic}", suggère 2 ou 3 médicaments courants (DCI ou nom Maroc/France) avec posologie habituelle.
Précise que ce sont des suggestions à valider par le médecin.`,
          });
          result = { text: response.text };
          break;
        }

        case 'generatePatientMessage': {
          const { context, type } = payload;
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Tu es l'assistant d'un cabinet de gastroentérologie.
Rédige un message court et poli (SMS/WhatsApp) pour un patient.
Type : ${type}
Contexte : ${context}
Le message doit être professionnel et prêt à envoyer.`,
          });
          result = { text: response.text };
          break;
        }

        case 'analyzeDocument': {
          const { base64Image, mimeType } = payload;
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: {
              parts: [
                { inlineData: { data: base64Image, mimeType } },
                { text: `Analyse ce document médical. Extrais le texte, détecte le type, propose un résumé.
Réponds en JSON : { "type_document", "resume", "texte_complet" }` },
              ],
            },
            config: { responseMimeType: 'application/json' },
          });
          result = JSON.parse(response.text || '{}');
          break;
        }

        case 'chat': {
          const { prompt } = payload;
          const chat = ai.chats.create({
            model: GEMINI_MODEL,
            config: {
              systemInstruction:
                "Tu es un assistant IA pour GastroCare Pro, application de gestion de cabinet médical en gastroentérologie. Tu aides médecins et assistantes.",
            },
          });
          const response = await chat.sendMessage({ message: prompt });
          result = { text: response.text };
          break;
        }

        default:
          return res.status(400).json({ error: `Action inconnue : ${action}` });
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('Gemini proxy error:', err);
      return res.status(500).json({ error: 'Erreur interne du proxy IA' });
    }
  }
);
