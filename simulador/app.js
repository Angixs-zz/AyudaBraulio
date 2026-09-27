"use strict";

const DEPARTMENTS = [
  { key: "SISTEMAS", vlan: 110, segment: "172.32.110.0/24", ip: "200.1.2.3" },
  { key: "ELECTRONICA", label: "ELECTRÓNICA", vlan: 111, segment: "172.32.111.0/24", ip: "200.1.2.4" },
  { key: "CIVIL", vlan: 112, segment: "172.32.112.0/24", ip: "200.1.2.5" },
  { key: "ELECTRICA", label: "ELÉCTRICA", vlan: 113, segment: "172.32.113.0/24", ip: "200.1.2.6" },
  { key: "MECANICA", label: "MECÁNICA", vlan: 114, segment: "172.32.114.0/24", ip: "200.1.2.7" },
  { key: "QUIMICA", label: "QUÍMICA", vlan: 115, segment: "172.32.115.0/24", ip: "200.1.2.8" },
  { key: "INDUSTRIAL", vlan: 116, segment: "172.32.116.0/24", ip: "200.1.2.9" },
  { key: "GESTION", label: "GESTIÓN", vlan: 117, segment: "172.32.117.0/24", ip: "200.1.2.10" },
  { key: "ADMINISTRACION", label: "ADMINISTRACIÓN", vlan: 118, segment: "172.32.118.0/24", ip: "200.1.2.11" },
];

const COMMON_VLANS = [
  { id: 1, name: "NATIVA", segment: "200.1.2.0/24" },
  { id: 119, name: "CCTV", segment: "172.32.119.0/24" },
  { id: 120, name: "VOIP", segment: "10.168.120.0/24" },
  { id: 121, name: "INALAMBRICA", displayName: "INALÁMBRICA", segment: "172.32.121.0/24" },
];

const MASK_24 = "255.255.255.0";
const DEFAULT_GATEWAY = "200.1.2.1";

const refs = {
  terminalOutput: document.querySelector("#terminalOutput"),
  terminalForm: document.querySelector("#terminalForm"),
  commandInput: document.querySelector("#commandInput"),
  promptLabel: document.querySelector("#promptLabel"),
  feedbackCard: document.querySelector("#feedbackCard"),
  departmentSelect: document.querySelector("#departmentSelect"),
  practiceModeSelect: document.querySelector("#practiceModeSelect"),
  scenarioTitle: document.querySelector("#scenarioTitle"),
  managementIp: document.querySelector("#managementIp"),
  vlanTableBody: document.querySelector("#vlanTableBody"),
  currentObjective: document.querySelector("#currentObjective"),
  objectiveHelp: document.querySelector("#objectiveHelp"),
  checklist: document.querySelector("#checklist"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  modeBadge: document.querySelector("#modeBadge"),
  resultDialog: document.querySelector("#resultDialog"),
  resultTitle: document.querySelector("#resultTitle"),
  resultScore: document.querySelector("#resultScore"),
  resultSummary: document.querySelector("#resultSummary"),
  resultBreakdown: document.querySelector("#resultBreakdown"),
  installBtn: document.querySelector("#installBtn"),
};

let selectedDepartment = DEPARTMENTS.find((item) => item.key === "INDUSTRIAL") || DEPARTMENTS[0];
let practiceMode = "guided";
let commandHistory = [];
let historyIndex = 0;
let deferredInstallPrompt = null;
let cleanupMode = false;
let lastEvaluation = null;
let state = createInitialState();

function createInitialState() {
  const interfaces = {};
  for (let i = 1; i <= 24; i += 1) {
    interfaces[`fa0/${i}`] = {
      kind: "physical",
      switchportMode: null,
      accessVlan: 1,
      trunkNative: 1,
      trunkAllowed: "all",
      shutdown: false,
    };
  }
  interfaces["gi0/1"] = {
    kind: "physical",
    switchportMode: null,
    accessVlan: 1,
    trunkNative: 1,
    trunkAllowed: "all",
    shutdown: false,
  };
  interfaces["vlan1"] = {
    kind: "svi",
    ip: null,
    mask: null,
    shutdown: true,
  };

  return {
    mode: "user",
    hostname: "Switch",
    context: null,
    pending: null,
    enableSecret: null,
    servicePasswordEncryption: false,
    banner: null,
    lines: {
      console: { password: null, login: false },
      vty: { password: null, login: false, range: null },
    },
    vlans: new Map([[1, { id: 1, name: "default" }]]),
    interfaces,
    defaultGateway: null,
    saved: false,
    startupConfigExists: false,
    vlanDatabaseExists: true,
    modified: false,
    visited: {
      privileged: false,
      global: false,
    },
    cleanup: {
      erasedStartup: false,
      deletedVlanDat: false,
      reloaded: false,
      declinedSave: false,
      declinedDialog: false,
    },
  };
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .toUpperCase();
}

function currentPrompt() {
  const host = state.hostname || "Switch";
  if (state.pending) return state.pending.prompt || "";
  switch (state.mode) {
    case "privileged": return `${host}#`;
    case "global": return `${host}(config)#`;
    case "vlan": return `${host}(config-vlan)#`;
    case "interface": return `${host}(config-if)#`;
    case "line": return `${host}(config-line)#`;
    default: return `${host}>`;
  }
}

function updatePrompt() {
  refs.promptLabel.textContent = currentPrompt();
  refs.commandInput.placeholder = state.pending?.placeholder || "";
}

function appendTerminal(text = "", type = "") {
  const line = document.createElement("div");
  line.className = `terminal-line ${type}`.trim();
  line.textContent = text;
  refs.terminalOutput.appendChild(line);
  refs.terminalOutput.scrollTop = refs.terminalOutput.scrollHeight;
}

function echoCommand(command) {
  appendTerminal(`${currentPrompt()}${command}`, "command");
}

function setFeedback(kind, title, message) {
  refs.feedbackCard.className = `feedback-card ${kind}`;
  refs.feedbackCard.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = message;
  refs.feedbackCard.append(strong, span);
}

function invalidInput(command, explanation = "Comando no reconocido en este modo.") {
  const position = Math.max(0, Math.min(command.length - 1, command.search(/\S/) || 0));
  appendTerminal(" ".repeat(position + currentPrompt().length) + "^", "error");
  appendTerminal("% Invalid input detected at '^' marker.", "error");
  if (practiceMode !== "exam") setFeedback("error", "No válido.", explanation);
}

function requireMode(allowedModes, command) {
  if (!allowedModes.includes(state.mode)) {
    invalidInput(command, `Ese comando no corresponde al modo ${state.mode}. Revisa el prompt ${currentPrompt()}.`);
    return false;
  }
  return true;
}

function normalizeInterfaceName(raw) {
  if (!raw || typeof raw !== "string") return null;
  const value = raw.toLowerCase().replace(/\s+/g, "");
  let match = value.match(/^(?:fastethernet|fa|f)(\d+)\/(\d+)$/);
  if (match) return `fa${Number(match[1])}/${Number(match[2])}`;
  match = value.match(/^(?:gigabitethernet|gi|g)(\d+)\/(\d+)$/);
  if (match) return `gi${Number(match[1])}/${Number(match[2])}`;
  match = value.match(/^(?:vlan|vl|v)(\d+)$/);
  if (match) return `vlan${Number(match[1])}`;
  return null;
}

function parseInterfaceRange(raw) {
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const result = [];
  const seen = new Set();

  for (const part of parts) {
    const rangeMatch = part.match(/^(?:(fastethernet|gigabitethernet|fa|gi|f|g)\s*)?(\d+)\/\s*(\d+)\s*-\s*(?:(?:fastethernet|gigabitethernet|fa|gi|f|g)\s*)?(?:(\d+)\/)?(\d+)$/i);
    if (rangeMatch) {
      const prefix = (rangeMatch[1] || "fa").toLowerCase();
      const kind = prefix.startsWith("g") ? "gi" : "fa";
      const module = Number(rangeMatch[2]);
      const start = Number(rangeMatch[3]);
      const endModule = rangeMatch[4] !== undefined ? Number(rangeMatch[4]) : module;
      const end = Number(rangeMatch[5]);

      if (module !== 0 || endModule !== 0 || start < 1 || start > end) return null;
      const maxPort = (kind === "gi") ? 2 : 24;
      if (end > maxPort) return null;

      for (let i = start; i <= end; i += 1) {
        const name = `${kind}0/${i}`;
        if (!seen.has(name)) {
          seen.add(name);
          result.push(name);
        }
      }
      continue;
    }

    const norm = normalizeInterfaceName(part);
    if (norm) {
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(norm);
      }
      continue;
    }

    return null;
  }

  return result.length > 0 ? result : null;
}

