const { onRequest } = require('firebase-functions/v2/https');
const { GoogleGenAI } = require('@google/genai');
const admin = require('firebase-admin');

// Initialiser Firebase Admin (pour vérifier les tokens)
if (!admin.apps.length) {
  admin.initializeApp();
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = 'gemini-1.5-pro';

// Liste blanche des origines autorisées (ajoute ton domaine de prod)
const ALLOWED_ORIGINS = [
  'https://gastrocare-pro.web.app',
  'https://gastrocare-pro.firebaseapp.com',
  'http://localhost:3000',
];

exports.geminiProxy = onRequest(
  {
    cors: ALLOWED_ORIGINS,
    secrets: ['GEMINI_API_KEY'],
    maxInstances: 10,
  },
  async (req, res) => {
    // ── 1. Vérification de la méthode ──
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    // ── 2. Extraction et VALIDATION RÉELLE du token Firebase ──
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      console.error('Token invalide:', err.message);
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }

    // ── 3. Vérifier que l'utilisateur existe et est actif dans Firestore ──
    try {
      const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
      if (!userDoc.exists || !userDoc.data().actif) {
        return res.status(403).json({ error: 'Utilisateur non autorisé ou désactivé' });
      }
    } catch (err) {
      console.error('Erreur vérification utilisateur:', err);
      return res.status(500).json({ error: 'Erreur de vérification utilisateur' });
    }

    // ── 4. Traitement de la requête IA ──
    try {
      const { action, payload } = req.body;

      if (!action || !payload) {
        return res.status(400).json({ error: 'Action et payload requis' });
      }

      let result;

      switch (action) {
        case 'structureConsultation': {
          const { notesBrutes } = payload;
          if (!notesBrutes || typeof notesBrutes !== 'string') {
            return res.status(400).json({ error: 'notesBrutes requis (string)' });
          }
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
          if (!diagnostic || typeof diagnostic !== 'string') {
            return res.status(400).json({ error: 'diagnostic requis (string)' });
          }
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
          if (!context || !type) {
            return res.status(400).json({ error: 'context et type requis' });
          }
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
          if (!base64Image || !mimeType) {
            return res.status(400).json({ error: 'base64Image et mimeType requis' });
          }
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: {
              parts: [
                { inlineData: { data: base64Image, mimeType } },
                {
                  text: `Analyse ce document médical. Extrais le texte, détecte le type, propose un résumé.
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
          if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'prompt requis (string)' });
          }
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
