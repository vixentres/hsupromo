import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal .env parser
const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function seed() {
  console.log('Fetching promotores...');
  const { data: proms } = await supabase.from('promotores').select('*').eq('rol', 'promotor');
  if (!proms || proms.length === 0) {
    console.log('No promotores found!');
    return;
  }
  console.log(`Found ${proms.length} promotores.`);

  console.log('Deleting existing revisiones & tareas...');
  await supabase.from('revisiones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tareas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Dates: from yesterday backwards, 7 days.
  // Today is Sept 17, 2026. Yesterday is Sept 16.
  const dates = [];
  let d = new Date('2026-09-16T10:00:00Z');
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  dates.reverse(); // So it goes chronologically: 10th to 16th

  for (let i = 0; i < dates.length; i++) {
    const current = dates[i];
    const dateStr = current.toISOString().split('T')[0];
    console.log(`Generating task for ${dateStr}...`);
    
    const { data: tarea } = await supabase.from('tareas').insert({
      titulo: `Misión Diaria ${dateStr}`,
      fecha_tarea: dateStr,
      horas_duracion: 24,
      horas_revision: 4,
      activa: false,
      created_at: `${dateStr}T10:00:00Z`
    }).select().single();
    
    if (tarea) {
      // Shuffle proms for auditors
      const shuffled = [...proms];
      for (let x = shuffled.length - 1; x > 0; x--) {
        const y = Math.floor(Math.random() * (x + 1));
        [shuffled[x], shuffled[y]] = [shuffled[y], shuffled[x]];
      }

      const numAuditores = 2;
      const revisiones = [];
      
      // The last 2 days (index 5 and 6) will be 100% correct (all published, all audited 'SI')
      const isPerfectDay = i >= 5; 

      for (let pIndex = 0; pIndex < proms.length; pIndex++) {
        const p = proms[pIndex];
        
        let status = 'rojo';
        let override = null;

        if (isPerfectDay) {
          status = 'amarillo'; // They all published
        } else {
          // Variations for practice
          const rand = Math.random();
          if (rand < 0.6) status = 'amarillo'; // 60% published normally
          else if (rand < 0.7) { status = 'rojo'; override = 'verde'; } // 10% didn't publish but admin gave green
          else if (rand < 0.8) { status = 'rojo'; override = 'naranja'; } // 10% admin orange (justified)
          // 20% didn't do anything (rojo)
        }
        
        // My own revision
        revisiones.push({
          tarea_id: tarea.id,
          promotor_id: p.id,
          auditor_id: p.id,
          submission_status: status,
          admin_override: override,
          voto: 'SI',
          created_at: `${dateStr}T12:00:00Z`
        });
        
        // Assign auditors
        for (let j = 1; j <= numAuditores; j++) {
          const auditorIndex = (pIndex + j) % proms.length;
          const auditor = shuffled[auditorIndex];
          
          let vote = 'PENDIENTE';
          if (isPerfectDay) {
            vote = 'SI';
          } else {
            if (status === 'amarillo' || override !== null) {
              const vRand = Math.random();
              // high chance of SI if it was supposedly published
              vote = vRand < 0.8 ? 'SI' : (vRand < 0.9 ? 'NO' : 'JUSTIFICADO');
            }
          }
          
          revisiones.push({
            tarea_id: tarea.id,
            promotor_id: p.id,
            auditor_id: auditor.id,
            submission_status: 'rojo', // Auditor row has dummy rojo
            voto: vote,
            created_at: `${dateStr}T14:00:00Z`
          });
        }
      }
      
      // Batch insert
      for (let chunk = 0; chunk < revisiones.length; chunk += 50) {
        await supabase.from('revisiones').insert(revisiones.slice(chunk, chunk + 50));
      }
    }
  }
  
  console.log('Seed finished successfully!');
}

seed().catch(console.error);
