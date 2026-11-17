// Número do WhatsApp: país + DDD + número, somente dígitos.
const WHATSAPP_NUMBER = "5517992003979";

const root = document.documentElement;
const bookingForm = document.getElementById("bookingForm");
const nameInput = document.getElementById("customerName");
const serviceInput = document.getElementById("service");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const notesInput = document.getElementById("notes");
const formMessage = document.getElementById("formMessage");
const bookingSection = document.getElementById("agendamento");

const systemReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Movimento reduzido: preferência do sistema OU opção "Pausar animações" do menu de acessibilidade.
function motionReduced() {
  return systemReducedMotion || root.classList.contains("a11y-still");
}
function scrollBehavior() {
  return motionReduced() ? "auto" : "smooth";
}

// localStorage pode falhar (modo privado, cookies bloqueados): nesse caso nada é lembrado,
// mas o restante do site continua funcionando.
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (error) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (error) { /* sem armazenamento */ }
}

// Data local no formato AAAA-MM-DD (evita diferenças de fuso horário).
function toDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function getLocalDate() {
  return toDateValue(new Date());
}
dateInput.min = getLocalDate();

/* =========================================================
   Horário de funcionamento
   ========================================================= */

// Por dia da semana (0 = domingo ... 6 = sábado). null = fechado.
// Ao mudar aqui, atualize também a lista na seção #localizacao e o JSON-LD no <head>.
const OPENING_HOURS = {
  0: { open: "12:00", close: "17:00" },
  1: null,
  2: { open: "15:00", close: "21:00" },
  3: { open: "15:00", close: "21:00" },
  4: { open: "15:00", close: "21:00" },
  5: { open: "15:00", close: "21:00" },
  6: { open: "12:00", close: "21:00" }
};
const DAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
// "no sábado", "no domingo", "na terça-feira"...
function onDay(day) {
  return `${day === 0 || day === 6 ? "No" : "Na"} ${DAY_NAMES[day]}`;
}
const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOT_MINUTES = 30; // intervalo dos atalhos de horário
const timeHint = document.getElementById("timeHint");
const defaultTimeHint = timeHint ? timeHint.textContent : "";

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(total) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
// "15:00" -> "15h", "12:30" -> "12h30"
function formatHour(hhmm) {
  const [h, m] = hhmm.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}
// Dia da semana de uma data "AAAA-MM-DD" no fuso local.
function weekdayOf(dateValue) {
  const [y, m, d] = dateValue.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/* =========================================================
   Folgas e dias sem atendimento
   Duas fontes, somadas:
   - DAYS_OFF: lista fixa aqui no código;
   - DAYS_OFF_SHEET_URL: planilha do Google que o próprio Lúcião edita pelo celular
     (Arquivo > Compartilhar > Publicar na Web > formato CSV). Vazio = desligado.
   Colunas da planilha: A = dia (25/12/2026) · B = até (opcional, para férias) · C = aviso (opcional, aparece no site).
   Se a planilha falhar, o site segue funcionando só com o horário normal.
   ========================================================= */
const DAYS_OFF = [
  // { start: "2026-12-25", end: "2026-12-25", note: "Natal" },
];
const DAYS_OFF_SHEET_URL = "";

let closures = []; // [{ start: "AAAA-MM-DD", end: "AAAA-MM-DD", note: "" }]

// Aceita "25/12/2026", "25/12" (ano atual, ou o próximo se a data já passou) e "2026-12-25".
function parseSheetDate(text) {
  const value = String(text || "").trim();
  let y, m, d;
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [, y, m, d] = match.map(Number);
  } else {
    match = value.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2}|\d{4}))?$/);
    if (!match) return null;
    d = Number(match[1]);
    m = Number(match[2]);
    if (match[3]) {
      y = Number(match[3]);
      if (y < 100) y += 2000;
    } else {
      const today = new Date();
      y = today.getFullYear();
      if (new Date(y, m - 1, d, 23, 59) < today) y += 1;
    }
  }
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null; // 31/02 etc.
  return toDateValue(date);
}

