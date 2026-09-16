import React, { useState } from 'react';
import { Users, BarChart3, Settings, Plus, ExternalLink } from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'tasks' | 'stats'>('users');

  return (
    <div className="p-8 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black tracking-tight">Admin Hub</h1>
        <div className="flex gap-2 bg-neutral-800 p-1 rounded-lg">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}><Users size={16} /> Usuarios</button>
          <button onClick={() => setActiveTab('tasks')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}><Settings size={16} /> Gestor de Tareas</button>
          <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === 'stats' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}><BarChart3 size={16} /> Analíticas</button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="bg-neutral-800 rounded-2xl p-6 border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Crear Promotor</h2>
            <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm">
              <Plus size={16} /> Añadir a Google Sheets
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Nombre Completo</label>
              <input type="text" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 block mb-1">RUT</label>
              <input type="text" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Correo Electrónico</label>
              <input type="email" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Clave de Acceso</label>
              <input type="text" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 block mb-1 flex justify-between">
                <span>Usuario Instagram</span>
                <span className="text-red-400 font-normal normal-case text-[10px]">*Notificar si lo cambian</span>
              </label>
              <input type="text" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder="Sin el @" />
            </div>
            <div>
              <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Enlace de Chat Directo (IG)</label>
              <input type="text" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" placeholder="https://www.instagram.com/direct/t/..." />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="bg-neutral-800 rounded-2xl p-6 border border-white/5">
            <h2 className="text-xl font-bold mb-4">Añadir Tarea Diaria</h2>
            <div className="flex gap-4">
              <input type="text" placeholder="Título de la tarea..." className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none" />
              <select className="bg-black border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none text-white">
                <option value="24">Duración: 24 Horas</option>
                <option value="48">Duración: 48 Horas</option>
              </select>
              <button className="bg-white text-black font-bold py-2 px-6 rounded-lg hover:bg-gray-200 transition-colors">Crear y Asignar Revisiones</button>
            </div>
          </div>

          <div className="bg-neutral-800 rounded-2xl p-6 border border-white/5">
            <h2 className="text-xl font-bold mb-4">Mapa de Calor (Auditorías)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="pb-3 font-bold">Promotor</th>
                    <th className="pb-3 font-bold text-center">15 Sep</th>
                    <th className="pb-3 font-bold text-center">16 Sep (Hoy)</th>
                    <th className="pb-3 font-bold text-center">Auditoría Admin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-4 font-bold text-white">Juanito Pérez</td>
                    <td className="py-4 text-center"><span className="inline-block w-4 h-4 rounded bg-green-500" title="Verde: Realizado y verificado"></span></td>
                    <td className="py-4 text-center"><span className="inline-block w-4 h-4 rounded bg-yellow-500" title="Amarillo: En revisión cruzada"></span></td>
                    <td className="py-4 text-center"><button className="text-xs text-blue-400 hover:underline">Ver Chat IG</button></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-4 font-bold text-white">María Gómez</td>
                    <td className="py-4 text-center"><span className="inline-block w-4 h-4 rounded bg-purple-500" title="Morado: Auditor leal"></span></td>
                    <td className="py-4 text-center"><span className="inline-block w-4 h-4 rounded bg-red-500" title="Rojo: Castigo / Incumplimiento"></span></td>
                    <td className="py-4 text-center"><button className="text-xs text-blue-400 hover:underline">Ver Chat IG</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-neutral-800 rounded-2xl p-6 border border-white/5">
          <h2 className="text-xl font-bold mb-6">Tráfico de Enlaces Personales</h2>
          <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="pb-3 font-bold">Promotor</th>
                    <th className="pb-3 font-bold text-right">Vistas del Landing</th>
                    <th className="pb-3 font-bold text-right">Clicks Ticketmaster</th>
                    <th className="pb-3 font-bold text-right">Clicks Entradas s/c</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-4 font-bold text-white flex items-center gap-2">
                      Juanito Pérez 
                      <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded-full uppercase">Top 1</span>
                    </td>
                    <td className="py-4 text-right font-mono">145</td>
                    <td className="py-4 text-right font-mono text-green-400">42</td>
                    <td className="py-4 text-right font-mono text-blue-400">18</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-4 font-bold text-white">María Gómez</td>
                    <td className="py-4 text-right font-mono">89</td>
                    <td className="py-4 text-right font-mono text-green-400">12</td>
                    <td className="py-4 text-right font-mono text-blue-400">5</td>
                  </tr>
                </tbody>
              </table>
        </div>
      )}
    </div>
  );
}
