import nodemailer from 'nodemailer';

export const notify = async (config, message) => {
  console.log(message);

  const results = await Promise.allSettled([
    notifyWebhook(config.notifyWebhookUrl, message),
    notifyEmail(config, message)
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`Falha ao enviar notificacao: ${result.reason}`);
    }
  }
};

const notifyWebhook = async (webhookUrl, message) => {
  if (!webhookUrl) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: message, text: message })
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
};

const notifyEmail = async (config, message) => {
  if (!config.emailTo || !config.emailSmtpUser || !config.emailSmtpPass || !config.emailFrom) {
    return;
  }

  const email = buildEmail(message);
  const transporter = nodemailer.createTransport({
    host: config.emailSmtpHost,
    port: config.emailSmtpPort,
    secure: config.emailSmtpSecure,
    auth: {
      user: config.emailSmtpUser,
      pass: config.emailSmtpPass
    }
  });

  await transporter.sendMail({
    from: config.emailFrom,
    to: config.emailTo,
    subject: email.subject,
    text: email.text,
    html: email.html
  });
};

const buildEmail = (message) => {
  const status = notificationStatus(message);
  const details = parseBookingDetails(message);

  return {
    subject: status.subject,
    text: emailText(status, details, message),
    html: emailHtml(status, details, message)
  };
};

const notificationStatus = (message) => {
  if (message.startsWith('[confirmed]')) {
    return {
      badge: 'Confirmado',
      color: '#16a34a',
      eyebrow: 'Agendamento confirmado',
      subject: 'Agendamento confirmado',
      title: 'Seu horario foi marcado'
    };
  }

  if (message.startsWith('[dry-run]')) {
    return {
      badge: 'Teste concluido',
      color: '#2563eb',
      eyebrow: 'Dry-run concluido',
      subject: 'Teste do agendamento concluido',
      title: 'O fluxo do bot funcionou'
    };
  }

  if (message.startsWith('[erro]')) {
    return {
      badge: 'Falha',
      color: '#dc2626',
      eyebrow: 'Erro no bot',
      subject: 'Falha no bot de agendamento',
      title: 'O bot encontrou um problema'
    };
  }

  return {
    badge: 'Atualizacao',
    color: '#4b5563',
    eyebrow: 'Bot de agendamento',
    subject: 'Bot de agendamento',
    title: 'Atualizacao do bot'
  };
};

const parseBookingDetails = (message) => {
  const match = message.match(/: (?<service>.+?) com (?<professional>.+?) em (?<date>\d{2}\/\d{2}\/\d{4}) as (?<time>\d{1,2}:\d{2})\./);

  if (!match?.groups) {
    return undefined;
  }

  return {
    service: match.groups.service,
    professional: match.groups.professional,
    date: match.groups.date,
    time: match.groups.time
  };
};

const emailText = (status, details, message) => {
  if (!details) {
    return `${status.title}\n\n${message}`;
  }

  return [
    status.title,
    '',
    `Status: ${status.badge}`,
    `Servico: ${details.service}`,
    `Profissional: ${details.professional}`,
    `Data: ${details.date}`,
    `Horario: ${details.time}`,
    '',
    'Mensagem original:',
    message
  ].join('\n');
};

const emailHtml = (status, details, message) => {
  const detailRows = details
    ? [
      ['Servico', details.service],
      ['Profissional', details.professional],
      ['Data', details.date],
      ['Horario', details.time]
    ].map(([label, value]) => `
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:14px;">${escapeHtml(label)}</td>
        <td style="padding:10px 0;color:#111827;font-size:15px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td style="padding:16px 0;color:#111827;font-size:15px;line-height:1.6;">${escapeHtml(message)}</td>
      </tr>
    `;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px 18px;">
                <div style="font-size:15px;font-weight:800;color:${status.color};letter-spacing:.2px;">Barbearia Bot</div>
                <h1 style="margin:36px 0 12px;font-size:28px;line-height:1.2;color:#111827;">${escapeHtml(status.title)}</h1>
                <p style="margin:0;color:#4b5563;font-size:16px;line-height:1.5;">${escapeHtml(status.eyebrow)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;">
                <div style="display:inline-block;background:${status.color};color:#ffffff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;">${escapeHtml(status.badge)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
                  ${detailRows}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">Mensagem original</p>
                <p style="margin:8px 0 0;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(message)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};