function matchKeyword(token, keyword) {
  if (!token || !keyword) return false;
  const t = token.toLowerCase();
  const k = keyword.toLowerCase();

  if (k.startsWith(t)) return true;

  if (k === "default-gateway" && (t === "def-g" || t === "default-g" || t.startsWith("def"))) return true;
  if (k === "password-encryption" && (t === "pass" || t === "password" || t.startsWith("pass"))) return true;
  if (k === "running-config" && (t === "run" || t.startsWith("run"))) return true;
  if (k === "startup-config" && (t === "start" || t === "startup" || t.startsWith("start"))) return true;
  if (k === "fastethernet" && (t === "fa" || t === "f" || k.startsWith(t))) return true;
  if (k === "gigabitethernet" && (t === "gi" || t === "g" || k.startsWith(t))) return true;
  if (k === "vlan" && (t === "vl" || k.startsWith(t))) return true;
  if (k === "console" && (t === "con" || k.startsWith(t))) return true;
  if (k === "native" && (t === "nat" || k.startsWith(t))) return true;
  if (k === "allowed" && (t === "all" || k.startsWith(t))) return true;
  if (k === "access" && (t === "acc" || k.startsWith(t))) return true;
  if (k === "trunk" && (t === "tru" || t === "tr" || k.startsWith(t))) return true;
  if (k === "range" && (t === "rang" || t === "ra" || t === "r" || k.startsWith(t))) return true;
  if (k === "shutdown" && (t === "shut" || t === "sh" || k.startsWith(t))) return true;
  if (k === "disable" && (t === "dis" || k.startsWith(t))) return true;
  if (k === "delete" && (t === "del" || k.startsWith(t))) return true;
  if (k === "reload" && (t === "rel" || k.startsWith(t))) return true;
  if (k === "exit" && (t === "ex" || k.startsWith(t))) return true;
  if (k === "enable" && (t === "en" || t === "ena" || k.startsWith(t))) return true;
  if (k === "configure" && (t === "conf" || t === "config" || k.startsWith(t))) return true;
  if (k === "terminal" && (t === "t" || t === "ter" || t === "term" || k.startsWith(t))) return true;
  if (k === "hostname" && (t === "host" || k.startsWith(t))) return true;
  if (k === "secret" && (t === "sec" || k.startsWith(t))) return true;
  if (k === "line" && (t === "lin" || k.startsWith(t))) return true;
  if (k === "password" && (t === "pass" || k.startsWith(t))) return true;
  if (k === "login" && (t === "logi" || k.startsWith(t))) return true;
  if (k === "service" && (t === "serv" || k.startsWith(t))) return true;
  if (k === "banner" && (t === "ban" || k.startsWith(t))) return true;
  if (k === "name" && (t === "nam" || k.startsWith(t))) return true;
  if (k === "address" && (t === "add" || t === "addr" || k.startsWith(t))) return true;

  return false;
}