// Leitor simples de CSV (aceita campos entre aspas e vírgulas dentro deles).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Linhas inválidas (cabeçalho, data digitada errado) são ignoradas em vez de quebrar o site.
function closuresFromRows(rows) {
  const list = [];
  rows.slice(0, 200).forEach(row => {
    const start = parseSheetDate(row[0]);
    if (!start) return;
    let end = parseSheetDate(row[1]) || start;
    if (end < start) end = start;
    list.push({ start, end, note: String(row[2] || "").trim().slice(0, 80) });
  });
  return list;
}

function closureOn(dateValue) {
  return closures.find(item => dateValue >= item.start && dateValue <= item.end) || null;
}
function shortDate(dateValue) {
  const [, m, d] = dateValue.split("-");
  return `${d}/${m}`;
}
function closureText(dateValue) {
  const item = closureOn(dateValue);
  const reason = item && item.note ? ` (${item.note})` : "";
  return `No dia ${shortDate(dateValue)} a barbearia não abre${reason}. Escolha outro dia.`;
}

// Aviso na seção de horários com as próximas folgas (até 45 dias à frente).
function renderClosureNotice() {
  const notice = document.getElementById("closureNotice");
  if (!notice) return;
  const today = getLocalDate();
  const limit = new Date();
  limit.setDate(limit.getDate() + 45);
  const upcoming = closures
    .filter(item => item.end >= today && item.start <= toDateValue(limit))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 3);
  if (!upcoming.length) {
    notice.hidden = true;
    return;
  }
  const title = document.createElement("strong");
  title.textContent = "Aviso: ";
  const parts = upcoming.map(item => {
    const when = item.start === item.end ? `em ${shortDate(item.start)}` : `de ${shortDate(item.start)} a ${shortDate(item.end)}`;
    return `sem atendimento ${when}${item.note ? ` (${item.note})` : ""}`;
  });
  notice.replaceChildren(title, `${parts.join("; ")}.`);
  notice.hidden = false;
}

function updateTimeHint() {
  if (!timeHint) return;
  if (!dateInput.value) {
    timeHint.textContent = defaultTimeHint;
    return;
  }
  if (closureOn(dateInput.value)) {
    timeHint.textContent = closureText(dateInput.value);
    return;
  }
  const day = weekdayOf(dateInput.value);
  const hours = OPENING_HOURS[day];
  timeHint.textContent = hours
    ? `${onDay(day)} atendemos das ${formatHour(hours.open)} às ${formatHour(hours.close)}.`
    : `${onDay(day)} a barbearia está fechada. Escolha outro dia.`;
}

// Próxima abertura a partir de agora: "abre hoje às 15h", "abre amanhã às 12h", "abre terça às 15h".
function nextOpeningText(now) {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 90; i++, cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    const hours = OPENING_HOURS[day];
    if (!hours || closureOn(toDateValue(cursor))) continue;
    if (i === 0 && minutesNow >= toMinutes(hours.open)) continue; // hoje já abriu (e já fechou)
    const when = i === 0 ? "hoje" : i === 1 ? "amanhã" : i < 7 ? DAY_NAMES[day].replace("-feira", "") : `dia ${shortDate(toDateValue(cursor))}`;
    return `abre ${when} às ${formatHour(hours.open)}`;
  }
  return "veja os horários";
}

// Destaca o dia de hoje na lista de horários e indica se está aberto agora.
function updateOpenStatus() {
  const now = new Date();
  const today = now.getDay();
  document.querySelectorAll("#hoursList li").forEach((item, index) => {
    item.style.setProperty("--n", index);
    item.classList.toggle("is-today", Number(item.dataset.day) === today);
  });

  const status = document.getElementById("openStatus");
  if (!status) return;
  const hours = OPENING_HOURS[today];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const isOpen = Boolean(hours) && !closureOn(toDateValue(now)) && minutesNow >= toMinutes(hours.open) && minutesNow < toMinutes(hours.close);
  status.textContent = isOpen
    ? `Aberto · fecha às ${formatHour(hours.close)}`
    : `Fechado · ${nextOpeningText(now)}`;
  status.classList.toggle("is-open", isOpen);
  status.hidden = false;
}
updateOpenStatus();
window.setInterval(updateOpenStatus, 60000);

