
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  setView: (view: any) => void;
  onExport: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, onExport }) => {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <i className="fas fa-heartbeat text-emerald-400"></i>
            Clínica Fisiátrica
          </h1>
          <p className="text-indigo-300 text-xs mt-1">Gestión Clínica Inteligente</p>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          <button 
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeView === 'dashboard' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800'}`}
          >
            <i className="fas fa-users w-5"></i>
            Pacientes
          </button>
          <button 
            onClick={() => setView('new-patient')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeView === 'new-patient' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800'}`}
          >
            <i className="fas fa-user-plus w-5"></i>
            Nuevo Registro
          </button>
        </nav>
        
        <div className="p-4 border-t border-indigo-800">
          <button 
            onClick={onExport}
            className="w-full flex items-center gap-3 px-4 py-3 text-indigo-200 hover:bg-indigo-800 rounded-lg transition"
          >
            <i className="fas fa-file-excel w-5"></i>
            Exportar a Excel
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-8">
          <div className="md:hidden">
            <h1 className="text-xl font-bold text-indigo-900">Clínica Fisiátrica</h1>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:inline">Kinesiólogo(a) de Turno</span>
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              KM
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;