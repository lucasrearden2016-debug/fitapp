import nodemailer from 'nodemailer';

// SMTP genérico: sirve Gmail (contraseña de aplicación), Resend, Brevo, etc.
// Sin SMTP_HOST (en local) el mail se imprime en la consola en vez de enviarse.
console.log('SMTP check →', {
  user: JSON.stringify(process.env.SMTP_USER),
  passLength: process.env.SMTP_PASS?.length,
  passHasSpaces: /\s/.test(process.env.SMTP_PASS ?? ''),
});
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true });

const TEXTS = {
  es: {
    subject: 'Recuperá tu contraseña de FittingUp',
    hi: 'Hola',
    body: 'Pediste cambiar tu contraseña. Tocá el botón para elegir una nueva (el link vence en 30 minutos).',
    button: 'Elegir nueva contraseña',
    ignore: 'Si no fuiste vos, ignorá este mail: tu contraseña no cambia.',
  },
  en: {
    subject: 'Reset your FittingUp password',
    hi: 'Hi',
    body: 'You asked to change your password. Tap the button to choose a new one (the link expires in 30 minutes).',
    button: 'Choose new password',
    ignore: "If it wasn't you, ignore this email: your password won't change.",
  },
  pt: {
    subject: 'Recupere sua senha do FittingUp',
    hi: 'Olá',
    body: 'Você pediu para trocar sua senha. Toque no botão para escolher uma nova (o link expira em 30 minutos).',
    button: 'Escolher nova senha',
    ignore: 'Se não foi você, ignore este e-mail: sua senha não muda.',
  },
};

export async function sendResetEmail({ to, name, link, lang = 'es' }) {
  const t = TEXTS[lang] ?? TEXTS.es;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#37352f">
    <div style="font-weight:700;font-size:18px;margin-bottom:24px">FittingUp</div>
    <p>${t.hi} ${name},</p>
    <p>${t.body}</p>
    <p style="margin:28px 0">
      <a href="${link}" style="background:#2383e2;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${t.button}</a>
    </p>
    <p style="color:#787774;font-size:13px">${t.ignore}</p>
  </div>`;
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM || 'FittingUp <no-reply@FittingUp.local>',
    to,
    subject: t.subject,
    html,
    text: `${t.hi} ${name},\n\n${t.body}\n\n${link}\n\n${t.ignore}`,
  });
  if (!process.env.SMTP_HOST) console.log('📧 (sin SMTP, no se envió) Link de recuperación:', link);
  return info;
}