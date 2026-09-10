export const notify = async (
  webhookUrl,
  message
) => {
  console.log(message);

  if (!webhookUrl) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: message, text: message })
  });

  if (!response.ok) {
    console.warn(`Falha ao enviar notificacao: ${response.status} ${response.statusText}`);
  }
};
