import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const dataPath = path.join('..', 'HSU_WEBPAGE', 'google_contacts', 'promotores_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

async function run() {
  console.log(`Upserting ${data.length} records...`);
  const { data: res, error } = await supabase.from('promotores').upsert(data, { onConflict: 'correo' });
  if (error) {
    console.error(error);
  } else {
    console.log("Success!");
  }
}
run();
