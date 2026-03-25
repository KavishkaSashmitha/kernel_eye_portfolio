import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const MAX_FIELD_LENGTH = {
  name: 120,
  email: 255,
  subject: 200,
  message: 5000,
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const sanitize = (value: FormDataEntryValue | null, maxLen: number) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: 'Server configuration is missing.' }, 500);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
    return json({ error: 'Unsupported content type.' }, 415);
  }

  const formData = await request.formData();
  const name = sanitize(formData.get('name'), MAX_FIELD_LENGTH.name);
  const email = sanitize(formData.get('email'), MAX_FIELD_LENGTH.email).toLowerCase();
  const subject = sanitize(formData.get('subject'), MAX_FIELD_LENGTH.subject);
  const message = sanitize(formData.get('message'), MAX_FIELD_LENGTH.message);

  if (!name || !email || !subject || !message) {
    return json({ error: 'All fields are required.' }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json({ error: 'Please provide a valid email address.' }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.from('contact_submissions').insert({
    name,
    email,
    subject,
    message,
    ip_address: clientAddress ?? null,
    user_agent: request.headers.get('user-agent') ?? null,
  });

  if (error) {
    return json({ error: 'Failed to submit your message. Please try again.' }, 500);
  }

  return json({ ok: true, message: 'Message sent successfully.' }, 201);
};
