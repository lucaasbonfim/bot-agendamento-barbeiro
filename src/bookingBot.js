import { chromium } from 'playwright';
import { getTargetDate } from './date.js';

export const runBookingBot = async (config) => {
  const browser = await chromium.launch({ headless: config.headless });
  let page;

  try {
    page = await newPage(browser, config.timezone);
    const targetDate = getTargetDate({
      preferredDate: config.preferredDate,
      targetWeekday: config.targetWeekday,
      bookingDaysAhead: config.bookingDaysAhead,
      timezone: config.timezone
    });

    await page.goto(config.bookingUrl, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page, 'abrir site', { timeout: 20_000 });
    await login(page, config);
    await startNewAppointment(page);
    await chooseBranch(page, config.branchName);
    await chooseProfessional(page, config.professionalName);
    await chooseService(page, config.serviceName);
    const selectedTime = await chooseDateAndTime(
      page,
      targetDate,
      config.preferredTime,
      config.fallbackAfterTime
    );

    if (config.dryRun) {
      await page.screenshot({ path: 'artifacts/dry-run.png', fullPage: true });

      return {
        status: 'dry-run',
        details: `Fluxo validado ate antes da confirmacao: ${config.serviceName} com ${config.professionalName} em ${targetDate.label} as ${selectedTime}.`
      };
    }

    await confirmBooking(page);
    await page.screenshot({ path: 'artifacts/confirmed.png', fullPage: true });

    return {
      status: 'confirmed',
      details: `Agendamento confirmado: ${config.serviceName} com ${config.professionalName} em ${targetDate.label} as ${selectedTime}.`
    };
  } catch (error) {
    if (page) {
      await page.screenshot({ path: 'artifacts/error.png', fullPage: true }).catch(() => undefined);
    }

    throw error;
  } finally {
    await browser.close();
  }
};

const newPage = async (browser, timezone) => {
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: timezone,
    viewport: { width: 1366, height: 768 }
  });

  context.setDefaultTimeout(15_000);

  return context.newPage();
};

const login = async (page, config) => {
  if (!config.username || !config.password) {
    return;
  }

  await waitForAppReady(page, 'login', { timeout: 12_000, networkIdleTimeout: 750 });

  if (await page.getByText(/novo agendamento/i).first().isVisible().catch(() => false)) {
    console.log('Sessao ja autenticada.');
    return;
  }

  const emailInput = page
    .getByLabel(/e-?mail|usuario|telefone/i)
    .or(page.getByPlaceholder(/e-?mail|usuario|telefone/i))
    .or(page.locator('input[type="email"], input[name*="email" i]'))
    .first();
  const passwordInput = page
    .getByLabel(/senha/i)
    .or(page.getByPlaceholder(/senha/i))
    .or(page.locator('input[type="password"]'))
    .first();

  await emailInput.waitFor({ state: 'visible', timeout: 8_000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 8_000 });

  await emailInput.fill(config.username);
  await passwordInput.fill(config.password);
  await page.getByRole('button', { name: /entrar|login|acessar|continuar/i }).first().click();

  await Promise.race([
    page.waitForURL(/\/inicio/i, { timeout: 12_000 }),
    page.getByText(/novo agendamento/i).first().waitFor({ state: 'visible', timeout: 12_000 })
  ]).catch(async () => {
    await page.screenshot({ path: 'artifacts/login-timeout.png', fullPage: true }).catch(() => undefined);
    throw new Error('Login nao chegou na tela inicial dentro de 12s.');
  });

  await waitForAppReady(page, 'pos-login', { timeout: 8_000, networkIdleTimeout: 750 });
};

const startNewAppointment = async (page) => {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /novo agendamento/i }),
    page.getByText(/\+?\s*novo agendamento/i),
    page.getByRole('link', { name: /novo agendamento/i })
  ]);
};

const chooseBranch = async (page, branchName) => {
  await clickFirstVisible(page, [
    page.getByText(/selecione a filial/i),
    page.getByRole('button', { name: /selecione a filial/i })
  ]);

  await clickFirstVisible(page, branchLocators(page, branchName));
};

