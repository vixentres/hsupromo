import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function PromoterLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const emailStr = correo.trim();
    if (!emailStr || !clave) { 
      setError('Por favor, ingresa correo y contraseña'); 
      return; 
    }
    
    setLoading(true);
    
    try {
      // 1. Verificar si el correo existe en la base de datos
      const { data: userData, error: userErr } = await supabase
        .from('promotores')
        .select('id, correo, clave')
        .eq('correo', emailStr)
        .maybeSingle();
        
      if (userErr || !userData) {
        setError('No se encontró ninguna cuenta con este correo.');
        setLoading(false);
        return;
      }
      
      // 2. Si no tiene clave, guardar la que acaba de escribir
      if (!userData.clave || userData.clave.trim() === '') {
        if (clave.length < 4) {
          setError('La contraseña debe tener al menos 4 caracteres.');
          setLoading(false);
          return;
        }
        
        setIsCreating(true);
        const { error: updateErr } = await supabase
          .from('promotores')
          .update({ clave })
          .eq('id', userData.id);
          
        if (updateErr) {
          setError('Error al crear la contraseña.');
          setLoading(false);
          setIsCreating(false);
          return;
        }
      }
      
      // 3. Iniciar sesión (ya sea con la clave existente o la recién creada)
      const res = await login(emailStr, clave);
      
      if (res.success) {
        if (res.rol === 'admin') navigate('/admin');
        else navigate('/promotor/dashboard');
      } else {
        setError(res.message || 'Contraseña incorrecta');
        setLoading(false);
        setIsCreating(false);
      }
      
    } catch (err) {
      setError('Error de red o de servidor.');
      setLoading(false);
      setIsCreating(false);
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

        <div className="bg-neutral-900 border border-white/8 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-6 relative z-10">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Correo o Usuario
              </label>
              <input
                type="text"
                name="email"
                autoComplete="email"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 outline-none transition-all text-white"
                placeholder="Ingresa tu correo o usuario"
                required
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between mb-2">
                <span>Contraseña</span>
              </label>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={clave}
                onChange={e => setClave(e.target.value)}
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 outline-none transition-all text-white"
                placeholder="••••••••"
                required
              />
              <p className="text-[10px] text-gray-500 mt-2">
                * Si es tu primera vez, escribe la contraseña que deseas usar y se guardará automáticamente.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all mt-5 text-sm tracking-wide flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  {isCreating ? 'Guardando...' : 'Verificando...'}
                </>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
