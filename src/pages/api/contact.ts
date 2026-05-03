import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

const MAX_FIELD_LENGTH = {
  name: 120,
  email: 255,
  subject: 200,
  message: 5000,
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sanitize = (value: unknown, maxLen: number): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
};

// Initialize Nodemailer transporter for Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: import.meta.env.GMAIL_USER,
      pass: import.meta.env.GMAIL_APP_PASSWORD,
    },
  });
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const recipientEmail = import.meta.env.RECIPIENT_EMAIL || 'kerneleye4u@gmail.com';

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json({ error: 'Unsupported content type.' }, 415);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const name    = sanitize(body.name,    MAX_FIELD_LENGTH.name);
  const email   = sanitize(body.email,   MAX_FIELD_LENGTH.email).toLowerCase();
  const subject = sanitize(body.subject, MAX_FIELD_LENGTH.subject);
  const message = sanitize(body.message, MAX_FIELD_LENGTH.message);

  if (!name || !email || !subject || !message) {
    return json({ error: 'All fields are required.' }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json({ error: 'Please provide a valid email address.' }, 400);
  }

  // Send email
  try {
    const transporter = createTransporter();
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e293b; margin-bottom: 20px;">New Contact Form Submission</h2>
        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>IP Address:</strong> ${clientAddress ?? 'N/A'}</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
          <h3 style="color: #0ea5e9; margin-top: 0;">Message:</h3>
          <p style="white-space: pre-wrap; color: #334155;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: import.meta.env.GMAIL_USER,
      to: recipientEmail,
      replyTo: email,
      subject: `[KernelEye] ${subject}`,
      html: htmlContent,
      text: `New contact submission from ${name} (${email}):\n\nSubject: ${subject}\n\nMessage:\n${message}`,
    });
  } catch (emailError) {
    console.error('Email sending failed:', emailError);
    return json({ error: 'Failed to send email. Please try again.' }, 500);
  }

  return json({ ok: true, message: 'Message sent successfully.' }, 201);
};