/* =========================================================
   Atalhos de dia e horário no formulário (escolha com um toque)
   ========================================================= */
const dateChips = document.getElementById("dateChips");
const timeChips = document.getElementById("timeChips");

function makeChip(label, pressed, onClick, ariaLabel) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "pick-chip";
  chip.textContent = label;
  chip.setAttribute("aria-pressed", String(pressed));
  if (ariaLabel) chip.setAttribute("aria-label", ariaLabel);
  chip.addEventListener("click", onClick);
  return chip;
}

function chipLabel(text) {
  const span = document.createElement("span");
  span.className = "quick-pick-label";
  span.textContent = text;
  return span;
}

// Próximos 6 dias em que a barbearia abre (pula hoje se já passou do último horário).
function renderDateChips() {
  if (!dateChips) return;
  const chips = [chipLabel("Dia:")];
  const cursor = new Date();
  const todayValue = getLocalDate();
  for (let i = 0; chips.length < 7 && i < 14; i++) {
    const value = toDateValue(cursor);
    const day = cursor.getDay();
    const hours = OPENING_HOURS[day];
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const stillOpenToday = value !== todayValue || (hours && nowMinutes < toMinutes(hours.close) - SLOT_MINUTES);
    if (hours && stillOpenToday && !closureOn(value)) {
      const [, m, d] = value.split("-");
      const label = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : `${DAY_SHORT[day]} ${d}/${m}`;
      chips.push(makeChip(label, dateInput.value === value, () => {
        dateInput.value = value;
        dateInput.dispatchEvent(new Event("change", { bubbles: true }));
      }, `${label}, ${DAY_NAMES[day]} ${d}/${m}`));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  dateChips.replaceChildren(...chips);
  dateChips.hidden = false;
}

// Horários a cada 30 min dentro do funcionamento do dia escolhido (sem horários que já passaram).
function renderTimeChips() {
  if (!timeChips) return;
  const hours = dateInput.value && !closureOn(dateInput.value) ? OPENING_HOURS[weekdayOf(dateInput.value)] : null;
  if (!hours) {
    timeChips.hidden = true;
    timeChips.replaceChildren();
    return;
  }
  const isToday = dateInput.value === getLocalDate();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const chips = [chipLabel("Horário:")];
  for (let t = toMinutes(hours.open); t < toMinutes(hours.close); t += SLOT_MINUTES) {
    if (isToday && t <= nowMinutes) continue;
    const value = fromMinutes(t);
    chips.push(makeChip(formatHour(value), timeInput.value === value, () => {
      timeInput.value = value;
      timeInput.dispatchEvent(new Event("change", { bubbles: true }));
    }));
  }
  timeChips.replaceChildren(...chips);
  timeChips.hidden = chips.length === 1;
}

dateInput.addEventListener("change", () => {
  updateTimeHint();
  renderDateChips();
  renderTimeChips();
});
timeInput.addEventListener("change", renderTimeChips);
renderDateChips();

// Aplica as folgas em tudo que depende do horário (selo, aviso, atalhos e dica do formulário).
function applyClosures(list) {
  closures = list;
  updateOpenStatus();
  renderClosureNotice();
  renderDateChips();
  renderTimeChips();
  updateTimeHint();
}
applyClosures(closuresFromRows(DAYS_OFF.map(item => [item.start, item.end, item.note])));

if (DAYS_OFF_SHEET_URL && "fetch" in window) {
  const controller = "AbortController" in window ? new AbortController() : null;
  const timer = window.setTimeout(() => controller && controller.abort(), 6000);
  fetch(DAYS_OFF_SHEET_URL, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: controller ? controller.signal : undefined })
    .then(response => (response.ok ? response.text() : Promise.reject(new Error("planilha indisponível"))))
    .then(text => applyClosures(closures.concat(closuresFromRows(parseCsv(text)))))
    .catch(() => { /* sem planilha: vale só o horário normal */ })
    .finally(() => window.clearTimeout(timer));
}

// Resumo do pedido acima do botão: aparece quando serviço, dia e horário estão preenchidos.
const bookingSummary = document.getElementById("bookingSummary");
function updateBookingSummary() {
  if (!bookingSummary) return;
  if (!serviceInput.value || !dateInput.value || !timeInput.value) {
    bookingSummary.hidden = true;
    return;
  }
  const [, month, day] = dateInput.value.split("-");
  const label = document.createElement("small");
  label.textContent = "Seu pedido";
  bookingSummary.replaceChildren(
    label,
    `${serviceInput.value} · ${DAY_NAMES[weekdayOf(dateInput.value)]}, ${day}/${month} às ${formatHour(timeInput.value)}`
  );
  bookingSummary.hidden = false;
}

// Ao corrigir um campo, a mensagem de erro antiga some (não fica contradizendo o que foi escolhido).
function clearFormError() {
  bookingForm.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute("aria-invalid"));
  if (bookingForm.dataset.hasError) {
    formMessage.textContent = "";
    delete bookingForm.dataset.hasError;
  }
}
["input", "change"].forEach(type => bookingForm.addEventListener(type, () => {
  clearFormError();
  updateBookingSummary();
}));

