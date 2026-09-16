import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function PromoterLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!correo || !clave) {
      setError('Por favor, ingresa correo y clave');
      return;
    }
    
    setLoading(true);
    const res = await login(correo, clave);
    setLoading(false);
    
    if (res.success) {
      navigate('/promotor/dashboard');
    } else {
      setError(res.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-neutral-800 p-8 rounded-2xl w-full max-w-md shadow-2xl border border-white/10">
        <h1 className="text-2xl font-black mb-6 text-center tracking-tight">Portal Promotores</h1>
        
        {error && <div className="bg-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Correo</label>
            <input 
              type="email" 
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-red-500 outline-none" 
              placeholder="tu@correo.com" 
            />
          </div>
          <div>
            <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Clave</label>
            <input 
              type="password" 
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-red-500 outline-none" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all mt-4">
            {loading ? 'Validando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  );
}
