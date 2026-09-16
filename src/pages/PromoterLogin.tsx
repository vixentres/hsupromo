import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PromoterLogin() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-neutral-800 p-8 rounded-2xl w-full max-w-md shadow-2xl border border-white/10">
        <h1 className="text-2xl font-black mb-6 text-center tracking-tight">Portal Promotores</h1>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Correo</label>
            <input type="email" className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-red-500 outline-none" placeholder="tu@correo.com" />
          </div>
          <div>
            <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Clave</label>
            <input type="password" className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-red-500 outline-none" placeholder="••••••••" />
          </div>
          <button 
            onClick={() => navigate('/promotor/dashboard')}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-all mt-4">
            Ingresar
          </button>
        </div>
      </div>
    </div>
  );
}