/* =========================================================
   Menu de acessibilidade
   ========================================================= */
const A11Y_KEY = "luciaoA11y";
const FONT_SCALES = ["100%", "115%", "130%"];
const a11yToggle = document.getElementById("a11yToggle");
const a11yPanel = document.getElementById("a11yPanel");
const a11yTip = document.getElementById("a11yTip");
const readingGuide = document.getElementById("readingGuide");
const speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

const defaultA11y = { size: 0, contrast: false, readable: false, links: false, still: false, cursor: false, guide: false, speech: false, libras: false };
let a11y = { ...defaultA11y };

// Lê as preferências salvas (e migra a opção antiga de alto contraste).
try {
  const saved = JSON.parse(storageGet(A11Y_KEY) || "null");
  if (saved && typeof saved === "object") a11y = { ...defaultA11y, ...saved };
} catch (error) { /* preferências inválidas: usa o padrão */ }
if (storageGet("luciaoHighContrast") === "true") a11y.contrast = true;
a11y.libras = false; // o VLibras só carrega quando a pessoa pede

const A11Y_TIPS = {
  readable: "Fonte de leitura facilitada e mais espaço entre letras e linhas.",
  guide: "Uma faixa acompanha o mouse ou o dedo para ajudar a não se perder na linha.",
  speech: "Toque ou clique em qualquer texto da página para ouvi-lo.",
  libras: "Carregando o VLibras… o tradutor aparece no lado direito da tela.",
  still: "Animações e movimentos pausados."
};

let readableFontLoaded = false;
function loadReadableFont() {
  if (readableFontLoaded) return;
  readableFontLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
  document.head.appendChild(link);
}

// VLibras: tradutor oficial de Libras do governo federal, carregado só quando ativado.
let vlibrasLoaded = false;
function openVLibras() {
  if (window.VLibrasWidget && typeof window.VLibrasWidget.open === "function") {
    window.VLibrasWidget.open();
    return;
  }
  if (vlibrasLoaded) return;
  vlibrasLoaded = true;
  const script = document.createElement("script");
  script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
  script.onload = () => {
    try {
      new window.VLibras.Widget("https://vlibras.gov.br/app");
      // O widget monta o botão logo em seguida; então abrimos o tradutor.
      window.setTimeout(() => window.VLibrasWidget && window.VLibrasWidget.open && window.VLibrasWidget.open(), 300);
      showTip("O tradutor de Libras está no lado direito da tela. Selecione um texto para traduzir.");
    } catch (error) {
      showTip("Não foi possível abrir o VLibras agora. Tente novamente mais tarde.");
    }
  };
  script.onerror = () => {
    vlibrasLoaded = false;
    showTip("Não foi possível carregar o VLibras. Verifique sua conexão.");
  };
  document.body.appendChild(script);
}