const chooseProfessional = async (page, professionalName) => {
  await clickFirstVisible(page, [
    page.getByText(/selecione um profissional/i),
    page.getByRole('button', { name: /selecione um profissional/i })
  ]);

  await clickProfessionalCard(page, professionalName);
};

const chooseService = async (page, serviceName) => {
  await clickFirstVisible(page, [
    page.getByText(/selecione os serviços|selecione os servicos/i),
    page.getByRole('button', { name: /selecione os serviços|selecione os servicos/i })
  ]);

  const servicePattern = new RegExp(escapeRegExp(serviceName), 'i');
  await clickFirstVisible(page, [
    page.getByText(servicePattern),
    page.getByRole('button', { name: servicePattern }),
    page.getByLabel(servicePattern)
  ]);

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /^confirmar$/i }),
    page.getByText(/^confirmar$/i)
  ]);
};

const chooseDateAndTime = async (page, targetDate, preferredTime, fallbackAfterTime) => {
  await clickFirstVisible(page, [
    page.getByText(/selecione um horário|selecione um horario/i),
    page.getByRole('button', { name: /selecione um horário|selecione um horario/i })
  ]);

  await clickFirstVisible(page, [
    page.getByRole('button', { name: new RegExp(`^${escapeRegExp(targetDate.dayText)}$`) }),
    page.getByText(new RegExp(`^${escapeRegExp(targetDate.dayText)}$`))
  ]);

  await page.getByText(/horários disponíveis|horarios disponiveis/i).waitFor({ timeout: 10_000 });

  if (await page.getByText(/não encontramos horários disponíveis|nao encontramos horarios disponiveis/i).isVisible().catch(() => false)) {
    throw new Error(`Nao ha horarios disponiveis para ${targetDate.label}.`);
  }

  return chooseBestAvailableTime(page, preferredTime, fallbackAfterTime);
};

const confirmBooking = async (page) => {
  await page
    .getByRole('button', { name: /^agendar$/i })
    .first()
    .click();
  await waitForScreenSettle(page);
  await page.getByRole('button', { name: /^confirmar$/i }).first().click().catch(() => undefined);
};

const clickFirstVisible = async (page, locators) => {
  await waitForAnyVisible(locators);

  for (const locator of locators) {
    const count = await locator.count();

    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);

      if (
        await item.isVisible().catch(() => false) &&
        await item.isEnabled().catch(() => true)
      ) {
        const clickedText = await locatorText(item);

        if (await clickLocator(page, item)) {
          await waitForScreenSettle(page);
          await page.waitForTimeout(300);
          return clickedText;
        }
      }
    }
  }

  throw new Error('Nao encontrei um elemento clicavel esperado no fluxo de agendamento.');
};

const clickProfessionalCard = async (page, professionalName) => {
  const locators = professionalLocators(page, professionalName);
  await waitForAnyVisible(locators);

  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const text = locator.nth(index);

      if (!await text.isVisible().catch(() => false)) {
        continue;
      }

      const card = text.locator('xpath=ancestor::*[.//img][1]');

      if (await card.count().catch(() => 0) > 0 && await clickLocator(page, card.first())) {
        await waitForScreenSettle(page);
        await page.waitForTimeout(300);
        return;
      }

      if (await clickLocator(page, text)) {
        await waitForScreenSettle(page);
        await page.waitForTimeout(300);
        return;
      }
    }
  }

  const available = await page.locator('body').innerText().catch(() => '');
  throw new Error(`Nao consegui selecionar o profissional "${professionalName}". Tela atual: ${available.slice(0, 500)}`);
};

const clickLocator = async (page, locator) => {
  try {
    await locator.click({ timeout: 3_000 });
    return true;
  } catch {
    // Continua para fallbacks abaixo.
  }

  try {
    await locator.click({ force: true, timeout: 3_000 });
    return true;
  } catch {
    // Continua para clique via DOM abaixo.
  }

  try {
    await locator.evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(100);
    return true;
  } catch {
    return false;
  }
};

const waitForAppReady = async (
  page,
  step,
  { timeout = 15_000, networkIdleTimeout = 1_500 } = {}
) => {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);

  await page
    .waitForFunction(
      () => !document.body?.innerText?.match(/carregando\.*$/i),
      undefined,
      { timeout }
    )
    .catch(async () => {
      await page.screenshot({ path: `artifacts/loading-${step}.png`, fullPage: true }).catch(() => undefined);
      throw new Error(`O Cashbarber ficou em Carregando durante a etapa: ${step}.`);
    });

  await waitForScreenSettle(page, networkIdleTimeout);
};

