
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import { Patient, Session, ViewState, Attachment } from './types';
import { getPatients, getSessions, savePatients, saveSessions, exportToCSV } from './services/storageService';
import { analyzePatientProgress, suggestClinicalTerminology } from './services/geminiService';
import { generatePatientPDF } from './services/pdfService';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [painValue, setPainValue] = useState<number>(5);
  
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [tempAttachments, setTempAttachments] = useState<{name: string, url: string}[]>([]);
  const [suggestionState, setSuggestionState] = useState<{ loading: boolean, terms: string[], target: string | null }>({
    loading: false,
    terms: [],
    target: null
  });

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const sessionFormRef = useRef<HTMLFormElement>(null);
  const patientFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setPatients(getPatients());
    setSessions(getSessions());
  }, []);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => 
      p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.documentId.includes(searchTerm)
    );
  }, [patients, searchTerm]);

  const activePatient = useMemo(() => {
    return patients.find(p => p.id === activePatientId) || null;
  }, [patients, activePatientId]);

  const activePatientSessions = useMemo(() => {
    return sessions
      .filter(s => s.patientId === activePatientId)
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return dateB - dateA;
      });
  }, [sessions, activePatientId]);

  const chartData = useMemo(() => {
    return [...activePatientSessions]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(s => ({
        fecha: new Date(s.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        dolor: s.painLevel ?? 0
      }));
  }, [activePatientSessions]);

  const getPatientSessionStats = (patientId: string) => {
    const pSessions = sessions.filter(s => s.patientId === patientId);
    const sorted = pSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return {
      count: pSessions.length,
      lastDate: sorted.length > 0 ? sorted[0].date : null
    };
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleAddPatient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newPatient: Patient = {
      id: crypto.randomUUID(),
      fullName: (formData.get('fullName') as string) || 'Sin Nombre',
      documentId: (formData.get('documentId') as string) || '',
      birthDate: formData.get('birthDate') as string,
      sex: formData.get('sex') as string,
      consultationDate: (formData.get('consultationDate') as string) || new Date().toISOString().split('T')[0],
      profession: formData.get('profession') as string,
      dominance: formData.get('dominance') as any,
      phone: formData.get('phone') as string,
      referral: formData.get('referral') as string,
      diagnosis: formData.get('diagnosis') as string,
      medicalHistory: formData.get('medicalHistory') as string,
      ice: formData.get('ice') as string,
      socialDeterminants: formData.get('socialDeterminants') as string,
      chronopathology: formData.get('chronopathology') as string,
      redFlags: formData.get('redFlags') as string,
      staticInspection: formData.get('staticInspection') as string,
      dynamicInspection: formData.get('dynamicInspection') as string,
      palpation: formData.get('palpation') as string,
      auscultation: formData.get('auscultation') as string,
      percussion: formData.get('percussion') as string,
      attachments: tempAttachments.filter(a => a.url).map(a => ({ ...a, id: crypto.randomUUID() })),
      createdAt: Date.now()
    };
    
    const updated = [...patients, newPatient];
    setPatients(updated);
    savePatients(updated);
    setTempAttachments([]);
    setRegStep(1);
    setCurrentView('dashboard');
  };

  const handleSaveSession = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activePatientId) return;
    const formData = new FormData(e.currentTarget);
    const sessionPain = parseInt(formData.get('painLevel') as string) || 0;
    
    const sessionData = {
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      objective: formData.get('objective') as string,
      treatment: formData.get('treatment') as string,
      evolution: formData.get('evolution') as string,
      observations: formData.get('observations') as string,
      painLevel: sessionPain,
      painMapUrl: formData.get('painMapUrl') as string,
      painMapImage: formData.get('painMapImage') as string,
    };

    if (editingSessionId) {
      const updatedSessions = sessions.map(s => {
        if (s.id === editingSessionId) {
          return {
            ...s,
            ...sessionData
          };
        }
        return s;
      });
      setSessions(updatedSessions);
      saveSessions(updatedSessions);
      setEditingSessionId(null);
    } else {
      const newSession: Session = {
        id: crypto.randomUUID(),
        patientId: activePatientId,
        ...sessionData,
        createdAt: Date.now()
      };
      const updated = [...sessions, newSession];
      setSessions(updated);
      saveSessions(updated);
    }
    e.currentTarget.reset();
    setPainValue(5);
    setAiReport(null);
  };

  const handleEditSession = (session: Session) => {
    setEditingSessionId(session.id);
    setPainValue(session.painLevel || 0);
    if (sessionFormRef.current) {
      sessionFormRef.current.scrollIntoView({ behavior: 'smooth' });
      const form = sessionFormRef.current;
      (form.elements.namedItem('date') as HTMLInputElement).value = session.date;
      (form.elements.namedItem('time') as HTMLInputElement).value = session.time;
      (form.elements.namedItem('objective') as HTMLInputElement).value = session.objective;
      (form.elements.namedItem('treatment') as HTMLTextAreaElement).value = session.treatment;
      (form.elements.namedItem('evolution') as HTMLTextAreaElement).value = session.evolution;
      (form.elements.namedItem('observations') as HTMLInputElement).value = session.observations;
      (form.elements.namedItem('painLevel') as HTMLInputElement).value = (session.painLevel || 0).toString();
      (form.elements.namedItem('painMapUrl') as HTMLInputElement).value = session.painMapUrl || '';
      (form.elements.namedItem('painMapImage') as HTMLInputElement).value = session.painMapImage || '';
    }
  };

  const cancelEdit = () => {
    setEditingSessionId(null);
    setPainValue(5);
    if (sessionFormRef.current) sessionFormRef.current.reset();
  };

  const handleAnalyze = async () => {
    if (!activePatient) return;
    setIsAiLoading(true);
    setAiReport(null);
    const report = await analyzePatientProgress(activePatient, activePatientSessions);
    setAiReport(report);
    setIsAiLoading(false);
  };

  const handleExportPdf = () => {
    if (!activePatient) return;
    setIsPdfLoading(true);
    setTimeout(() => {
      generatePatientPDF(activePatient, activePatientSessions);
      setIsPdfLoading(false);
    }, 500);
  };

  const handleExport = () => {
    exportToCSV(patients, sessions);
  };

  const handleTerminologyAssist = async (fieldName: string, formRef: React.RefObject<HTMLFormElement | null>) => {
    if (!formRef.current) return;
    const input = formRef.current.elements.namedItem(fieldName) as HTMLTextAreaElement | HTMLInputElement;
    if (!input || !input.value.trim()) return;
    setSuggestionState({ loading: true, terms: [], target: fieldName });
    const terms = await suggestClinicalTerminology(input.value);
    setSuggestionState({ loading: false, terms, target: fieldName });
  };

  const applyTerm = (term: string, formRef: React.RefObject<HTMLFormElement | null>) => {
    if (!formRef.current || !suggestionState.target) return;
    const input = formRef.current.elements.namedItem(suggestionState.target) as HTMLTextAreaElement | HTMLInputElement;
    if (input) {
      const currentVal = input.value;
      input.value = currentVal ? `${currentVal} (${term})` : term;
    }
    setSuggestionState({ loading: false, terms: [], target: null });
  };

  const addAttachmentRow = () => {
    setTempAttachments([...tempAttachments, { name: '', url: '' }]);
  };

  const updateAttachmentRow = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...tempAttachments];
    updated[index][field] = value;
    setTempAttachments(updated);
  };

  const removeAttachmentRow = (index: number) => {
    setTempAttachments(tempAttachments.filter((_, i) => i !== index));
  };

  const getFileIcon = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return 'fa-image text-emerald-500';
    if (extension === 'pdf') return 'fa-file-pdf text-red-500';
    return 'fa-link text-indigo-500';
  };

  const inputClasses = "w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800 transition-all shadow-sm focus:border-indigo-500";
  const labelClasses = "text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block";

  const SuggestionBox = ({ fieldName, formRef }: { fieldName: string, formRef: React.RefObject<HTMLFormElement | null> }) => {
    if (suggestionState.target !== fieldName) return null;
    if (suggestionState.loading) return <p className="text-[10px] text-indigo-500 mt-1 animate-pulse"><i className="fas fa-spinner fa-spin"></i> Consultando terminología...</p>;
    if (suggestionState.terms.length === 0) return null;

    return (
      <div className="mt-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg animate-fadeIn">
        <p className="text-[10px] font-bold text-indigo-700 uppercase mb-2">Sugerencias clínicas:</p>
        <div className="flex flex-wrap gap-2">
          {suggestionState.terms.map(term => (
            <button 
              key={term}
              type="button"
              onClick={() => applyTerm(term, formRef)}
              className="text-[10px] bg-white border border-indigo-200 px-2 py-1 rounded-full text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            >
              {term}
            </button>
          ))}
          <button 
            type="button"
            onClick={() => setSuggestionState({ loading: false, terms: [], target: null })}
            className="text-[10px] text-slate-400 hover:text-slate-600 ml-auto"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout activeView={currentView} setView={setCurrentView} onExport={handleExport}>
      {currentView === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800">Panel de Pacientes</h2>
            <div className="relative w-full md:w-64">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                type="text" 
                placeholder="Buscar paciente..." 
                className="pl-10 pr-4 py-2 w-full rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="hidden lg:grid grid-cols-12 bg-slate-50 border-b p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <div className="col-span-4">Paciente y Diagnóstico</div>
              <div className="col-span-2 text-center">Documento</div>
              <div className="col-span-2 text-center">Última Sesión</div>
              <div className="col-span-2 text-center">Sesiones</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {filteredPatients.map(patient => {
                const stats = getPatientSessionStats(patient.id);
                return (
                  <div 
                    key={patient.id} 
                    onClick={() => {
                      setActivePatientId(patient.id);
                      setCurrentView('patient-detail');
                      setAiReport(null);
                      setEditingSessionId(null);
                    }}
                    className="grid grid-cols-1 lg:grid-cols-12 items-center p-4 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                  >
                    <div className="col-span-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {patient.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                          {patient.fullName}
                        </p>
                        <p className="text-xs text-slate-500 truncate" title={patient.diagnosis}>
                          {patient.diagnosis || 'Sin diagnóstico'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="hidden lg:flex col-span-2 justify-center">
                      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {patient.documentId || '---'}
                      </span>
                    </div>

                    <div className="col-span-2 mt-2 lg:mt-0 flex lg:justify-center items-center gap-2 lg:gap-0">
                      <span className="lg:hidden text-[10px] font-bold text-slate-400 uppercase w-24">Última:</span>
                      <span className="text-xs text-slate-600 font-medium">
                        {stats.lastDate ? new Date(stats.lastDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    <div className="col-span-2 mt-1 lg:mt-0 flex lg:justify-center items-center gap-2 lg:gap-0">
                      <span className="lg:hidden text-[10px] font-bold text-slate-400 uppercase w-24">Total:</span>
                      <div className="flex items-center gap-1.5">
                        <i className="fas fa-history text-[10px] text-indigo-400"></i>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {stats.count}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 mt-4 lg:mt-0 text-right">
                      <button className="text-indigo-600 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 ml-auto">
                        Ver ficha <i className="fas fa-chevron-right text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredPatients.length === 0 && (
                <div className="py-20 text-center">
                  <i className="fas fa-user-friends text-5xl text-slate-200 mb-4"></i>
                  <p className="text-slate-500 text-lg">No se encontraron pacientes registrados.</p>
                  <button 
                    onClick={() => {
                      setRegStep(1);
                      setCurrentView('new-patient');
                    }}
                    className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
                  >
                    Registrar primer paciente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentView === 'new-patient' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn max-w-4xl mx-auto">
          <div className="p-6 bg-indigo-900 text-white flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Ficha de Filiación y Anamnesis</h2>
              <p className="text-indigo-200 text-sm">Paso {regStep} de 2: {regStep === 1 ? 'Biopsicosocial' : 'Exploración Física y Seguridad'}</p>
            </div>
            <div className="flex gap-2">
               <div className={`w-3 h-3 rounded-full ${regStep === 1 ? 'bg-emerald-400' : 'bg-white/30'}`}></div>
               <div className={`w-3 h-3 rounded-full ${regStep === 2 ? 'bg-emerald-400' : 'bg-white/30'}`}></div>
            </div>
          </div>
          
          <form ref={patientFormRef} onSubmit={handleAddPatient} className="p-8 space-y-8">
            {regStep === 1 && (
              <div className="space-y-8 animate-fadeIn">
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <i className="fas fa-user-circle"></i> Datos de Filiación
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <label className={labelClasses}>Nombre y Apellido</label>
                      <input name="fullName" type="text" className={inputClasses} required />
                    </div>
                    <div>
                      <label className={labelClasses}>DNI / Documento</label>
                      <input name="documentId" type="text" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Fecha de Nacimiento</label>
                      <input name="birthDate" type="date" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Sexo</label>
                      <select name="sex" className={inputClasses}>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClasses}>Teléfono / Contacto</label>
                      <input name="phone" type="tel" className={inputClasses} />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <i className="fas fa-home"></i> El "Quién" y "Cómo vive" (Determinantes Sociales)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Determinantes Sociales de Salud</label>
                      <textarea 
                        name="socialDeterminants" 
                        rows={2} 
                        placeholder="Acceso a agua, contaminación sonora/ambiental, red de apoyo familiar/amigos..." 
                        className={inputClasses}
                      ></textarea>
                    </div>
                    <div>
                      <label className={labelClasses}>Cronopatología (Patrones temporales)</label>
                      <textarea 
                        name="chronopathology" 
                        rows={2} 
                        placeholder="¿Empeora los lunes? ¿Mejora en vacaciones? ¿Hay un patrón de exposición?..." 
                        className={inputClasses}
                      ></textarea>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <i className="fas fa-stethoscope"></i> Contexto Clínico y Diagnóstico
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <label className={labelClasses}>Diagnóstico Principal</label>
                        <button type="button" onClick={() => handleTerminologyAssist('diagnosis', patientFormRef)} className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1">
                          <i className="fas fa-magic"></i> IA
                        </button>
                      </div>
                      <textarea name="diagnosis" rows={2} placeholder="Descripción del motivo de consulta..." className={inputClasses}></textarea>
                      <SuggestionBox fieldName="diagnosis" formRef={patientFormRef} />
                    </div>
                    <div className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <label className={labelClasses}>Antecedentes Médicos / Enfermedad Actual</label>
                        <button type="button" onClick={() => handleTerminologyAssist('medicalHistory', patientFormRef)} className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1">
                          <i className="fas fa-magic"></i> IA
                        </button>
                      </div>
                      <textarea name="medicalHistory" rows={3} placeholder="Patologías previas..." className={inputClasses}></textarea>
                      <SuggestionBox fieldName="medicalHistory" formRef={patientFormRef} />
                    </div>
                  </div>
                </section>
                
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button type="button" onClick={() => setCurrentView('dashboard')} className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => setRegStep(2)} className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                    Siguiente: Exploración <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}

            {regStep === 2 && (
              <div className="space-y-8 animate-fadeIn">
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <i className="fas fa-walking"></i> Inspección Kinésica
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Inspección Estática</label>
                      <textarea name="staticInspection" rows={3} placeholder="Alineación, actitud real/aparente..." className={inputClasses}></textarea>
                    </div>
                    <div>
                      <label className={labelClasses}>Inspección Dinámica</label>
                      <textarea name="dynamicInspection" rows={3} placeholder="Marcha, calidad de movimiento..." className={inputClasses}></textarea>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <i className="fas fa-hands"></i> Exploración Física
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className={labelClasses}>Palpación</label>
                      <textarea name="palpation" rows={3} placeholder="Accidentes óseos, temperatura, edema..." className={inputClasses}></textarea>
                    </div>
                    <div>
                      <label className={labelClasses}>Auscultación</label>
                      <textarea name="auscultation" rows={3} placeholder="Crepitaciones, chasquidos..." className={inputClasses}></textarea>
                    </div>
                    <div>
                      <label className={labelClasses}>Percusión</label>
                      <textarea name="percussion" rows={3} placeholder="Reflejos, pruebas provocativas..." className={inputClasses}></textarea>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle text-amber-500"></i> ICE & Seguridad
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                      <label className={labelClasses}>ICE (Ideas, Creencias y Expectativas)</label>
                      <textarea 
                        name="ice" 
                        rows={3} 
                        placeholder="¿Qué cree el paciente que tiene? ¿Qué espera de esta consulta?..." 
                        className={inputClasses}
                      ></textarea>
                    </div>
                    <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
                      <label className={`${labelClasses} text-red-600`}>Red Flags (Banderas Rojas)</label>
                      <textarea 
                        name="redFlags" 
                        rows={3} 
                        placeholder="Descarte: pérdida de peso inexplicable, fiebre nocturna, cambios esfinterianos, dolor no mecánico..." 
                        className={inputClasses}
                      ></textarea>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest">Documentación y Actividad</h3>
                    <button type="button" onClick={addAttachmentRow} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1">
                      <i className="fas fa-plus"></i> Agregar Vínculo
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Actividad / Profesión</label>
                      <input name="profession" type="text" placeholder="Atleta, Oficinista..." className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Dominancia</label>
                      <select name="dominance" className={inputClasses}>
                        <option value="diestro">Diestro</option>
                        <option value="zurdo">Zurdo</option>
                        <option value="ambidiestro">Ambidiestro</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3 mt-4">
                    {tempAttachments.map((att, idx) => (
                      <div key={idx} className="flex gap-3 items-end animate-fadeIn">
                        <input type="text" value={att.name} placeholder="Nombre (ej: RM Lumbar)" onChange={(e) => updateAttachmentRow(idx, 'name', e.target.value)} className={inputClasses} />
                        <input type="url" value={att.url} placeholder="https://..." onChange={(e) => updateAttachmentRow(idx, 'url', e.target.value)} className={inputClasses} />
                        <button type="button" onClick={() => removeAttachmentRow(idx)} className="p-3 text-red-400 hover:text-red-600 transition-colors"><i className="fas fa-trash"></i></button>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex justify-between gap-4 pt-4 border-t">
                  <button type="button" onClick={() => setRegStep(1)} className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
                    <i className="fas fa-chevron-left"></i> Volver al Paso 1
                  </button>
                  <button type="submit" className="px-10 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                    Finalizar Registro <i className="fas fa-check-circle ml-2"></i>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {currentView === 'patient-detail' && activePatient && (
        <div className="space-y-8 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl font-bold border border-white/20">
                  {activePatient.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">{activePatient.fullName}</h2>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded border border-white/20 uppercase">
                      ID: {activePatient.documentId || '---'}
                    </span>
                  </div>
                  <p className="text-indigo-200 mt-1 flex items-center gap-2">
                    <i className="fas fa-stethoscope text-indigo-400"></i>
                    {activePatient.diagnosis || 'Sin diagnóstico'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <button onClick={() => setCurrentView('dashboard')} className="flex-1 md:flex-none px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition border border-white/10">
                  <i className="fas fa-arrow-left mr-2"></i> Volver
                </button>
                
                <button 
                  onClick={handleExportPdf} 
                  disabled={isPdfLoading}
                  className="flex-1 md:flex-none px-4 py-2 bg-slate-100 text-slate-800 rounded-lg font-bold hover:bg-white transition flex items-center justify-center gap-2"
                >
                  {isPdfLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-pdf text-red-600"></i>}
                  Ficha PDF
                </button>

                <button onClick={handleAnalyze} disabled={isAiLoading || activePatientSessions.length === 0} className="flex-1 md:flex-none px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 disabled:bg-slate-600 disabled:opacity-50 transition shadow-lg shadow-emerald-900/20">
                  {isAiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-brain mr-2"></i>}
                  Análisis IA
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 p-6 gap-4 bg-slate-50 border-t text-sm">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">Edad</p>
                <p className="font-semibold text-slate-700">{calculateAge(activePatient.birthDate)} {typeof calculateAge(activePatient.birthDate) === 'number' ? 'años' : ''}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">Sexo</p>
                <p className="font-semibold text-slate-700">{activePatient.sex}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">Dominancia</p>
                <p className="font-semibold text-slate-700 capitalize">{activePatient.dominance}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">Actividad</p>
                <p className="font-semibold text-slate-700 truncate" title={activePatient.profession}>{activePatient.profession || '---'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">Teléfono</p>
                <p className="font-semibold text-slate-700">{activePatient.phone || '---'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400">1ra Consulta</p>
                <p className="font-semibold text-slate-700">{new Date(activePatient.consultationDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b pb-2">Progreso del Dolor (EVA)</h3>
                <div className="h-[200px] w-full">
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                        <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="dolor" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPain)" animationDuration={1500} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <i className="fas fa-chart-line text-3xl mb-3 opacity-20"></i>
                      <p className="text-xs italic">Se necesitan al menos 2 sesiones para generar el gráfico.</p>
                    </div>
                  )}
                </div>
              </div>

              {aiReport && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 relative overflow-hidden animate-fadeIn">
                  <h3 className="text-emerald-800 font-bold flex items-center gap-2 mb-4">
                    <i className="fas fa-sparkles text-emerald-500"></i> Análisis Clínico IA
                  </h3>
                  <div className="text-emerald-900 text-sm whitespace-pre-wrap leading-relaxed">{aiReport}</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fas fa-users-viewfinder"></i> ICE & Biopsicosocial
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Expectativas (ICE)</p>
                      <p className="text-sm text-slate-600 italic leading-relaxed">{activePatient.ice || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Determinantes Sociales</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{activePatient.socialDeterminants || 'No registrado'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fas fa-history"></i> Cronopatología & Seguridad
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Patrones Temporales</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{activePatient.chronopathology || 'No registrado'}</p>
                    </div>
                    <div className={`${activePatient.redFlags ? 'bg-red-50 p-2 rounded border border-red-100' : ''}`}>
                      <p className={`text-[10px] font-bold uppercase mb-1 ${activePatient.redFlags ? 'text-red-600' : 'text-slate-400'}`}>Banderas Rojas</p>
                      <p className="text-sm text-slate-700 font-medium">{activePatient.redFlags || 'Ninguna identificada'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b pb-2">Hallazgos de Exploración Física</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 border-l-2 border-indigo-400 pl-2">Inspección Estática</p>
                      <p className="text-sm text-slate-600 leading-relaxed italic">{activePatient.staticInspection || 'Sin datos.'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 border-l-2 border-indigo-400 pl-2">Inspección Dinámica</p>
                      <p className="text-sm text-slate-600 leading-relaxed italic">{activePatient.dynamicInspection || 'Sin datos.'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 border-l-2 border-emerald-400 pl-2">Palpación</p>
                      <p className="text-sm text-slate-600 leading-relaxed italic">{activePatient.palpation || 'Sin datos.'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 border-l-2 border-emerald-400 pl-2">Auscultación & Percusión</p>
                      <div className="text-sm text-slate-600 leading-relaxed italic">
                        {activePatient.auscultation && <p>Ausc: {activePatient.auscultation}</p>}
                        {activePatient.percussion && <p>Perc: {activePatient.percussion}</p>}
                        {!activePatient.auscultation && !activePatient.percussion && 'Sin datos.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <i className="fas fa-stream text-indigo-500"></i> Evoluciones Clínicas
                </h3>
                <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {activePatientSessions.map(session => (
                    <div key={session.id} className="relative pl-12 group">
                      <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center z-10 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <i className="fas fa-notes-medical text-indigo-600 group-hover:text-white text-sm"></i>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm group-hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-indigo-600">{new Date(session.date).toLocaleDateString('es-AR')}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400">{session.time} hs</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${session.painLevel > 7 ? 'bg-red-50 text-red-600' : session.painLevel > 4 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                Dolor: {session.painLevel}/10
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {session.painMapUrl && (
                               <a href={session.painMapUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold flex items-center gap-1">
                                 <i className="fas fa-map-marker-alt text-red-500"></i> Mapa de Dolor
                               </a>
                            )}
                            <button onClick={() => handleEditSession(session)} className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-2 py-1 rounded-md transition-all font-bold">Modificar</button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <p className="text-sm text-slate-800 font-medium">Objetivo: {session.objective}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-indigo-50/30 p-3 rounded-lg"><p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Tratamiento</p><p className="text-sm text-slate-700">{session.treatment}</p></div>
                            <div className="bg-emerald-50/30 p-3 rounded-lg"><p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Evolución</p><p className="text-sm text-slate-700">{session.evolution}</p></div>
                          </div>
                          {session.painMapImage && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Imagen de Mapa de Dolor</p>
                              <img src={session.painMapImage} alt="Mapa de Dolor" className="max-w-full rounded-lg border border-slate-200 shadow-sm max-h-[300px] object-contain" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className={`bg-white rounded-2xl border ${editingSessionId ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'} shadow-lg sticky top-8 overflow-hidden transition-all duration-300`}>
                <div className={`p-4 ${editingSessionId ? 'bg-amber-500' : 'bg-slate-800'} text-white flex items-center justify-between`}>
                  <h3 className="font-bold text-sm uppercase tracking-wider">{editingSessionId ? 'Modificar Evolución' : 'Nueva Evolución'}</h3>
                  {editingSessionId && <button onClick={cancelEdit} className="text-[10px] bg-white/20 px-2 py-1 rounded uppercase font-bold">Cancelar</button>}
                </div>
                <form ref={sessionFormRef} onSubmit={handleSaveSession} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelClasses}>Fecha</label><input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inputClasses} /></div>
                    <div><label className={labelClasses}>Hora</label><input name="time" type="time" defaultValue={new Date().toTimeString().slice(0, 5)} className={inputClasses} /></div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className={labelClasses}>Dolor (EVA)</label>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${painValue > 7 ? 'bg-red-500 text-white' : painValue > 4 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>{painValue}/10</span>
                    </div>
                    <input name="painLevel" type="range" min="0" max="10" value={painValue} onChange={(e) => setPainValue(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>

                  {/* Pain Map Tool Integration */}
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-3">
                    <label className={labelClasses}>Mapa de Dolor Externo</label>
                    <a 
                      href="https://app.tellmewhereithurtsnow.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-indigo-600 text-white rounded-lg text-center font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-sm"
                    >
                      <i className="fas fa-external-link-alt"></i> Abrir TellMeWhereItHurts
                    </a>
                    <div className="space-y-2">
                      <input 
                        name="painMapUrl" 
                        type="url" 
                        placeholder="Pegar enlace del mapa aquí..." 
                        className="w-full p-2 border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                      <input 
                        name="painMapImage" 
                        type="text" 
                        placeholder="Pegar URL de la imagen resultante..." 
                        className="w-full p-2 border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                      <p className="text-[10px] text-slate-500 italic">Completa el mapa en la web externa y pega aquí el resultado.</p>
                    </div>
                  </div>

                  <div><label className={labelClasses}>Objetivo</label><input name="objective" type="text" className={inputClasses} /></div>
                  <textarea name="treatment" rows={2} placeholder="Tratamiento aplicado..." className={inputClasses}></textarea>
                  <textarea name="evolution" rows={2} placeholder="Evolución observada..." className={inputClasses}></textarea>
                  <button type="submit" className={`w-full py-3 ${editingSessionId ? 'bg-amber-600' : 'bg-indigo-600'} text-white rounded-xl font-bold shadow-lg`}>Guardar Evolución</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