function showTip(text) {
  if (a11yTip) a11yTip.textContent = text || "";
}

function applyA11y() {
  root.style.fontSize = FONT_SCALES[a11y.size] || "";
  root.classList.toggle("a11y-contrast", a11y.contrast);
  root.classList.toggle("a11y-readable", a11y.readable);
  root.classList.toggle("a11y-links", a11y.links);
  root.classList.toggle("a11y-still", a11y.still);
  root.classList.toggle("a11y-cursor", a11y.cursor);
  root.classList.toggle("a11y-guide", a11y.guide);
  root.classList.toggle("a11y-speech", a11y.speech && speechSupported);
  if (a11y.readable) loadReadableFont();
  if (!a11y.speech && speechSupported) window.speechSynthesis.cancel();

  document.querySelectorAll(".a11y-size button").forEach(button => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.size) === a11y.size));
  });
  document.querySelectorAll(".a11y-option").forEach(button => {
    button.setAttribute("aria-pressed", String(Boolean(a11y[button.dataset.option])));
  });
  if (a11y.still) revealAll();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = a11y.contrast ? "#000000" : "#1A1A1A";
}

function saveA11y() {
  const { libras, ...toSave } = a11y;
  storageSet(A11Y_KEY, JSON.stringify(toSave));
}

function openA11yPanel() {
  a11yPanel.hidden = false;
  a11yToggle.setAttribute("aria-expanded", "true");
  a11yToggle.setAttribute("aria-label", "Fechar menu de acessibilidade");
  const first = a11yPanel.querySelector("button");
  if (first) first.focus();
}
function closeA11yPanel(returnFocus = true) {
  if (a11yPanel.hidden) return;
  a11yPanel.hidden = true;
  a11yToggle.setAttribute("aria-expanded", "false");
  a11yToggle.setAttribute("aria-label", "Abrir menu de acessibilidade");
  if (returnFocus) a11yToggle.focus();
}

if (a11yToggle && a11yPanel) {
  if (speechSupported) {
    const speechButton = a11yPanel.querySelector('[data-option="speech"]');
    if (speechButton) speechButton.hidden = false;
  }

  a11yToggle.addEventListener("click", () => {
    if (a11yPanel.hidden) openA11yPanel();
    else closeA11yPanel();
  });
  document.getElementById("a11yClose").addEventListener("click", () => closeA11yPanel());

  a11yPanel.querySelectorAll(".a11y-size button").forEach(button => {
    button.addEventListener("click", () => {
      a11y.size = Number(button.dataset.size);
      applyA11y();
      saveA11y();
    });
  });

  a11yPanel.querySelectorAll(".a11y-option").forEach(button => {
    button.addEventListener("click", () => {
      const option = button.dataset.option;
      a11y[option] = !a11y[option];
      applyA11y();
      saveA11y();
      showTip(a11y[option] ? A11Y_TIPS[option] : "");
      if (option === "libras" && a11y.libras) openVLibras();
      if (option === "speech" && a11y.speech) speak("Leitura em voz alta ativada. Toque em um texto para ouvir.");
    });
  });

  document.getElementById("a11yReset").addEventListener("click", () => {
    a11y = { ...defaultA11y };
    applyA11y();
    saveA11y();
    showTip("Configurações restauradas.");
  });

  // Fecha com Esc ou clicando fora do painel.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeA11yPanel();
  });
  document.addEventListener("click", event => {
    if (!a11yPanel.hidden && !a11yPanel.contains(event.target) && !a11yToggle.contains(event.target)) {
      closeA11yPanel(false);
    }
  });
}