const waitForScreenSettle = async (page, timeout = 1_500) => {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
};

const waitForAnyVisible = async (locators, timeout = 20_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    for (const locator of locators) {
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index += 1) {
        if (await locator.nth(index).isVisible().catch(() => false)) {
          return;
        }
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error('Nao encontrei elemento visivel para continuar o fluxo.');
};

const locatorText = async (locator) => {
  const text = await locator.innerText().catch(async () => locator.textContent().catch(() => ''));

  return text.replace(/\s+/g, ' ').trim();
};

const chooseBestAvailableTime = async (page, preferredTime, fallbackAfterTime) => {
  const slots = await findAvailableTimeSlots(page);

  if (slots.length === 0) {
    throw new Error('Nao encontrei nenhum horario disponivel na tela.');
  }

  if (!preferredTime) {
    const firstSlot = slots[0];
    await clickTimeSlot(page, firstSlot);
    return firstSlot.time;
  }

  const targetMinutes = timeToMinutes(preferredTime);
  const beforeOrEqualTarget = slots
    .filter((slot) => slot.minutes <= targetMinutes)
    .sort((left, right) => right.minutes - left.minutes)[0];

  if (beforeOrEqualTarget) {
    await clickTimeSlot(page, beforeOrEqualTarget);
    return beforeOrEqualTarget.time;
  }

  const fallbackMinutes = fallbackAfterTime ? timeToMinutes(fallbackAfterTime) : undefined;
  const afterOrEqualFallback = fallbackMinutes === undefined
    ? undefined
    : slots
      .filter((slot) => slot.minutes >= fallbackMinutes)
      .sort((left, right) => left.minutes - right.minutes)[0];

  if (afterOrEqualFallback) {
    await clickTimeSlot(page, afterOrEqualFallback);
    return afterOrEqualFallback.time;
  }

  const selectedSlot = slots[0];

  if (!selectedSlot) {
    throw new Error(
      `Nao ha horario disponivel. Disponiveis: ${slots.map((slot) => slot.time).join(', ')}.`
    );
  }

  await clickTimeSlot(page, selectedSlot);
  return selectedSlot.time;
};

const findAvailableTimeSlots = async (page) => {
  const locators = [
    page.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }),
    page.getByText(/^\d{1,2}:\d{2}$/)
  ];
  const slots = [];
  const seen = new Set();

  await waitForAnyVisible(locators, 10_000);

  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);

      if (!await item.isVisible().catch(() => false)) {
        continue;
      }

      const time = extractTime(await locatorText(item));

      if (!time || seen.has(time)) {
        continue;
      }

      seen.add(time);
      slots.push({ time, minutes: timeToMinutes(time), locator: item });
    }
  }

  return slots.sort((left, right) => left.minutes - right.minutes);
};

const clickTimeSlot = async (page, slot) => {
  if (!await clickLocator(page, slot.locator)) {
    throw new Error(`Nao consegui clicar no horario ${slot.time}.`);
  }

  await waitForScreenSettle(page);
  await page.waitForTimeout(300);
};

const extractTime = (text) => {
  return text.match(/\b\d{1,2}:\d{2}\b/)?.[0];
};

const timeToMinutes = (time) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());

  if (!match) {
    throw new Error(`Horario invalido: ${time}. Use HH:mm, por exemplo 11:00.`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new Error(`Horario invalido: ${time}.`);
  }

  return hours * 60 + minutes;
};


const branchLocators = (page, branchName) => {
  const exact = new RegExp(escapeRegExp(branchName), 'i');

  return [
    page.getByText(exact),
    page.getByText(/imbari[eê]/i)
  ];
};

const professionalLocators = (page, professionalName) => {
  const exact = new RegExp(escapeRegExp(professionalName), 'i');

  return [
    page.getByText(exact),
    page.getByText(/wesl+ey\s+gomes/i),
    page.getByText(/wesl+ey/i)
  ];
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
