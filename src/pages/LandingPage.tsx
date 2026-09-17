import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, transformDriveUrl, getCountdown, type Config } from '../lib/supabase';

const DEFAULT_CONFIG: Config = {
  id: 1, banner_url: '', material_nuevo_url: '',
  auditores_por_tarea: 2, ticketmaster_url: '', entradas_gratis_url: '',
  fecha_evento: '2027-01-15', whatsapp_numero: '', whatsapp_mensaje: '',
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
    const target = new Date(config.fecha_evento + 'T21:00:00');
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

  // Genera el link de WhatsApp dinámicamente con ref del promotor
  const buildWhatsAppUrl = () => {
    if (!config.whatsapp_numero) return '';
    const mensaje = (config.whatsapp_mensaje || 'Hola, me interesa conseguir entradas sin cargo.')
      + (ref ? ` ref: @${ref}` : '');
    return `https://wa.me/${config.whatsapp_numero.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
  };

  const waUrl = buildWhatsAppUrl();
  const hasWA = !!waUrl;
  const hasTM = !!config.ticketmaster_url;

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

          {/* Banner */}
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
              href={hasTM ? ensureAbsoluteUrl(config.ticketmaster_url) : '#'}
              target={hasTM ? "_blank" : "_self"}
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!hasTM) { e.preventDefault(); return; }
                registerMetric('click_tm');
              }}
              className={`w-full ${hasTM ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-lg shadow-blue-900/20' : 'bg-blue-600/50 cursor-not-allowed opacity-40'} text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M20 12V6H4v6a2 2 0 0 0 0 4v6h16v-6a2 2 0 0 0 0-4z"/>
              </svg>
              Comprar en Ticketmaster
            </a>

            {/* Entradas sin cargo → WhatsApp dinámico */}
            <a
              href={hasWA ? waUrl : '#'}
              target={hasWA ? "_blank" : "_self"}
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!hasWA) { e.preventDefault(); return; }
                registerMetric('click_gratis');
              }}
              className={`w-full ${hasWA ? 'bg-white hover:bg-gray-100 active:scale-[0.98]' : 'bg-white/50 cursor-not-allowed opacity-40'} text-neutral-900 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm`}
            >
              {/* WhatsApp icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
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
