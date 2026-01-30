
import { Patient, Session } from '../types';

const STORAGE_KEYS = {
  PATIENTS: 'kinai_patients',
  SESSIONS: 'kinai_sessions'
};

export const savePatients = (patients: Patient[]) => {
  localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
};

export const getPatients = (): Patient[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PATIENTS);
  return data ? JSON.parse(data) : [];
};

export const saveSessions = (sessions: Session[]) => {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const getSessions = (): Session[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const exportToCSV = (patients: Patient[], sessions: Session[]) => {
  // Simple CSV generation for Excel compatibility
  let csvContent = "data:text/csv;charset=utf-8,";
  
  // Patients header and data
  csvContent += "PACIENTES\n";
  csvContent += "Nombre,Documento,Nacimiento,Sexo,Fecha Consulta,Profesion,Dominancia,Telefono,Derivacion,Diagnostico,Inspeccion Estatica,Inspeccion Dinamica,Palpacion,Auscultacion,Percusion,Adjuntos\n";
  patients.forEach(p => {
    const attachmentsStr = (p.attachments || []).map(a => `${a.name}: ${a.url}`).join('; ');
    csvContent += `"${p.fullName}","${p.documentId}","${p.birthDate}","${p.sex}","${p.consultationDate}","${p.profession}","${p.dominance}","${p.phone}","${p.referral || ''}","${p.diagnosis.replace(/"/g, '""')}","${(p.staticInspection || '').replace(/"/g, '""')}","${(p.dynamicInspection || '').replace(/"/g, '""')}","${(p.palpation || '').replace(/"/g, '""')}","${(p.auscultation || '').replace(/"/g, '""')}","${(p.percussion || '').replace(/"/g, '""')}","${attachmentsStr}"\n`;
  });
  
  csvContent += "\nSESIONES\n";
  csvContent += "Paciente,Fecha,Hora,Dolor EVA,Objetivo,Tratamiento,Evolucion\n";
  sessions.forEach(s => {
    const p = patients.find(pat => pat.id === s.patientId);
    csvContent += `"${p?.fullName || 'Desconocido'}","${s.date}","${s.time}","${s.painLevel}","${s.objective.replace(/"/g, '""')}","${s.treatment.replace(/"/g, '""')}","${s.evolution.replace(/"/g, '""')}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `ClinicaFisiatrica_Export_${new Date().toLocaleDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
