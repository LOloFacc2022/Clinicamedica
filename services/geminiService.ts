
import { GoogleGenAI } from "@google/genai";
import { Patient, Session } from "../types";

export const analyzePatientProgress = async (patient: Patient, sessions: Session[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY.env.API_KEY });
  
  const sessionsSummary = sessions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(s => `- Fecha: ${s.date}\n  Objetivo: ${s.objective}\n  Evolución: ${s.evolution}`)
    .join('\n');

  const prompt = `
    Actúa como un Kinesiólogo experto con 20 años de experiencia en rehabilitación física y razonamiento clínico.
    Analiza el progreso del siguiente paciente:
    
    PACIENTE:
    Nombre: ${patient.fullName}
    Diagnóstico inicial: ${patient.diagnosis}
    Antecedentes: ${patient.medicalHistory}
    
    HISTORIAL DE SESIONES:
    ${sessionsSummary}
    
    TAREA:
    1. Realiza un resumen clínico conciso del progreso funcional.
    2. Identifica banderas rojas (red flags) o áreas de estancamiento terapéutico.
    3. Sugiere 3 enfoques terapéuticos basados en la evidencia (EBP) para las próximas sesiones, priorizando la recuperación funcional.
    
    Usa un lenguaje profesional, académico y preciso.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No se pudo generar el análisis en este momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error al conectar con el asistente de IA clínico.";
  }
};

export const suggestClinicalTerminology = async (text: string): Promise<string[]> => {
  if (!text.trim()) return [];
  
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY.env.API_KEY });
  
  const prompt = `
    Actúa como un experto en Semiología Kinésica y Terminología Médica de alta precisión. 
    Tu objetivo es transformar descripciones coloquiales de síntomas o estados en términos clínicos técnicos, específicos y amplios que un profesional usaría en una historia clínica de élite.

    REGLAS:
    1. Proporciona una mezcla de términos específicos (diagnósticos directos) y amplios (descripciones funcionales).
    2. Cubre áreas como traumatología, neurología, deportología y respiratorio si es pertinente.
    3. Devuelve únicamente la lista de términos separados por comas. Máximo 6 términos.

    EJEMPLOS:
    - Entrada: "Le duele la rodilla cuando sube escaleras"
    - Salida: Gonalgia mecánica, Signo del cepillo positivo, Disfunción femoropatelar, Déficit de fuerza en cuádriceps, Alteración en la cinemática de ascenso, Estrés patelofemoral.

    - Entrada: "Siente hormigueo que le baja por la pierna"
    - Salida: Radiculopatía, Parestesias en dermatoma, Ciatalgia, Neuropatía por atrapamiento, Disestesia en miembro inferior.

    - Entrada: "Tiene el tobillo muy hinchado y no puede pisar"
    - Salida: Edema postraumático, Impotencia funcional de tobillo, Derrame articular, Inestabilidad mecánica, Tumefacción perimaleolar.

    Entrada: "${text}"
    Salida:
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    const result = response.text || "";
    // Handle potential markdown formatting if the model adds it
    const cleanResult = result.replace(/`/g, '').replace(/Salida:/i, '').trim();
    return cleanResult.split(',').map(s => s.trim()).filter(s => s.length > 0);
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return [];
  }
};