// Guia de leitura acompanha o ponteiro (mouse ou dedo).
window.addEventListener("pointermove", event => {
  if (!a11y.guide || !readingGuide) return;
  readingGuide.style.transform = `translateY(${event.clientY - 22}px)`;
}, { passive: true });

// Ler em voz alta: ao clicar em um texto, ele é lido com voz em português.
function speak(text) {
  if (!speechSupported || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("pt"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

document.addEventListener("click", event => {
  if (!a11y.speech || !speechSupported) return;
  if (event.target.closest(".a11y-panel, .a11y-toggle, input, select, textarea")) return;
  const target = event.target.closest("main p, main h1, main h2, main h3, main li, main address, main label, main .btn, main .text-action, .site-footer p");
  if (!target) return;
  const utterance = speak(target.innerText.replace(/[↗✦✂♛★✆]/g, "").trim());
  if (!utterance) return;
  document.querySelectorAll(".is-speaking").forEach(el => el.classList.remove("is-speaking"));
  target.classList.add("is-speaking");
  utterance.onend = () => target.classList.remove("is-speaking");
});

/* =========================================================
   Animações de entrada ao rolar a página
   ========================================================= */
const revealElements = document.querySelectorAll(".reveal, .section-heading");

function revealAll() {
  revealElements.forEach(element => element.classList.add("is-visible"));
}

applyA11y();

if ("IntersectionObserver" in window && !motionReduced()) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -35px 0px" });

  revealElements.forEach(element => observer.observe(element));
} else {
  revealAll();
}

/* =========================================================
   Efeitos ligados à rolagem: barra de progresso, menu compacto,
   link ativo no menu e aproximação suave das fotos.
   ========================================================= */
const heroPhoto = document.querySelector(".hero-photo");
const aboutPhoto = document.querySelector(".about-image-frame img");
const progressBar = document.getElementById("scrollProgress");
const siteNav = document.getElementById("siteNav");
const navLinks = [...document.querySelectorAll("#mainNav .nav-link")];
const navSections = navLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
let ticking = false;
let lastScrollY = window.scrollY;

function updateScrollEffects() {
  const scrollY = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

  // No celular, o botão de acessibilidade se recolhe ao rolar para baixo (o CSS só aplica abaixo de 768px).
  if (a11yToggle && Math.abs(scrollY - lastScrollY) > 6) {
    a11yToggle.classList.toggle("is-tucked", scrollY > lastScrollY && scrollY > 200 && scrollY < maxScroll - 40);
    lastScrollY = scrollY;
  }

  if (progressBar) progressBar.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, scrollY / maxScroll) : 0})`;
  if (siteNav) siteNav.classList.toggle("is-scrolled", scrollY > 30);

  // Link do menu correspondente à seção visível.
  let current = navSections[0];
  navSections.forEach(section => {
    if (section.getBoundingClientRect().top <= 120) current = section;
  });
  navLinks.forEach(link => {
    const active = current && link.getAttribute("href") === `#${current.id}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });

  if (motionReduced() || window.innerWidth < 768) {
    if (heroPhoto) heroPhoto.style.transform = "";
    if (aboutPhoto) aboutPhoto.style.transform = "";
  } else {
    if (heroPhoto) {
      const scale = Math.min(1.055, 1 + Math.max(0, scrollY) / 7000);
      heroPhoto.style.transform = `scale(${scale})`;
    }
    if (aboutPhoto) {
      const rect = aboutPhoto.getBoundingClientRect();
      const distance = Math.abs(rect.top - window.innerHeight * 0.5);
      const scale = Math.max(1, 1.035 - distance / 30000);
      aboutPhoto.style.transform = `scale(${scale})`;
    }
  }
  ticking = false;
}
window.addEventListener("scroll", () => {
  if (!ticking) {
    window.requestAnimationFrame(updateScrollEffects);
    ticking = true;
  }
}, { passive: true });
window.addEventListener("resize", updateScrollEffects);
updateScrollEffects();

