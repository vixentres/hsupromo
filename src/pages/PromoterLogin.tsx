import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Shield } from 'lucide-react';

export default function PromoterLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!correo || !clave) { setError('Por favor, ingresa correo y clave'); return; }
    setLoading(true);
    const res = await login(correo, clave);
    setLoading(false);
    if (res.success) {
      if (res.rol === 'admin') navigate('/admin');
      else navigate('/promotor/dashboard');
    } else {
      setError(res.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-neutral-950">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src="/hsu_logo.png" 
              alt="HSU Logo" 
              className="w-48 sm:w-56 object-contain"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Portal de Acceso</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de Gestión de Promotores</p>
        </div>

        <div className="bg-neutral-900 border border-white/8 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 outline-none transition-all"
                placeholder="tu@correo.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={clave}
                onChange={e => setClave(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all mt-2 text-sm tracking-wide"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Verificando...
                </span>
              ) : 'Ingresar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