function canonicalizeCommand(rawCommand, currentMode) {
  if (!rawCommand || typeof rawCommand !== "string") {
    return { canonical: "", status: "empty" };
  }
  const clean = rawCommand.trim().replace(/\s+/g, " ");
  if (!clean) {
    return { canonical: "", status: "empty" };
  }

  const mode = currentMode || "user";

  if (/^do\s+/i.test(clean) && ["global", "vlan", "interface", "line"].includes(mode)) {
    const subRaw = clean.replace(/^do\s+/i, "");
    const subRes = canonicalizeCommand(subRaw, "privileged");
    if (subRes.status === "ok") {
      return { canonical: "do " + subRes.canonical, status: "ok" };
    }
    if (subRes.status === "ambiguous") {
      return { canonical: clean, status: "ambiguous" };
    }
  }

  const inputTokens = clean.split(" ");
  const candidates = [];

  function addCandidate(allowedModes, keywords, type, argsCount, format) {
    if (allowedModes.includes(mode)) {
      candidates.push({ keywords, type, argsCount: argsCount || 0, format });
    }
  }

  addCandidate(["user", "privileged", "global", "vlan", "interface", "line"], ["exit"], "fixed", 0, () => "exit");
  addCandidate(["global", "vlan", "interface", "line"], ["end"], "fixed", 0, () => "end");

  addCandidate(["user"], ["enable"], "fixed", 0, () => "enable");

  addCandidate(["privileged"], ["disable"], "fixed", 0, () => "disable");
  addCandidate(["privileged"], ["configure", "terminal"], "fixed", 0, () => "configure terminal");
  addCandidate(["privileged"], ["show", "vlan", "brief"], "fixed", 0, () => "show vlan brief");
  addCandidate(["privileged"], ["show", "interfaces", "trunk"], "fixed", 0, () => "show interfaces trunk");
  addCandidate(["privileged"], ["show", "running-config"], "fixed", 0, () => "show running-config");
  addCandidate(["privileged"], ["write", "memory"], "fixed", 0, () => "write memory");
  addCandidate(["privileged"], ["write"], "fixed", 0, () => "write memory");
  addCandidate(["privileged"], ["copy", "running-config", "startup-config"], "fixed", 0, () => "write memory");
  addCandidate(["privileged"], ["erase", "startup-config"], "fixed", 0, () => "erase startup-config");
  addCandidate(["privileged"], ["write", "erase"], "fixed", 0, () => "erase startup-config");
  addCandidate(["privileged"], ["erase", "nvram:"], "fixed", 0, () => "erase startup-config");
  addCandidate(["privileged"], ["delete"], "rest", 0, (kw, rest) => `delete ${rest}`);
  addCandidate(["privileged"], ["reload"], "fixed", 0, () => "reload");

  addCandidate(["global", "vlan", "interface", "line"], ["show", "vlan", "brief"], "fixed", 0, () => "show vlan brief");
  addCandidate(["global", "vlan", "interface", "line"], ["show", "interfaces", "trunk"], "fixed", 0, () => "show interfaces trunk");
  addCandidate(["global", "vlan", "interface", "line"], ["show", "running-config"], "fixed", 0, () => "show running-config");

  addCandidate(["global"], ["hostname"], "args", 1, (kw, args) => `hostname ${args[0]}`);
  addCandidate(["global"], ["enable", "secret"], "args", 1, (kw, args) => `enable secret ${args[0]}`);
  addCandidate(["global"], ["line", "console"], "args", 1, (kw, args) => `line console ${args[0]}`);
  addCandidate(["global"], ["line", "vty"], "args", 2, (kw, args) => `line vty ${args[0]} ${args[1]}`);
  addCandidate(["global"], ["service", "password-encryption"], "fixed", 0, () => "service password-encryption");
  addCandidate(["global"], ["banner", "motd"], "rest", 0, (kw, rest) => `banner motd ${rest}`);
  addCandidate(["global"], ["vlan"], "args", 1, (kw, args) => `vlan ${args[0]}`);
  addCandidate(["global"], ["no", "vlan"], "args", 1, (kw, args) => `no vlan ${args[0]}`);
  addCandidate(["global"], ["interface", "range"], "rest", 0, (kw, rest) => `interface range ${rest}`);
  addCandidate(["global"], ["interface"], "rest", 0, (kw, rest) => `interface ${rest}`);
  addCandidate(["global"], ["ip", "default-gateway"], "args", 1, (kw, args) => `ip default-gateway ${args[0]}`);

  addCandidate(["vlan"], ["name"], "args", 1, (kw, args) => `name ${args[0]}`);

  addCandidate(["interface"], ["switchport", "mode", "access"], "fixed", 0, () => "switchport mode access");
  addCandidate(["interface"], ["switchport", "mode", "trunk"], "fixed", 0, () => "switchport mode trunk");
  addCandidate(["interface"], ["switchport", "access", "vlan"], "args", 1, (kw, args) => `switchport access vlan ${args[0]}`);
  addCandidate(["interface"], ["switchport", "trunk", "native", "vlan"], "args", 1, (kw, args) => `switchport trunk native vlan ${args[0]}`);
  addCandidate(["interface"], ["switchport", "trunk", "allowed", "vlan"], "args", 1, (kw, args) => `switchport trunk allowed vlan ${args[0]}`);
  addCandidate(["interface"], ["no", "shutdown"], "fixed", 0, () => "no shutdown");
  addCandidate(["interface"], ["shutdown"], "fixed", 0, () => "shutdown");
  addCandidate(["interface"], ["ip", "address"], "args", 2, (kw, args) => `ip address ${args[0]} ${args[1]}`);

  addCandidate(["line"], ["password"], "args", 1, (kw, args) => `password ${args[0]}`);
  addCandidate(["line"], ["login"], "fixed", 0, () => "login");

  const matches = [];

  for (const cand of candidates) {
    const numKw = cand.keywords.length;
    if (inputTokens.length < numKw) continue;

    let kwMatch = true;
    for (let i = 0; i < numKw; i++) {
      if (!matchKeyword(inputTokens[i], cand.keywords[i])) {
        kwMatch = false;
        break;
      }
    }
    if (!kwMatch) continue;

    const remainingTokens = inputTokens.slice(numKw);

    if (cand.type === "fixed") {
      if (remainingTokens.length === 0) {
        matches.push(cand.format());
      }
    } else if (cand.type === "args") {
      if (remainingTokens.length === cand.argsCount) {
        matches.push(cand.format(cand.keywords, remainingTokens));
      }
    } else if (cand.type === "rest") {
      if (remainingTokens.length > 0) {
        if (cand.keywords.length === 1 && cand.keywords[0] === "interface") {
          const firstRest = remainingTokens[0].toLowerCase();
          if (matchKeyword(firstRest, "range")) {
            continue;
          }
        }
        matches.push(cand.format(cand.keywords, remainingTokens.join(" ")));
      }
    }
  }

  const uniqueMatches = [...new Set(matches)];

  if (uniqueMatches.length === 1) {
    return { canonical: uniqueMatches[0], status: "ok" };
  }
  if (uniqueMatches.length > 1) {
    return { canonical: clean, status: "ambiguous" };
  }

  return { canonical: clean, status: "unknown" };
}

function activeInterfaces() {
  if (state.mode !== "interface" || !state.context) return [];
  return state.context.interfaces || [];
}

function markModified() {
  state.modified = true;
  state.saved = false;
}

function expectedVlans() {
  return [
    { id: 1, name: "NATIVA" },
    { id: selectedDepartment.vlan, name: selectedDepartment.key },
    { id: 119, name: "CCTV" },
    { id: 120, name: "VOIP" },
    { id: 121, name: "INALAMBRICA" },
  ];
}

function requiredAllowedVlans() {
  return new Set(expectedVlans().map((vlan) => vlan.id));
}

function commandHelpForObjective(key) {
  const examples = {
    privileged: "El prompt debe cambiar de > a #.",
    global: "Desde el modo privilegiado entra a la configuración global.",
    hostname: `El nombre esperado es ${selectedDepartment.key}.`,
    enableSecret: "Configura una contraseña cifrada para el modo privilegiado.",
    console: "Entra a line console 0; configura password y login.",
    vty: "Entra a line vty 0 15; configura password y login.",
    encryption: "Activa el cifrado de las contraseñas de línea.",
    banner: "Configura un banner MOTD usando un delimitador, por ejemplo #texto#.",
    vlans: `Crea y nombra VLAN 1, ${selectedDepartment.vlan}, 119, 120 y 121.`,
    access: "Asigna los rangos Fa0/1-16, 17-20, 21-22, Fa0/23 y Fa0/24.",
    trunk: `Configura Gi0/1 y permite 1,${selectedDepartment.vlan},119,120,121.`,
    management: `La SVI VLAN 1 debe usar ${selectedDepartment.ip} ${MASK_24}.`,
    gateway: `Configura ${DEFAULT_GATEWAY} como gateway predeterminado.`,
    saved: "Guarda la running-config en startup-config.",
  };
  return examples[key] || "Continúa con el ejercicio.";
}

