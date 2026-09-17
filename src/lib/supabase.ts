import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Helper: convierte URL compartida de Google Drive a URL renderizable ───────
export const transformDriveUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match?.[1]) return `https://lh3.googleusercontent.com/u/0/d/${match[1]}`;
  }
  return url;
};

// ── Helper: cuenta regresiva ──────────────────────────────────────────────────
export const getCountdown = (targetDate: string | Date): string => {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Expirado';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ── Tipos ────────────────────────────────────────────────────────────────────
export type Rol = 'promotor' | 'admin';
export type EstadoColor = 'rojo' | 'amarillo' | 'verde' | 'morado' | 'naranja';
export type VotoAuditoria = 'SI' | 'NO' | 'JUSTIFICADO' | 'PENDIENTE';

export interface Promotor {
  id: string;
  nombre: string;
  rut: string;
  correo: string;
  telefono?: string;
  clave: string;
  instagram: string;
  rol: Rol;
  created_at?: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  material_nuevo: string;
  horas_duracion: number;
  horas_revision: number;
  activa: boolean;
  fecha_tarea: string;
  created_at?: string;
}

export interface Revision {
  id: string;
  tarea_id: string;
  promotor_id: string;
  auditor_id: string;
  voto: VotoAuditoria;
  submission_status: EstadoColor;
  admin_override: EstadoColor | null;
  created_at?: string;
}

export interface Config {
  id: number;
  banner_url: string;
  material_nuevo_url: string;
  auditores_por_tarea: number;
  ticketmaster_url: string;
  entradas_gratis_url: string;
  fecha_evento: string;
}
