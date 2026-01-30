
import { jsPDF } from "jspdf";
import { Patient, Session } from "../types";

export const generatePatientPDF = (patient: Patient, sessions: Session[]) => {
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138); // Indigo 900
  doc.text("FICHA CLÍNICA KINÉSICA", margin, y);
  
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Fecha de exportación: ${new Date().toLocaleDateString()}`, margin, y);
  
  y += 15;
  doc.setDrawColor(200);
  doc.line(margin, y, 190, y);
  y += 10;

  // Patient Info
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(patient.fullName.toUpperCase(), margin, y);
  
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`DNI: ${patient.documentId} | Nacimiento: ${patient.birthDate} | Sexo: ${patient.sex}`, margin, y);
  y += 5;
  doc.text(`Profesión: ${patient.profession} | Dominancia: ${patient.dominance}`, margin, y);
  
  y += 15;

  // Section Helper
  const drawSection = (title: string, content: string) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text(title.toUpperCase(), margin, y);
    y += 5;
    doc.setFont("helvetica", "italic");
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(content || "No registrado", 160);
    doc.text(lines, margin + 5, y);
    y += (lines.length * 5) + 7;
  };

  // Content Sections
  drawSection("Diagnóstico Principal", patient.diagnosis);
  drawSection("Antecedentes Médicos", patient.medicalHistory);
  drawSection("ICE (Ideas, Creencias, Expectativas)", patient.ice);
  drawSection("Determinantes Sociales", patient.socialDeterminants);
  drawSection("Cronopatología", patient.chronopathology);
  drawSection("Red Flags / Banderas Rojas", patient.redFlags);
  
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("HALLAZGOS DE EXPLORACIÓN", margin, y);
  y += 7;

  drawSection("Inspección Estática", patient.staticInspection);
  drawSection("Inspección Dinámica", patient.dynamicInspection);
  drawSection("Palpación", patient.palpation);
  drawSection("Auscultación", patient.auscultation);
  drawSection("Percusión", patient.percussion);

  // Sessions
  if (sessions.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text("HISTORIAL DE EVOLUCIONES", margin, y);
    y += 15;

    sessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach((s, idx) => {
      if (y > 250) { doc.addPage(); y = 20; }
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(`${s.date} - Dolor EVA: ${s.painLevel}/10`, margin, y);
      
      y += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Objetivo: ${s.objective}`, margin + 5, y);
      
      y += 5;
      const treatLines = doc.splitTextToSize(`Tratamiento: ${s.treatment}`, 160);
      doc.text(treatLines, margin + 5, y);
      y += (treatLines.length * 4);
      
      const evolLines = doc.splitTextToSize(`Evolución: ${s.evolution}`, 160);
      doc.text(evolLines, margin + 5, y);
      y += (evolLines.length * 4) + 10;
      
      doc.setDrawColor(240);
      doc.line(margin, y - 5, 190, y - 5);
    });
  }

  doc.save(`Ficha_${patient.fullName.replace(/\s+/g, '_')}.pdf`);
};
