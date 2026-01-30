
export interface Attachment {
  id: string;
  name: string;
  url: string;
}

export interface Patient {
  id: string;
  fullName: string;
  documentId: string;
  birthDate: string;
  sex: string;
  consultationDate: string;
  profession: string;
  dominance: 'diestro' | 'zurdo' | 'ambidiestro';
  phone: string;
  referral?: string;
  diagnosis: string;
  medicalHistory: string;
  
  // New Holistic fields
  ice: string;                // Ideas, Creencias y Expectativas
  socialDeterminants: string; // Agua, contaminación, red de apoyo
  chronopathology: string;    // Patrones temporales del dolor/síntoma
  redFlags: string;           // Banderas rojas (pérdida peso, fiebre, etc.)

  staticInspection: string;  // Posture, alignment, apparent/real attitude
  dynamicInspection: string; // Gait, quality/quantity of movement
  palpation: string;         // Bone landmarks, soft tissues, trigger points
  auscultation: string;      // Joint crepitus, vascular sounds, clicks
  percussion: string;        // Reflexes, resonant/dull sounds, provocative tests
  attachments: Attachment[];
  createdAt: number;
}

export interface Session {
  id: string;
  patientId: string;
  date: string;
  time: string;
  objective: string;
  treatment: string;
  evolution: string;
  observations: string;
  painLevel: number; // VAS Scale 0-10
  painMapUrl?: string; // Link to TellMeWhereItHurts
  painMapImage?: string; // Attached image link or data
  createdAt: number;
}

export type ViewState = 'dashboard' | 'patient-detail' | 'new-patient';

export interface AppState {
  patients: Patient[];
  sessions: Session[];
  activePatientId: string | null;
  currentView: ViewState;
}
