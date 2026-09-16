import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, transformDriveUrl, getCountdown, type Config } from '../lib/supabase';

const DEFAULT_CONFIG: Config = {
  id: 1, banner_url: '', material_nuevo_url: '',
  auditores_por_tarea: 2, ticketmaster_url: '', entradas_gratis_url: '',
  fecha_evento: '2027-01-15',
};

export default function LandingPage() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || '';
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');

  useEffect(() => { loadConfig(); }, []);

  useEffect(() => {
    if (!ref) return;
    registerMetric('visita');
  }, [ref]);

  // Ticker de cuenta regresiva al evento
  useEffect(() => {
    if (!config.fecha_evento) return;
    const target = new Date(config.fecha_evento + 'T21:00:00'); // asumir las 21:00 como hora del evento
    const tick = () => setCountdown(getCountdown(target));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [config.fecha_evento]);

  const loadConfig = async () => {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single();
    if (data) setConfig(data);
    setLoading(false);
  };

  const registerMetric = async (tipo: string) => {
    if (!ref) return;
    const { data: promotor } = await supabase
      .from('promotores').select('id').eq('instagram', ref).maybeSingle();
    if (!promotor) return;
    await supabase.from('metricas').insert([{ promotor_id: promotor.id, tipo_accion: tipo }]);
  };

  const ensureAbsoluteUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const handleCTA = (tipo: 'click_tm' | 'click_gratis', url: string) => {
    if (url) window.open(ensureAbsoluteUrl(url), '_blank', 'noopener,noreferrer');
    registerMetric(tipo); // fire & forget
  };

  const bannerUrl = transformDriveUrl(config.banner_url);

  // Formatear fecha del evento legible
  const fechaEvento = config.fecha_evento
    ? new Date(config.fecha_evento + 'T12:00:00').toLocaleDateString('es-CL', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="bg-neutral-900 border border-white/8 rounded-3xl overflow-hidden shadow-2xl">

          {/* Banner — tamaño completo, sin recorte */}
          <div className="relative w-full bg-neutral-800">
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : bannerUrl ? (
              <img
                src={bannerUrl}
                alt="Banner del evento"
                className="w-full h-auto block"
                style={{ maxHeight: '480px', objectFit: 'contain' }}
              />
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2 border-b border-white/8">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-700">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                </svg>
                <p className="text-gray-600 text-xs">Banner del evento</p>
              </div>
            )}
          </div>

          {/* Cuenta regresiva al evento */}
          <div className="px-6 pt-5 pb-2 text-center border-b border-white/5">
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Faltan</p>
            <p className="text-2xl font-black font-mono tracking-tight text-white">{countdown || '...'}</p>
            <p className="text-gray-600 text-[11px] mt-0.5">{fechaEvento}</p>
          </div>

          {/* CTAs */}
          <div className="p-6 space-y-3">
            <a
              href={config.ticketmaster_url ? ensureAbsoluteUrl(config.ticketmaster_url) : '#'}
              target={config.ticketmaster_url ? "_blank" : "_self"}
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!config.ticketmaster_url) { e.preventDefault(); return; }
                registerMetric('click_tm');
              }}
              className={`w-full ${config.ticketmaster_url ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-lg shadow-blue-900/20' : 'bg-blue-600/50 cursor-not-allowed opacity-40'} text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M20 12V6H4v6a2 2 0 0 0 0 4v6h16v-6a2 2 0 0 0 0-4z"/>
              </svg>
              Comprar en Ticketmaster
            </a>

            <a
              href={config.entradas_gratis_url ? ensureAbsoluteUrl(config.entradas_gratis_url) : '#'}
              target={config.entradas_gratis_url ? "_blank" : "_self"}
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!config.entradas_gratis_url) { e.preventDefault(); return; }
                registerMetric('click_gratis');
              }}
              className={`w-full ${config.entradas_gratis_url ? 'bg-white hover:bg-gray-100 active:scale-[0.98]' : 'bg-white/50 cursor-not-allowed opacity-40'} text-neutral-900 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              Entradas sin cargo
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700 mt-5">
          Sistema de gestión de promotores HSU
        </p>
      </div>
    </div>
  );
}