function buildRequirements() {
  if (cleanupMode) {
    return [
      { key: "erase", label: "Borrar startup-config", done: () => state.cleanup.erasedStartup },
      { key: "vlandat", label: "Eliminar flash:vlan.dat", done: () => state.cleanup.deletedVlanDat },
      { key: "reload", label: "Ejecutar reload", done: () => state.cleanup.reloaded },
      { key: "nosave", label: "Responder no al guardado", done: () => state.cleanup.declinedSave },
      { key: "nodialog", label: "Responder no al diálogo inicial", done: () => state.cleanup.declinedDialog },
    ];
  }

  return [
    { key: "privileged", label: "Entrar al modo privilegiado", done: () => state.visited.privileged },
    { key: "global", label: "Entrar a configuración global", done: () => state.visited.global },
    { key: "hostname", label: `Hostname ${selectedDepartment.key}`, done: () => normalizeText(state.hostname) === normalizeText(selectedDepartment.key) },
    { key: "enableSecret", label: "Configurar enable secret", done: () => Boolean(state.enableSecret) },
    { key: "console", label: "Proteger línea de consola", done: () => Boolean(state.lines.console.password && state.lines.console.login) },
    { key: "vty", label: "Proteger líneas VTY 0 15", done: () => Boolean(state.lines.vty.password && state.lines.vty.login && state.lines.vty.range === "0 15") },
    { key: "encryption", label: "Cifrar contraseñas de línea", done: () => state.servicePasswordEncryption },
    { key: "banner", label: "Configurar banner MOTD", done: () => Boolean(state.banner) },
    { key: "vlans", label: "Crear y nombrar las 5 VLAN", done: checkVlans },
    { key: "access", label: "Asignar todos los puertos access", done: checkAccessPorts },
    { key: "trunk", label: "Configurar Gi0/1 como trunk", done: checkTrunk },
    { key: "management", label: "Asignar IP a interface VLAN 1", done: checkManagementIp },
    { key: "gateway", label: "Configurar default gateway", done: () => state.defaultGateway === DEFAULT_GATEWAY },
    { key: "saved", label: "Guardar la configuración", done: () => state.saved },
  ];
}

function checkVlans() {
  return expectedVlans().every((expected) => {
    const actual = state.vlans.get(expected.id);
    return actual && normalizeText(actual.name) === normalizeText(expected.name);
  });
}

function checkRange(start, end, vlan) {
  for (let i = start; i <= end; i += 1) {
    const port = state.interfaces[`fa0/${i}`];
    if (!port || port.switchportMode !== "access" || port.accessVlan !== vlan) return false;
  }
  return true;
}

function checkAccessPorts() {
  return checkRange(1, 16, selectedDepartment.vlan)
    && checkRange(17, 20, 121)
    && checkRange(21, 22, 120)
    && checkRange(23, 23, 119)
    && checkRange(24, 24, 1);
}

function checkTrunk() {
  const trunk = state.interfaces["gi0/1"];
  if (!trunk || trunk.switchportMode !== "trunk" || trunk.trunkNative !== 1) return false;
  if (trunk.trunkAllowed === "all") return false;
  const actual = new Set(trunk.trunkAllowed);
  const expected = requiredAllowedVlans();
  return actual.size === expected.size && [...expected].every((id) => actual.has(id));
}

function checkManagementIp() {
  const svi = state.interfaces.vlan1;
  return svi.ip === selectedDepartment.ip && svi.mask === MASK_24 && svi.shutdown === false;
}

function updateProgress() {
  const requirements = buildRequirements();
  const completed = requirements.filter((item) => item.done()).length;
  const percent = Math.round((completed / requirements.length) * 100);
  refs.progressPercent.textContent = `${percent}%`;
  refs.progressBar.style.width = `${percent}%`;
  refs.checklist.innerHTML = "";

  requirements.forEach((item) => {
    const li = document.createElement("li");
    const done = item.done();
    li.className = done ? "done" : "";
    li.textContent = item.label;
    refs.checklist.appendChild(li);
  });

  const next = requirements.find((item) => !item.done());
  if (!next) {
    refs.currentObjective.textContent = cleanupMode ? "Switch limpio" : "Configuración terminada";
    refs.objectiveHelp.textContent = cleanupMode ? "Completaste correctamente la limpieza." : "Evalúa tu resultado o practica la limpieza final.";
  } else if (practiceMode === "exam") {
    refs.currentObjective.textContent = "Modo examen";
    refs.objectiveHelp.textContent = "No se muestran pistas durante el intento.";
  } else if (practiceMode === "free") {
    refs.currentObjective.textContent = "Laboratorio libre";
    refs.objectiveHelp.textContent = "Prueba comandos y consulta el estado del switch.";
  } else {
    refs.currentObjective.textContent = next.label;
    refs.objectiveHelp.textContent = commandHelpForObjective(next.key);
  }

  if (cleanupMode && completed === requirements.length) {
    lastEvaluation = { score: 100, completed, total: requirements.length };
  }
}

