# Bot de agendamento do barbeiro

Bot em Node.js + JavaScript + Playwright para automatizar agendamento no Cashbarber da NOVACA Barbearia.

## O que ele faz

O fluxo atual:

1. Abre o Cashbarber.
2. Faz login com email e senha.
3. Clica em `Novo agendamento`.
4. Seleciona a filial `Imbariê`.
5. Seleciona o profissional `Weslley gomes`.
6. Seleciona o serviço `Corte de cabelo`.
7. Procura a próxima sexta-feira disponível.
8. Escolhe o horário pela regra de prioridade.
9. Agenda, se `DRY_RUN=false`.

## Regra de horário

Defaults:

```env
PREFERRED_TIME=11:00
FALLBACK_AFTER_TIME=16:30
```

A escolha funciona assim:

1. Se tiver `11:00`, escolhe `11:00`.
2. Se não tiver, escolhe o horário mais próximo antes de `11:00`.
3. Se não tiver nenhum horário até `11:00`, escolhe `16:30` ou o primeiro horário depois disso.
4. Se só tiver horários entre `11:00` e `16:30`, escolhe o primeiro disponível nesse intervalo.

## GitHub Actions

O workflow deve ser disparado por `workflow_dispatch`. O `schedule` do GitHub Actions foi removido porque atrasou várias horas mesmo com cron de teste a cada 5 minutos.

Use um cron externo para chamar a API do GitHub toda sexta às `23:50` em `America/Sao_Paulo`.

Endpoint:

```text
POST https://api.github.com/repos/lucaasbonfim/bot-agendamento-barbeiro/actions/workflows/schedule.yml/dispatches
```

Headers:

```text
Accept: application/vnd.github+json
Authorization: Bearer SEU_TOKEN_AQUI
X-GitHub-Api-Version: 2026-03-10
Content-Type: application/json
```

Body:

```json
{
  "ref": "main",
  "inputs": {
    "dry_run": "false",
    "skip_wait": "false"
  }
}
```

Depois que o job inicia, o bot espera até:

```env
WAIT_UNTIL_TIME=00:00
```

Então o fluxo real começa no sábado `00:00`, quando a agenda da próxima sexta libera.

## Secrets obrigatórios

Cadastre em `Settings > Secrets and variables > Actions > Secrets`:

```text
BOOKING_URL=https://cashbarber.com.br/novacabarbearia/login
BARBER_USERNAME=seu_email
BARBER_PASSWORD=sua_senha
```

Opcional:

```text
NOTIFY_WEBHOOK_URL=
```

Para receber email de sucesso/erro, cadastre também:

```text
EMAIL_SMTP_USER=seu_email@gmail.com
EMAIL_SMTP_PASS=sua_senha_de_app
EMAIL_TO=email_que_vai_receber
```

Se usar Gmail, `EMAIL_SMTP_PASS` deve ser uma senha de app do Google. Não use sua senha normal da conta.

## Defaults importantes

No GitHub Actions, se você não cadastrar variables, o workflow usa:

```env
BRANCH_NAME=Imbariê
PROFESSIONAL_NAME=Weslley gomes
SERVICE_NAME=Corte de cabelo
TARGET_WEEKDAY=friday
PREFERRED_TIME=11:00
FALLBACK_AFTER_TIME=16:30
BOOKING_DAYS_AHEAD=7
TIMEZONE=America/Sao_Paulo
WAIT_UNTIL_TIME=00:00
WAIT_GRACE_MINUTES=5
WAIT_MAX_MINUTES=15
SKIP_WAIT=false
DRY_RUN=false
HEADLESS=true
```

Email usa Gmail por padrão:

```env
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_SECURE=true
```

`DRY_RUN=false` no Actions significa que ele confirma o agendamento de verdade.

## Teste local

Instale:

```powershell
npm install
npx playwright install chromium
```

Crie seu `.env`:

```powershell
Copy-Item .env.example .env
```

Preencha `BOOKING_URL`, `BARBER_USERNAME` e `BARBER_PASSWORD`.

Para testar com navegador aberto:

```powershell
npm run bot:headed
```

Esse comando define `SKIP_WAIT=true`, então não espera meia-noite. Para teste local, mantenha:

```env
DRY_RUN=true
```

Assim ele para antes de confirmar e salva screenshot em `artifacts/`.

## Teste manual no GitHub Actions

Para rodar pelo botão `Run workflow`, escolha os inputs:

```env
DRY_RUN=true
SKIP_WAIT=true
```

Isso roda sem esperar meia-noite e sem confirmar o agendamento.

Para um teste manual que confirma de verdade, use:

```env
DRY_RUN=false
SKIP_WAIT=true
```

O cron externo de produção deve chamar `workflow_dispatch` com `DRY_RUN=false` e `SKIP_WAIT=false`.

## Produção

Para o agendamento automático funcionar de verdade:

1. Faça push para a branch `main`.
2. Cadastre os secrets obrigatórios.
3. Não defina `DRY_RUN=true` nas variables do Actions.
4. Crie um token fine-grained do GitHub limitado a este repositório com permissão `Actions: Read and write`.
5. Configure o cron externo para chamar o endpoint de `workflow_dispatch` toda sexta às `23:50`.
6. Confira a aba `Actions` no GitHub.

Também dá para disparar manualmente pelo botão `Run workflow`.
