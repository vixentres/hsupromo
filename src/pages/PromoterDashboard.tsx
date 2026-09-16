import React, { useState } from 'react';
import { Copy, Folder, FolderOpen, CheckCircle, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';

export default function PromoterDashboard() {
  const [taskStatus, setTaskStatus] = useState<'rojo' | 'amarillo' | 'verde' | 'morado'>('rojo');
  const [linkMode, setLinkMode] = useState<'perfil' | 'historias'>('historias');

  // Datos de ejemplo para la maqueta
  const asignaciones = [
    { id: 1, nombre: 'Juanito Pérez', instagram: 'juanitoperez' },
    { id: 2, nombre: 'María Gómez', instagram: 'mariagomez_' }
  ];

  const getInstagramUrl = (ig: string) => {
    return linkMode === 'historias' 
      ? `https://www.instagram.com/stories/${ig}/`
      : `https://www.instagram.com/${ig}/`;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Panel de Misiones</h1>
          <p className="text-gray-400 text-sm">Tu estado actual y tareas de auditoría.</p>
        </div>
        <button className="bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-white/5">
          <Copy size={16} /> Copiar mi Link Personal
        </button>
      </header>

      {/* SECCIÓN 1: MI TAREA */}
      <div className={`border rounded-2xl p-6 mb-8 transition-colors ${
        taskStatus === 'rojo' ? 'bg-red-900/20 border-red-500/30' :
        taskStatus === 'amarillo' ? 'bg-yellow-900/20 border-yellow-500/30' :
        taskStatus === 'verde' ? 'bg-green-900/20 border-green-500/30' :
        'bg-purple-900/20 border-purple-500/30'
      }`}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className={`text-white text-[10px] font-black uppercase px-2 py-1 rounded mb-2 inline-block ${
              taskStatus === 'rojo' ? 'bg-red-500' :
              taskStatus === 'amarillo' ? 'bg-yellow-500' :
              taskStatus === 'verde' ? 'bg-green-500' : 'bg-purple-500'
            }`}>
              {taskStatus === 'rojo' ? 'Misión Pendiente' :
               taskStatus === 'amarillo' ? 'Esperando Revisión' :
               taskStatus === 'verde' ? 'Misión Aprobada' : 'Auditor Leal (Compañero falló)'}
            </span>
            <h2 className="text-xl font-bold">Subir Banner Oficial a Historias</h2>
            <p className="text-gray-400 text-sm mt-1">Tiempo restante: <span className="text-white font-mono">23h 45m</span></p>
          </div>
          <button 
            onClick={() => setTaskStatus('amarillo')}
            disabled={taskStatus !== 'rojo'}
            className={`font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg transition-all ${
              taskStatus === 'rojo' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-neutral-800 text-gray-500 cursor-not-allowed'
            }`}>
            <CheckCircle size={18} /> {taskStatus === 'rojo' ? 'Marcar como Publicado' : 'Publicado'}
          </button>
        </div>
        
        <div className="flex gap-4">
          <button className="flex-1 bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
            <Folder size={18} /> Material Nuevo
          </button>
          <button className="flex-1 bg-neutral-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors border border-white/10">
            <FolderOpen size={18} /> Histórico
          </button>
        </div>
      </div>

      {/* SECCIÓN 2: AUDITORÍAS */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2"><ShieldCheck className="text-blue-400" /> Tareas de Auditoría</h2>
            <p className="text-gray-400 text-sm">Revisa a tus compañeros para completar tu misión de hoy al 100%.</p>
          </div>
          
          <button 
            onClick={() => setLinkMode(prev => prev === 'perfil' ? 'historias' : 'perfil')}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            {linkMode === 'historias' ? <ToggleRight className="text-blue-400" /> : <ToggleLeft className="text-gray-600" />}
            Modo de enlace: {linkMode === 'historias' ? 'Directo a Historias' : 'Ir al Perfil'}
          </button>
        </div>

        <div className="space-y-3">
          {asignaciones.map((asig, idx) => (
            <div key={asig.id} className="bg-neutral-800 border border-white/5 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Revisión Asignada {idx + 1}</p>
                <a 
                  href={getInstagramUrl(asig.instagram)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-lg font-bold text-white hover:text-blue-400 flex items-center gap-2 transition-colors"
                >
                  @{asig.instagram} <ExternalLink size={14} />
                </a>
              </div>
              
              <div className="flex bg-neutral-900 rounded-lg p-1 border border-white/5">
                <button className="px-4 py-2 text-xs font-bold text-green-500 hover:bg-green-500/10 rounded-md transition-colors">✅ SÍ</button>
                <button className="px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-md transition-colors">❌ NO</button>
                <button className="px-4 py-2 text-xs font-bold text-orange-400 hover:bg-orange-400/10 rounded-md transition-colors">⏸️ JUSTIFICADO</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