function renderScenario() {
  refs.scenarioTitle.textContent = selectedDepartment.label || selectedDepartment.key;
  refs.managementIp.textContent = `${selectedDepartment.ip}/24`;
  refs.departmentSelect.value = selectedDepartment.key;
  refs.practiceModeSelect.value = practiceMode;
  refs.modeBadge.textContent = cleanupMode ? "LIMPIEZA" : practiceMode.toUpperCase();

  const rows = [
    COMMON_VLANS[0],
    { id: selectedDepartment.vlan, name: selectedDepartment.key, displayName: selectedDepartment.label, segment: selectedDepartment.segment },
    COMMON_VLANS[1],
    COMMON_VLANS[2],
    COMMON_VLANS[3],
  ];
  refs.vlanTableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.id}</td><td>${row.displayName || row.name}</td><td>${row.segment}</td>`;
    refs.vlanTableBody.appendChild(tr);
  });
  updateProgress();
}

function resetSession({ preserveScenario = true, bootMessage = true } = {}) {
  state = createInitialState();
  cleanupMode = false;
  commandHistory = [];
  historyIndex = 0;
  refs.terminalOutput.innerHTML = "";
  if (bootMessage) printBootMessage();
  if (!preserveScenario) {
    selectedDepartment = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
  }
  renderScenario();
  updatePrompt();
  refs.commandInput.focus();
  setFeedback("info", "Sesión reiniciada.", "El switch está listo para un nuevo intento.");
}

function printBootMessage() {
  appendTerminal("Cisco IOS Software, C2960 Software (simulado)", "system");
  appendTerminal("Press RETURN to get started!", "system");
  appendTerminal("");
}

function startCleanupPractice() {
  state = createInitialState();
  state.mode = "privileged";
  state.hostname = selectedDepartment.key;
  state.startupConfigExists = true;
  state.vlanDatabaseExists = true;
  state.modified = true;
  state.saved = true;
  state.vlans.set(selectedDepartment.vlan, { id: selectedDepartment.vlan, name: selectedDepartment.key });
  cleanupMode = true;
  refs.terminalOutput.innerHTML = "";
  appendTerminal("Switch preparado con una configuración anterior.", "warning");
  appendTerminal("Tu tarea es dejarlo limpio para el siguiente compañero.", "system");
  setFeedback("info", "Práctica de limpieza.", "Empieza borrando la configuración de inicio.");
  renderScenario();
  updatePrompt();
  refs.commandInput.focus();
}

function evaluate() {
  const requirements = buildRequirements();
  const rows = requirements.map((item) => ({ label: item.label, ok: item.done() }));
  const completed = rows.filter((item) => item.ok).length;
  const score = Math.round((completed / rows.length) * 100);
  lastEvaluation = { score, completed, total: rows.length };

  refs.resultTitle.textContent = cleanupMode ? "Limpieza del switch" : `${selectedDepartment.label || selectedDepartment.key}`;
  refs.resultScore.textContent = `${score}%`;
  refs.resultSummary.textContent = score === 100
    ? "Completaste todos los requisitos del ejercicio."
    : `Completaste ${completed} de ${rows.length} requisitos. Revisa lo pendiente y vuelve a intentarlo.`;
  refs.resultBreakdown.innerHTML = "";
  rows.forEach((row) => {
    const div = document.createElement("div");
    div.className = `result-item ${row.ok ? "ok" : "bad"}`;
    div.innerHTML = `<span>${row.label}</span><span>${row.ok ? "Correcto" : "Pendiente"}</span>`;
    refs.resultBreakdown.appendChild(div);
  });
  refs.resultDialog.showModal();
}

function showHint() {
  if (practiceMode === "exam") {
    setFeedback("warning", "Modo examen.", "Primero evalúa tu intento para ver qué te falta.");
    return;
  }
  const next = buildRequirements().find((item) => !item.done());
  if (!next) {
    setFeedback("success", "Todo completo.", "Puedes evaluar o iniciar otro ejercicio.");
    return;
  }

  let hintText = "";
  if (next.key === "access") {
    if (!checkRange(1, 16, selectedDepartment.vlan)) {
      hintText = `interface range fa0/1-16 → switchport mode access → switchport access vlan ${selectedDepartment.vlan}`;
    } else if (!checkRange(17, 20, 121)) {
      hintText = "interface range fa0/17-20 → switchport mode access → switchport access vlan 121";
    } else if (!checkRange(21, 22, 120)) {
      hintText = "interface range fa0/21-22 → switchport mode access → switchport access vlan 120";
    } else if (!checkRange(23, 23, 119)) {
      hintText = "Fa0/23:\ninterface fa0/23 → switchport mode access → switchport access vlan 119";
    } else if (!checkRange(24, 24, 1)) {
      hintText = "Fa0/24:\ninterface fa0/24 → switchport mode access → switchport access vlan 1";
    }
  } else {
    const hints = {
      privileged: "enable",
      global: "configure terminal",
      hostname: `hostname ${selectedDepartment.key}`,
      enableSecret: "enable secret 12345",
      console: "line console 0 → password 12345 → login",
      vty: "line vty 0 15 → password 12345 → login",
      encryption: "service password-encryption",
      banner: "banner motd #Personal autorizado#",
      vlans: `vlan ${selectedDepartment.vlan} → name ${selectedDepartment.key}`,
      trunk: `interface gi0/1 → switchport mode trunk → switchport trunk native vlan 1 → switchport trunk allowed vlan 1,${selectedDepartment.vlan},119,120,121`,
      management: `interface vlan 1 → ip address ${selectedDepartment.ip} ${MASK_24} → no shutdown`,
      gateway: `ip default-gateway ${DEFAULT_GATEWAY}`,
      saved: "write memory",
      erase: "erase startup-config",
      vlandat: "delete flash:vlan.dat",
      reload: "reload",
      nosave: "Responde no cuando pregunte si deseas guardar.",
      nodialog: "Después del reinicio responde no al initial configuration dialog.",
    };
    hintText = hints[next.key] || commandHelpForObjective(next.key);
  }
  setFeedback("info", "Pista.", hintText);
}

function handlePending(raw) {
  const input = raw.trim().toLowerCase();
  const pending = state.pending;
  if (!pending) return false;

  if (pending.type === "eraseConfirm") {
    if (input === "" || input === "confirm" || input === "yes" || input === "y") {
      state.startupConfigExists = false;
      state.cleanup.erasedStartup = true;
      appendTerminal("Erase of nvram: complete", "system");
      state.pending = null;
      setFeedback("success", "Startup-config borrada.", "Ahora elimina la base de datos de VLAN.");
    } else {
      appendTerminal("% Erase cancelled.", "warning");
      state.pending = null;
    }
    return true;
  }

  if (pending.type === "deleteFilename") {
    if (input === "" || input === "vlan.dat" || input === "flash:vlan.dat") {
      appendTerminal("Delete flash:/vlan.dat? [confirm]", "warning");
      state.pending = { type: "deleteConfirm", prompt: "", placeholder: "Enter para confirmar" };
    } else {
      appendTerminal(`%Error deleting flash:/${raw} (No such file or directory)`, "error");
      state.pending = null;
    }
    return true;
  }

  if (pending.type === "deleteConfirm") {
    if (input === "" || input === "confirm" || input === "yes" || input === "y") {
      state.vlanDatabaseExists = false;
      state.cleanup.deletedVlanDat = true;
      appendTerminal("Delete of flash:/vlan.dat complete", "system");
      state.pending = null;
      setFeedback("success", "vlan.dat eliminado.", "Continúa con reload.");
    } else {
      appendTerminal("% Delete cancelled.", "warning");
      state.pending = null;
    }
    return true;
  }

  if (pending.type === "reloadSave") {
    if (input === "no" || input === "n") {
      state.cleanup.declinedSave = true;
      appendTerminal("Proceed with reload? [confirm]", "warning");
      state.pending = { type: "reloadConfirm", prompt: "", placeholder: "Enter para confirmar" };
    } else if (input === "yes" || input === "y") {
      state.saved = true;
      state.startupConfigExists = true;
      appendTerminal("Building configuration...", "system");
      appendTerminal("[OK]", "system");
      appendTerminal("Proceed with reload? [confirm]", "warning");
      state.pending = { type: "reloadConfirm", prompt: "", placeholder: "Enter para confirmar" };
    } else {
      appendTerminal("Please answer 'yes' or 'no'.", "warning");
    }
    return true;
  }

  if (pending.type === "reloadConfirm") {
    if (input === "" || input === "confirm" || input === "yes" || input === "y") {
      state.cleanup.reloaded = true;
      appendTerminal("Reload requested by console.", "system");
      appendTerminal("System Bootstrap, Version 12.2 (simulado)", "system");
      appendTerminal("Would you like to enter the initial configuration dialog? [yes/no]:", "warning");
      state.pending = { type: "initialDialog", prompt: "", placeholder: "yes/no" };
    } else {
      appendTerminal("% Reload cancelled.", "warning");
      state.pending = null;
    }
    return true;
  }

  if (pending.type === "initialDialog") {
    if (input === "no" || input === "n") {
      state.cleanup.declinedDialog = true;
      appendTerminal("Press RETURN to get started!", "system");
      appendTerminal("");
      state.pending = null;
      state.mode = "user";
      state.hostname = "Switch";
      state.enableSecret = null;
      state.vlans = new Map([[1, { id: 1, name: "default" }]]);
      setFeedback("success", "Limpieza terminada.", "El switch quedó listo para el siguiente compañero.");
    } else if (input === "yes" || input === "y") {
      appendTerminal("--- System Configuration Dialog ---", "system");
      appendTerminal("% En esta práctica se esperaba responder no.", "warning");
      state.pending = null;
      setFeedback("warning", "Respuesta incorrecta.", "Para dejarlo limpio sin asistente debes responder no.");
    } else {
      appendTerminal("Please answer 'yes' or 'no'.", "warning");
    }
    return true;
  }

  return false;
}

function runCommand(rawCommand) {
  const raw = rawCommand.replace(/\s+$/g, "");
  if (state.pending) {
    echoCommand(raw);
    handlePending(raw);
    updatePrompt();
    updateProgress();
    return;
  }

  const command = raw.trim();
  if (!command) {
    appendTerminal(currentPrompt(), "command");
    return;
  }

  echoCommand(command);

  const canonRes = canonicalizeCommand(command, state.mode);
  if (canonRes.status === "ambiguous") {
    invalidInput(command, `% Comando ambiguo en este modo: "${command}".`);
    return finishCommand();
  }

  const canonical = canonRes.canonical || command;
  let match;

  if (canonical === "enable") {
    if (!requireMode(["user"], command)) return finishCommand();
    state.mode = "privileged";
    state.visited.privileged = true;
    setFeedback("success", "Modo privilegiado.", "El prompt cambió a #.");
    return finishCommand();
  }

  if (canonical === "disable") {
    if (!requireMode(["privileged"], command)) return finishCommand();
    state.mode = "user";
    return finishCommand();
  }

  if (canonical === "configure terminal") {
    if (!requireMode(["privileged"], command)) return finishCommand();
    state.mode = "global";
    state.visited.global = true;
    appendTerminal("Enter configuration commands, one per line. End with CNTL/Z.", "system");
    setFeedback("success", "Configuración global.", "Ya puedes configurar el switch.");
    return finishCommand();
  }

  if (canonical === "exit") {
    if (state.mode === "vlan" || state.mode === "interface" || state.mode === "line") {
      state.mode = "global";
      state.context = null;
    } else if (state.mode === "global") {
      state.mode = "privileged";
    } else if (state.mode === "privileged") {
      state.mode = "user";
    }
    return finishCommand();
  }

  if (canonical === "end") {
    if (!["global", "vlan", "interface", "line"].includes(state.mode)) {
      invalidInput(command, "end se usa desde un modo de configuración.");
      return finishCommand();
    }
    state.mode = "privileged";
    state.context = null;
    return finishCommand();
  }

  match = canonical.match(/^hostname\s+([A-Za-z0-9_-]+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    state.hostname = match[1].toUpperCase();
    markModified();
    const correct = normalizeText(state.hostname) === normalizeText(selectedDepartment.key);
    setFeedback(correct ? "success" : "warning", correct ? "Hostname correcto." : "Hostname aplicado.", correct ? "Coincide con el departamento." : `El examen espera ${selectedDepartment.key}.`);
    return finishCommand();
  }

  match = canonical.match(/^enable\s+secret\s+(.+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    state.enableSecret = match[1];
    markModified();
    setFeedback("success", "Enable secret configurado.", "La contraseña privilegiada quedó registrada.");
    return finishCommand();
  }

  match = canonical.match(/^line\s+console\s+(\d+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    state.mode = "line";
    state.context = { line: "console" };
    return finishCommand();
  }

  match = canonical.match(/^line\s+vty\s+(\d+)\s+(\d+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    state.mode = "line";
    state.context = { line: "vty" };
    state.lines.vty.range = `${Number(match[1])} ${Number(match[2])}`;
    markModified();
    return finishCommand();
  }

  match = canonical.match(/^password\s+(.+)$/i);
  if (match) {
    if (!requireMode(["line"], command)) return finishCommand();
    const line = state.context?.line;
    if (!line) return finishCommand(invalidInput(command));
    state.lines[line].password = match[1];
    markModified();
    return finishCommand();
  }

  if (canonical === "login") {
    if (!requireMode(["line"], command)) return finishCommand();
    const line = state.context?.line;
    if (!line) return finishCommand(invalidInput(command));
    state.lines[line].login = true;
    markModified();
    setFeedback("success", "Login activado.", `La línea ${line} exigirá contraseña.`);
    return finishCommand();
  }

  if (canonical === "service password-encryption") {
    if (!requireMode(["global"], command)) return finishCommand();
    state.servicePasswordEncryption = true;
    markModified();
    setFeedback("success", "Cifrado activado.", "Las contraseñas de línea no se mostrarán en texto claro.");
    return finishCommand();
  }

  match = canonical.match(/^banner\s+motd\s+(.)([\s\S]*)\1$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    state.banner = match[2];
    markModified();
    setFeedback("success", "Banner configurado.", "El mensaje MOTD quedó guardado.");
    return finishCommand();
  }

  match = canonical.match(/^vlan\s+(\d+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    const id = Number(match[1]);
    if (id < 1 || id > 4094) {
      appendTerminal("% Invalid VLAN id", "error");
      return finishCommand();
    }
    if (!state.vlans.has(id)) state.vlans.set(id, { id, name: `VLAN${String(id).padStart(4, "0")}` });
    state.mode = "vlan";
    state.context = { vlanId: id };
    markModified();
    return finishCommand();
  }

  match = canonical.match(/^name\s+(.+)$/i);
  if (match) {
    if (!requireMode(["vlan"], command)) return finishCommand();
    const id = state.context?.vlanId;
    state.vlans.set(id, { id, name: match[1].trim().toUpperCase() });
    markModified();
    const expected = expectedVlans().find((item) => item.id === id);
    if (expected && normalizeText(expected.name) !== normalizeText(match[1])) {
      setFeedback("warning", "Nombre aplicado, pero no coincide.", `La VLAN ${id} debe llamarse ${expected.name}.`);
    } else {
      setFeedback("success", "VLAN nombrada.", `VLAN ${id}: ${match[1].toUpperCase()}.`);
    }
    return finishCommand();
  }

  match = canonical.match(/^no\s+vlan\s+(\d+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    const id = Number(match[1]);
    if (id === 1) {
      appendTerminal("% Default VLAN 1 may not be deleted.", "error");
      return finishCommand();
    }
    state.vlans.delete(id);
    markModified();
    setFeedback("success", "VLAN eliminada.", `Se eliminó la VLAN ${id}.`);
    return finishCommand();
  }

  match = canonical.match(/^(?:interface|int)\s+range\s+(.+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    const interfaces = parseInterfaceRange(match[1]);
    if (!interfaces) {
      invalidInput(command, "Usa un rango como fa0/1-16 o puerto individual como fa0/23.");
      return finishCommand();
    }
    state.mode = "interface";
    state.context = { interfaces };
    return finishCommand();
  }

  match = canonical.match(/^(?:interface|int)\s+(.+)$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    const parsed = parseInterfaceRange(match[1]) || [normalizeInterfaceName(match[1])];
    const valid = parsed ? parsed.filter((n) => n && state.interfaces[n]) : [];
    if (!valid.length) {
      invalidInput(command, "Interfaz no disponible en este switch simulado.");
      return finishCommand();
    }
    state.mode = "interface";
    state.context = { interfaces: valid };
    return finishCommand();
  }

  if (canonical === "switchport mode access") {
    if (!requireMode(["interface"], command)) return finishCommand();
    const interfaces = activeInterfaces();
    if (interfaces.some((name) => state.interfaces[name].kind !== "physical")) {
      invalidInput(command, "Una SVI no admite comandos switchport.");
      return finishCommand();
    }
    interfaces.forEach((name) => { state.interfaces[name].switchportMode = "access"; });
    markModified();
    return finishCommand();
  }

  match = canonical.match(/^switchport\s+access\s+vlan\s+(\d+)$/i);
  if (match) {
    if (!requireMode(["interface"], command)) return finishCommand();
    const vlan = Number(match[1]);
    const interfaces = activeInterfaces();
    if (!state.vlans.has(vlan)) {
      appendTerminal(`% Access VLAN does not exist. Creating vlan ${vlan}`, "warning");
      state.vlans.set(vlan, { id: vlan, name: `VLAN${String(vlan).padStart(4, "0")}` });
    }
    interfaces.forEach((name) => { state.interfaces[name].accessVlan = vlan; });
    markModified();
    return finishCommand();
  }

  if (canonical === "switchport mode trunk") {
    if (!requireMode(["interface"], command)) return finishCommand();
    const interfaces = activeInterfaces();
    interfaces.forEach((name) => { state.interfaces[name].switchportMode = "trunk"; });
    markModified();
    return finishCommand();
  }

  match = canonical.match(/^switchport\s+trunk\s+native\s+vlan\s+(\d+)$/i);
  if (match) {
    if (!requireMode(["interface"], command)) return finishCommand();
    const vlan = Number(match[1]);
    activeInterfaces().forEach((name) => { state.interfaces[name].trunkNative = vlan; });
    markModified();
    return finishCommand();
  }

  match = canonical.match(/^switchport\s+trunk\s+allowed\s+vlan\s+(.+)$/i);
  if (match) {
    if (!requireMode(["interface"], command)) return finishCommand();
    const value = match[1].trim().toLowerCase();
    if (value === "all") {
      activeInterfaces().forEach((name) => { state.interfaces[name].trunkAllowed = "all"; });
    } else {
      const ids = value.split(",").map((item) => Number(item.trim()));
      if (ids.some((id) => !Number.isInteger(id) || id < 1 || id > 4094)) {
        invalidInput(command, "La lista debe ser, por ejemplo: 1,116,119,120,121.");
        return finishCommand();
      }
      activeInterfaces().forEach((name) => { state.interfaces[name].trunkAllowed = [...new Set(ids)]; });
    }
    markModified();
    return finishCommand();
  }

  if (canonical === "no shutdown") {
    if (!requireMode(["interface"], command)) return finishCommand();
    activeInterfaces().forEach((name) => { state.interfaces[name].shutdown = false; });
    markModified();
    return finishCommand();
  }

  if (canonical === "shutdown") {
    if (!requireMode(["interface"], command)) return finishCommand();
    activeInterfaces().forEach((name) => { state.interfaces[name].shutdown = true; });
    markModified();
    return finishCommand();
  }

  match = canonical.match(/^ip\s+address\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (match) {
    if (!requireMode(["interface"], command)) return finishCommand();
    const interfaces = activeInterfaces();
    if (interfaces.length !== 1 || state.interfaces[interfaces[0]].kind !== "svi") {
      invalidInput(command, "La IP de administración se configura en interface vlan 1.");
      return finishCommand();
    }
    const svi = state.interfaces[interfaces[0]];
    svi.ip = match[1];
    svi.mask = match[2];
    markModified();
    const correct = match[1] === selectedDepartment.ip && match[2] === MASK_24;
    setFeedback(correct ? "success" : "warning", correct ? "IP correcta." : "IP aplicada.", correct ? "Coincide con el escenario." : `Se esperaba ${selectedDepartment.ip} ${MASK_24}.`);
    return finishCommand();
  }

  match = canonical.match(/^ip\s+default-gateway\s+(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (match) {
    if (!requireMode(["global"], command)) return finishCommand();
    state.defaultGateway = match[1];
    markModified();
    const correct = match[1] === DEFAULT_GATEWAY;
    setFeedback(correct ? "success" : "warning", correct ? "Gateway correcto." : "Gateway aplicado.", correct ? "El switch ya tiene gateway de administración." : `Para este ejercicio se espera ${DEFAULT_GATEWAY}.`);
    return finishCommand();
  }

  if (canonical === "write memory") {
    if (!requireMode(["privileged"], command)) return finishCommand();
    appendTerminal("Building configuration...", "system");
    appendTerminal("[OK]", "system");
    state.saved = true;
    state.startupConfigExists = true;
    state.modified = false;
    setFeedback("success", "Configuración guardada.", "La startup-config fue actualizada.");
    return finishCommand();
  }

  if (canonical === "show vlan brief") {
    if (!["privileged", "global", "vlan", "interface", "line"].includes(state.mode)) {
      invalidInput(command, "Usa show desde modo privilegiado o do show desde configuración.");
      return finishCommand();
    }
    printShowVlanBrief();
    return finishCommand();
  }

  if (canonical === "show interfaces trunk") {
    if (!["privileged", "global", "vlan", "interface", "line"].includes(state.mode)) {
      invalidInput(command);
      return finishCommand();
    }
    printShowTrunk();
    return finishCommand();
  }

  if (canonical === "show running-config") {
    if (!["privileged", "global", "vlan", "interface", "line"].includes(state.mode)) {
      invalidInput(command);
      return finishCommand();
    }
    printRunningConfig();
    return finishCommand();
  }

  match = canonical.match(/^do\s+(.+)$/i);
  if (match && ["global", "vlan", "interface", "line"].includes(state.mode)) {
    const inner = match[1].toLowerCase().trim();
    if (inner === "show vlan brief") printShowVlanBrief();
    else if (inner === "show interfaces trunk") printShowTrunk();
    else if (inner === "show running-config") printRunningConfig();
    else invalidInput(command, "Solo se simulan algunos comandos do show.");
    return finishCommand();
  }

  if (canonical === "erase startup-config") {
    if (!requireMode(["privileged"], command)) return finishCommand();
    appendTerminal("Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]", "warning");
    state.pending = { type: "eraseConfirm", prompt: "", placeholder: "Enter para confirmar" };
    return finishCommand();
  }

  if (canonical === "delete flash:vlan.dat" || canonical.startsWith("delete ")) {
    if (!requireMode(["privileged"], command)) return finishCommand();
    appendTerminal("Delete filename [vlan.dat]?", "warning");
    state.pending = { type: "deleteFilename", prompt: "", placeholder: "Enter para aceptar vlan.dat" };
    return finishCommand();
  }

  if (canonical === "reload") {
    if (!requireMode(["privileged"], command)) return finishCommand();
    appendTerminal("System configuration has been modified. Save? [yes/no]:", "warning");
    state.pending = { type: "reloadSave", prompt: "", placeholder: "yes/no" };
    return finishCommand();
  }

  invalidInput(command);
  return finishCommand();
}

function finishCommand() {
  updatePrompt();
  updateProgress();
  if (state.pending) refs.commandInput.placeholder = state.pending.placeholder || "";
}

function printShowVlanBrief() {
  appendTerminal("VLAN Name                             Status    Ports", "system");
  appendTerminal("---- -------------------------------- --------- -------------------------------", "system");
  [...state.vlans.values()].sort((a, b) => a.id - b.id).forEach((vlan) => {
    const ports = Object.entries(state.interfaces)
      .filter(([name, data]) => data.kind === "physical" && data.switchportMode === "access" && data.accessVlan === vlan.id)
      .map(([name]) => name.replace("fa", "Fa").replace("gi", "Gi"))
      .join(", ");
    appendTerminal(`${String(vlan.id).padEnd(4)} ${String(vlan.name).padEnd(32)} active    ${ports}`);
  });
}

function printShowTrunk() {
  const trunk = state.interfaces["gi0/1"];
  appendTerminal("Port        Mode         Encapsulation  Status        Native vlan", "system");
  if (trunk.switchportMode === "trunk") {
    appendTerminal(`Gi0/1       on           802.1q         trunking      ${trunk.trunkNative}`);
    appendTerminal("");
    appendTerminal("Port        Vlans allowed on trunk", "system");
    appendTerminal(`Gi0/1       ${trunk.trunkAllowed === "all" ? "1-4094" : trunk.trunkAllowed.join(",")}`);
  } else {
    appendTerminal("No operational trunking ports on switch");
  }
}

function generateRunningConfig() {
  const lines = [
    "Building configuration...",
    "",
    "Current configuration : simulated",
    "!",
    `hostname ${state.hostname}`,
  ];
  if (state.enableSecret) lines.push("enable secret 5 ********");
  if (state.servicePasswordEncryption) lines.push("service password-encryption");
  if (state.banner) lines.push(`banner motd ^C${state.banner}^C`);
  lines.push("!");

  [...state.vlans.values()].sort((a, b) => a.id - b.id).forEach((vlan) => {
    lines.push(`vlan ${vlan.id}`);
    lines.push(` name ${vlan.name}`);
  });
  lines.push("!");

  const groups = new Map();
  Object.entries(state.interfaces).forEach(([name, data]) => {
    if (data.kind !== "physical") return;
    const key = JSON.stringify({ mode: data.switchportMode, access: data.accessVlan, native: data.trunkNative, allowed: data.trunkAllowed, shutdown: data.shutdown });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(name);
  });

  groups.forEach((names) => {
    names.forEach((name) => {
      const data = state.interfaces[name];
      lines.push(`interface ${name.replace("fa", "FastEthernet").replace("gi", "GigabitEthernet")}`);
      if (data.switchportMode === "access") {
        lines.push(" switchport mode access");
        lines.push(` switchport access vlan ${data.accessVlan}`);
      }
      if (data.switchportMode === "trunk") {
        lines.push(" switchport mode trunk");
        lines.push(` switchport trunk native vlan ${data.trunkNative}`);
        lines.push(` switchport trunk allowed vlan ${data.trunkAllowed === "all" ? "all" : data.trunkAllowed.join(",")}`);
      }
      if (data.shutdown) lines.push(" shutdown");
      lines.push("!");
    });
  });

  const svi = state.interfaces.vlan1;
  lines.push("interface Vlan1");
  if (svi.ip && svi.mask) lines.push(` ip address ${svi.ip} ${svi.mask}`);
  lines.push(svi.shutdown ? " shutdown" : " no shutdown");
  lines.push("!");
  if (state.defaultGateway) lines.push(`ip default-gateway ${state.defaultGateway}`);
  lines.push("!");
  lines.push("line con 0");
  if (state.lines.console.password) lines.push(" password 7 ********");
  if (state.lines.console.login) lines.push(" login");
  lines.push("!");
  lines.push("line vty 0 15");
  if (state.lines.vty.password) lines.push(" password 7 ********");
  if (state.lines.vty.login) lines.push(" login");
  lines.push("end");
  return lines;
}

function printRunningConfig() {
  generateRunningConfig().forEach((line) => appendTerminal(line));
}

function populateDepartments() {
  refs.departmentSelect.innerHTML = "";
  DEPARTMENTS.forEach((department) => {
    const option = document.createElement("option");
    option.value = department.key;
    option.textContent = `${department.label || department.key} · VLAN ${department.vlan}`;
    refs.departmentSelect.appendChild(option);
  });
}

refs.terminalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = refs.commandInput.value;
  if (command.trim() || state.pending) {
    commandHistory.push(command);
    historyIndex = commandHistory.length;
  }
  refs.commandInput.value = "";
  runCommand(command);
});

refs.commandInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (!commandHistory.length) return;
    historyIndex = Math.max(0, historyIndex - 1);
    refs.commandInput.value = commandHistory[historyIndex] || "";
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!commandHistory.length) return;
    historyIndex = Math.min(commandHistory.length, historyIndex + 1);
    refs.commandInput.value = commandHistory[historyIndex] || "";
  }
});

refs.departmentSelect.addEventListener("change", () => {
  selectedDepartment = DEPARTMENTS.find((item) => item.key === refs.departmentSelect.value) || DEPARTMENTS[0];
  resetSession({ preserveScenario: true });
});

refs.practiceModeSelect.addEventListener("change", () => {
  practiceMode = refs.practiceModeSelect.value;
  cleanupMode = false;
  renderScenario();
  const message = practiceMode === "exam"
    ? "No habrá pistas ni avisos de corrección hasta evaluar."
    : practiceMode === "free"
      ? "Puedes experimentar sin seguir el orden del examen."
      : "Recibirás pistas y retroalimentación durante el ejercicio.";
  setFeedback("info", `Modo ${practiceMode === "guided" ? "guiado" : practiceMode === "exam" ? "examen" : "libre"}.`, message);
});

document.querySelector("#newScenarioBtn").addEventListener("click", () => {
  let next = selectedDepartment;
  while (next.key === selectedDepartment.key && DEPARTMENTS.length > 1) {
    next = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
  }
  selectedDepartment = next;
  resetSession({ preserveScenario: true });
});

document.querySelector("#hintBtn").addEventListener("click", showHint);
document.querySelector("#evaluateBtn").addEventListener("click", evaluate);
document.querySelector("#showConfigBtn").addEventListener("click", () => {
  appendTerminal("");
  printRunningConfig();
  refs.terminalOutput.scrollTop = refs.terminalOutput.scrollHeight;
});
document.querySelector("#cleanupPracticeBtn").addEventListener("click", startCleanupPractice);
document.querySelector("#clearTerminalBtn").addEventListener("click", () => {
  refs.terminalOutput.innerHTML = "";
  refs.commandInput.focus();
});
document.querySelector("#retryBtn").addEventListener("click", () => resetSession({ preserveScenario: true }));
document.querySelector("#nextScenarioBtn").addEventListener("click", () => document.querySelector("#newScenarioBtn").click());

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    refs.commandInput.value = button.dataset.command || "";
    refs.commandInput.focus();
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  refs.installBtn.hidden = false;
});

refs.installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  refs.installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

populateDepartments();
renderScenario();
printBootMessage();
updatePrompt();
