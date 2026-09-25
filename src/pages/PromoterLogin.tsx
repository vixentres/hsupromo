import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function PromoterLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<'email' | 'login' | 'create'>('email');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckEmail = async () => {
    setError('');
    if (!correo) { setError('Por favor, ingresa tu correo'); return; }
    setLoading(true);
    
    try {
      const { data, error: err } = await supabase
        .from('promotores')
        .select('id, correo, clave, rol, nombre')
        .eq('correo', correo.trim())
        .maybeSingle();
        
      if (err || !data) {
        setError('No se encontró ninguna cuenta con este correo.');
      } else {
        setUserData(data);
        if (!data.clave || data.clave.trim() === '') {
          setStep('create');
        } else {
          setStep('login');
        }
      }
    } catch (e) {
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!clave) { setError('Por favor, ingresa tu contraseña'); return; }
    setLoading(true);
    const res = await login(correo.trim(), clave);
    setLoading(false);
    if (res.success) {
      if (res.rol === 'admin') navigate('/admin');
      else navigate('/promotor/dashboard');
    } else {
      setError(res.message || 'Contraseña incorrecta');
    }
  };

  const handleCreatePassword = async () => {
    setError('');
    if (!clave || clave.length < 4) { setError('La contraseña debe tener al menos 4 caracteres'); return; }
    setLoading(true);
    
    try {
      const { error: err } = await supabase
        .from('promotores')
        .update({ clave })
        .eq('id', userData.id);
        
      if (err) throw err;
      
      // Auto-login
      const res = await login(correo.trim(), clave);
      if (res.success) {
        if (res.rol === 'admin') navigate('/admin');
        else navigate('/promotor/dashboard');
      } else {
        setError('Error al iniciar sesión tras crear la clave.');
      }
    } catch (e) {
      setError('Error al guardar la contraseña.');
    } finally {
      setLoading(false);
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
          
          <div className="space-y-5 relative z-10">
            {step === 'email' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={correo}
                  onChange={e => setCorreo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCheckEmail()}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 outline-none transition-all text-white"
                  placeholder="tu@correo.com"
                  autoFocus
                />
                <button
                  onClick={handleCheckEmail}
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all mt-5 text-sm tracking-wide"
                >
                  {loading ? 'Verificando...' : 'Siguiente'}
                </button>
              </div>
            )}

            {step === 'login' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-300">
                    Hola, <span className="font-bold text-white">{userData?.nombre?.split(' ')[0]}</span>
                  </div>
                  <button onClick={() => setStep('email')} className="text-xs text-blue-400 hover:text-blue-300">
                    Cambiar correo
                  </button>
                </div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={clave}
                  onChange={e => setClave(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 outline-none transition-all text-white"
                  placeholder="••••••••"
                  autoFocus
                />
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all mt-5 text-sm tracking-wide"
                >
                  {loading ? 'Iniciando sesión...' : 'Ingresar'}
                </button>
              </div>
            )}

            {step === 'create' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-4">
                  <h3 className="text-white font-bold mb-1">¡Bienvenido, {userData?.nombre?.split(' ')[0]}!</h3>
                  <p className="text-xs text-gray-400">Es tu primera vez ingresando. Por favor, crea una contraseña para tu cuenta.</p>
                </div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Crea una contraseña
                </label>
                <input
                  type="password"
                  value={clave}
                  onChange={e => setClave(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreatePassword()}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 outline-none transition-all text-white"
                  placeholder="••••••••"
                  autoFocus
                />
                <button
                  onClick={handleCreatePassword}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all mt-5 text-sm tracking-wide"
                >
                  {loading ? 'Guardando...' : 'Crear contraseña e Ingresar'}
                </button>
                <button onClick={() => setStep('email')} className="w-full text-xs text-gray-500 hover:text-gray-400 mt-4 text-center block">
                  Volver atrás
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
