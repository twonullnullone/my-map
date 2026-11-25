
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://aqxbpnaifdgkqfgbwaaw.supabase.co', 'sb_publishable_f65ydTnZHMY8y-J86q9QpQ_YNzqldgl');

function getOrCreateDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'usr_' + crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}
