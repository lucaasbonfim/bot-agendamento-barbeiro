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
    subject: emailSubject(message),
    text: message
  });
};

const emailSubject = (message) => {
  if (message.startsWith('[confirmed]')) {
    return 'Agendamento confirmado';
  }

  if (message.startsWith('[dry-run]')) {
    return 'Teste do agendamento concluido';
  }

  if (message.startsWith('[erro]')) {
    return 'Falha no bot de agendamento';
  }

  return 'Bot de agendamento';
};