// No celular, o menu fecha sozinho depois de escolher uma seção.
const mainNav = document.getElementById("mainNav");
navLinks.forEach(link => {
  link.addEventListener("click", () => {
    if (mainNav.classList.contains("show") && window.bootstrap) {
      window.bootstrap.Collapse.getOrCreateInstance(mainNav).hide();
    }
  });
});

// Brilho que segue o mouse nos cartões de serviço, com uma leve inclinação 3D (só com mouse).
document.querySelectorAll(".spotlight").forEach(card => {
  card.addEventListener("pointermove", event => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    card.style.setProperty("--mx", `${x}px`);
    card.style.setProperty("--my", `${y}px`);
    if (event.pointerType !== "mouse" || motionReduced()) return;
    card.style.setProperty("--ry", `${((x / rect.width) - 0.5) * 7}deg`);
    card.style.setProperty("--rx", `${(0.5 - (y / rect.height)) * 7}deg`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.removeProperty("--rx");
    card.style.removeProperty("--ry");
  });
});

/* =========================================================
   Serviços → formulário
   ========================================================= */
document.querySelectorAll(".choose-service").forEach(button => {
  button.addEventListener("click", () => {
    serviceInput.value = button.dataset.service;
    bookingSection.scrollIntoView({ behavior: scrollBehavior() });
    window.setTimeout(() => nameInput.focus({ preventScroll: true }), motionReduced() ? 0 : 500);
    clearFormError();
    updateBookingSummary();
    formMessage.textContent = `${button.dataset.service} selecionado. Agora escolha o dia e o horário.`;
  });
});

/* =========================================================
   Formulário → mensagem pronta no WhatsApp
   ========================================================= */
function fail(message, field) {
  formMessage.textContent = message;
  bookingForm.dataset.hasError = "true";
  field.setAttribute("aria-invalid", "true");
  field.focus();
  if (!motionReduced()) {
    field.classList.remove("field-shake");
    void field.offsetWidth; // reinicia a animação
    field.classList.add("field-shake");
  }
}

bookingForm.addEventListener("submit", event => {
  event.preventDefault();

  if (!bookingForm.checkValidity()) {
    bookingForm.reportValidity();
    return;
  }

  const customerName = nameInput.value.trim();
  if (customerName.length < 2) return fail("Digite seu nome (pelo menos 2 letras).", nameInput);
  if (dateInput.value < getLocalDate()) return fail("Escolha uma data igual ou posterior a hoje.", dateInput);

  const requestedDate = new Date(`${dateInput.value}T${timeInput.value}`);
  if (Number.isNaN(requestedDate.getTime())) return fail("Confira a data e o horário escolhidos.", dateInput);
  if (requestedDate <= new Date()) return fail("Escolha um horário futuro para hoje.", timeInput);

  if (closureOn(dateInput.value)) return fail(closureText(dateInput.value), dateInput);

  const weekday = weekdayOf(dateInput.value);
  const hours = OPENING_HOURS[weekday];
  if (!hours) return fail(`${onDay(weekday)} a barbearia está fechada. Escolha outro dia.`, dateInput);

  const requestedMinutes = toMinutes(timeInput.value);
  if (requestedMinutes < toMinutes(hours.open) || requestedMinutes >= toMinutes(hours.close)) {
    return fail(`${onDay(weekday)} atendemos das ${formatHour(hours.open)} às ${formatHour(hours.close)}. Escolha um horário dentro desse período.`, timeInput);
  }

  const [year, month, day] = dateInput.value.split("-");
  const formattedDate = `${day}/${month}/${year}`;
  const notes = notesInput.value.trim();

  const message = [
    "Olá, Lúcião! Gostaria de consultar um agendamento.",
    "",
    `*Nome:* ${customerName}`,
    `*Serviço:* ${serviceInput.value}`,
    `*Data preferida:* ${formattedDate} (${DAY_NAMES[weekday]})`,
    `*Horário preferido:* ${timeInput.value}`,
    notes ? `*Observações:* ${notes}` : null,
    "",
    "Pode confirmar se há disponibilidade? Obrigado!"
  ].filter(line => line !== null).join("\n");

  const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;

  // Alternativa caso o redirecionamento não aconteça (bloqueio do navegador, WhatsApp não instalado etc.).
  const fallbackLink = document.createElement("a");
  fallbackLink.href = url;
  fallbackLink.target = "_blank";
  fallbackLink.rel = "noopener noreferrer";
  fallbackLink.textContent = "toque aqui para abrir o WhatsApp";
  formMessage.replaceChildren(
    "Abrindo o WhatsApp. Revise a mensagem e toque em enviar. Se nada acontecer, ",
    fallbackLink,
    "."
  );

  window.location.href = url;
});

/* =========================================================
   Botão flutuante do WhatsApp
   Leva ao formulário (que monta a mensagem automática) e fica escondido
   enquanto o formulário já está na tela, para não cobri-lo.
   ========================================================= */
const whatsappFloat = document.getElementById("whatsappFloat");
const whatsappBubble = document.getElementById("whatsappBubble");
let bookingVisible = false;

if (whatsappFloat) {
  whatsappFloat.addEventListener("click", event => {
    event.preventDefault();
    if (whatsappBubble) whatsappBubble.classList.remove("is-shown");
    bookingSection.scrollIntoView({ behavior: scrollBehavior() });
    window.setTimeout(() => nameInput.focus({ preventScroll: true }), motionReduced() ? 0 : 500);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      entries.forEach(entry => {
        bookingVisible = entry.isIntersecting;
        whatsappFloat.classList.toggle("is-hidden", bookingVisible);
        if (bookingVisible) {
          whatsappFloat.setAttribute("tabindex", "-1");
          if (whatsappBubble) whatsappBubble.classList.remove("is-shown");
        } else {
          whatsappFloat.removeAttribute("tabindex");
        }
      });
    }, { threshold: 0.2 }).observe(bookingSection);
  }

  // Balão de convite: aparece uma vez, alguns segundos depois de abrir a página.
  if (whatsappBubble) {
    window.setTimeout(() => {
      if (bookingVisible || !a11yPanel.hidden) return;
      whatsappBubble.classList.add("is-shown");
      window.setTimeout(() => whatsappBubble.classList.remove("is-shown"), 6000);
    }, 5000);
  }
}

/* =========================================================
   Copiar endereço
   ========================================================= */
const copyAddress = document.getElementById("copyAddress");
const copyStatus = document.getElementById("copyStatus");
if (copyAddress) {
  copyAddress.addEventListener("click", async () => {
    const text = copyAddress.dataset.address;
    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = "Endereço copiado!";
    } catch (error) {
      copyStatus.textContent = text; // sem acesso à área de transferência: mostra para copiar manualmente
    }
    window.setTimeout(() => { copyStatus.textContent = ""; }, 4000);
  });
}

/* =========================================================
   Mapa sob demanda: o iframe do Google só é criado depois do clique,
   assim nenhum cookie do Google é colocado sem a pessoa pedir.
   ========================================================= */
const mapFrame = document.getElementById("mapFrame");
const loadMapButton = document.getElementById("loadMap");
if (mapFrame && loadMapButton) {
  loadMapButton.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    iframe.title = "Mapa de Palmeira d’Oeste, cidade da Lúcião Barbearia";
    iframe.src = mapFrame.dataset.mapSrc;
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allowFullscreen = true;
    mapFrame.replaceChildren(iframe);
    mapFrame.classList.add("is-loaded");
    iframe.focus();
  });
}

// Ano automático no rodapé.
document.getElementById("currentYear").textContent = new Date().getFullYear();
