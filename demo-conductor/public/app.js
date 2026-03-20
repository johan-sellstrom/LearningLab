const stateUrl = "/api/state";
const componentGrid = document.getElementById("component-grid");
const stepList = document.getElementById("step-list");
const evidenceList = document.getElementById("evidence-list");
const issuerLogs = document.getElementById("issuer-logs");
const verifierLogs = document.getElementById("verifier-logs");
const relayEvents = document.getElementById("relay-events");
const statusBanner = document.getElementById("status-banner");
const issuedSnapshot = document.getElementById("issued-snapshot");
const presentationSnapshot = document.getElementById("presentation-snapshot");
const repoLink = document.getElementById("repo-link");
const repoUrlText = document.getElementById("repo-url-text");
const qrWrapper = document.getElementById("qr-wrapper");
const resetButton = document.getElementById("reset-button");
const logoutButton = document.getElementById("logout-button");
const accountName = document.getElementById("account-name");
const accountEmail = document.getElementById("account-email");
const iproovPanel = document.getElementById("iproov-panel");
const iproovBanner = document.getElementById("iproov-banner");
const iproovMeta = document.getElementById("iproov-meta");
const iproovMount = document.getElementById("iproov-mount");
const iproovScenarioStep = {
  id: "run-iproov",
  title: "Complete iProov",
  summary: "Run the liveness ceremony before Issue BBS+ verifies the selective-disclosure proof."
};

const componentDefs = [
  { key: "issuer", title: "Issuer", description: "Credential offers, tokens, issuance, and iProov session state." },
  { key: "verifier", title: "Verifier", description: "Presentation verification and status checking." },
  { key: "iproov", title: "iProov", description: "Liveness ceremony before the verifier accepts the BBS+ disclosure." },
  { key: "relay", title: "Relay", description: "Local privacy relay showing the fetch path." },
  { key: "sdJwt", title: "SD-JWT", description: "Baseline selective disclosure with signed disclosures." },
  { key: "bbs", title: "BBS+", description: "Selective-disclosure proof revealing only one claim." },
  { key: "revocation", title: "Revocation", description: "Bitstring status list and failure after the bit flips." }
];

let latestPayload = null;
let currentUser = null;
let iproovScriptPromise = null;

async function fetchState() {
  const response = await apiFetch(stateUrl);
  if (!response.ok) {
    throw new Error(`Failed to load state: ${response.status}`);
  }
  latestPayload = await response.json();
  render();
}

async function fetchCurrentUser() {
  const response = await apiFetch("/api/me");
  if (!response.ok) {
    throw new Error(`Failed to load account: ${response.status}`);
  }
  const payload = await response.json();
  currentUser = payload.user || null;
  renderAccount();
}

function render() {
  if (!latestPayload) return;

  const { steps, state } = latestPayload;
  const scenarioSteps = buildScenarioSteps(steps);
  renderAccount();
  renderComponents(state);
  renderSteps(scenarioSteps, state);
  renderEvidence(state);
  renderLogs(state);
  renderRelay(state);
  renderSnapshots(state);
  renderIproov(state);
  renderTakeaway(state);

  statusBanner.textContent = state.lastError
    ? `Last error: ${state.lastError}`
    : state.busy
      ? `Running ${humanizeActivity(state)}...`
      : "Ready. Run the next step, or reset only your signed-in session.";
}

function buildScenarioSteps(steps) {
  const ordered = [];
  let inserted = false;

  for (const step of steps) {
    ordered.push(step);
    if (step.id === "issue-sd-jwt") {
      ordered.push(iproovScenarioStep);
      inserted = true;
    }
  }

  if (!inserted) ordered.push(iproovScenarioStep);
  return ordered;
}

function renderAccount() {
  if (!accountName || !accountEmail) return;
  const fallbackName = currentUser?.mode === "open" ? "Local demo mode" : "Signed-in user";
  accountName.textContent = currentUser?.name || currentUser?.email || fallbackName;
  accountEmail.textContent = currentUser?.email || (currentUser?.mode === "open" ? "Authentication disabled" : "");
}

function renderComponents(state) {
  componentGrid.innerHTML = "";
  for (const component of componentDefs) {
    const card = document.createElement("article");
    card.className = "component-card";
    const { label, className } = componentStatus(component.key, state);
    if (className) card.classList.add(className);
    card.innerHTML = `
      <h3>${component.title}</h3>
      <p>${component.description}</p>
      <span class="component-state">${label}</span>
    `;
    componentGrid.appendChild(card);
  }
}

function componentStatus(key, state) {
  if (key === "issuer") {
    return state.services.issuer.status === "running"
      ? { label: "Running on :3001", className: "running" }
      : { label: "Offline", className: "" };
  }
  if (key === "verifier") {
    return state.services.verifier.status === "running"
      ? { label: state.relayEnabled ? "Running with relay" : "Running direct", className: "running" }
      : { label: "Offline", className: "" };
  }
  if (key === "relay") {
    return state.relayEnabled
      ? { label: `${state.relayEvents.length} forwarded requests`, className: "active" }
      : { label: "Direct fetches", className: "" };
  }
  if (key === "iproov") {
    if (!state.iproov.realCeremonyEnabled) {
      return { label: "Simulated callback mode", className: "warning" };
    }
    if (state.iproov.status === "passed") {
      return { label: "Live ceremony passed", className: "running" };
    }
    if (state.iproov.status === "pending") {
      return { label: "Ceremony in progress", className: "active" };
    }
    if (state.iproov.status === "failed") {
      return { label: "Ceremony failed", className: "warning" };
    }
    if (state.services.issuer.status !== "running" || state.services.verifier.status !== "running") {
      return { label: "Waiting for issuer + verifier", className: "" };
    }
    return { label: "Ready for BBS+ disclosure", className: "" };
  }
  if (key === "sdJwt") {
    return state.artifacts.sdJwt
      ? { label: "Credential issued and verified", className: "running" }
      : { label: "Not demonstrated yet", className: "" };
  }
  if (key === "bbs") {
    return state.artifacts.bbs
      ? { label: "Proof derived and verified", className: "running" }
      : { label: "Not demonstrated yet", className: "" };
  }
  if (key === "revocation") {
    const revoked = state.steps["revoke-credential"] === "completed";
    return revoked
      ? { label: "Verifier now rejects the credential", className: "warning" }
      : { label: "Credential still active", className: "" };
  }
  return { label: "Unknown", className: "" };
}

function renderSteps(steps, state) {
  stepList.innerHTML = "";
  for (const step of steps) {
    const isIproovStep = step.id === iproovScenarioStep.id;
    const card = document.createElement("article");
    const status = isIproovStep ? iproovScenarioStatus(state) : state.steps[step.id];
    card.className = `step-card ${status}`;
    const button = document.createElement("button");
    button.className = "button button-primary";
    button.type = "button";
    button.textContent = isIproovStep
      ? iproovScenarioButtonLabel(state)
      : state.currentStepId === step.id && state.busy
        ? "Running..."
        : "Run Step";
    button.disabled = isIproovStep ? iproovScenarioDisabled(state) : state.busy;
    button.addEventListener("click", () => {
      if (isIproovStep) {
        runIproovScenarioStep().catch((error) => {
          console.error(error);
          iproovBanner.textContent = error.message;
        });
        return;
      }
      runStep(step.id).catch((error) => console.error(error));
    });

    card.innerHTML = `
      <header>
        <div>
          <p class="step-meta">${status}</p>
          <h3>${step.title}</h3>
        </div>
      </header>
      <p>${isIproovStep ? iproovScenarioSummary(state) : step.summary}</p>
    `;
    card.appendChild(button);
    stepList.appendChild(card);
  }
}

function iproovScenarioStatus(state) {
  if (state.busy && !state.currentStepId) return "running";
  if (state.iproov.status === "passed") return "completed";
  if (state.iproov.status === "failed") return "failed";
  if (state.iproov.status === "pending") return "running";
  return "pending";
}

function iproovScenarioSummary(state) {
  if (!state.iproov.realCeremonyEnabled) {
    return "Real iProov credentials are not configured. This slot stays in the scenario order so Issue BBS+ still follows liveness, but the simulated callback path is used instead.";
  }
  if (state.iproov.status === "passed") {
    return "Live iProov ceremony passed. Issue BBS+ can now send the selective-disclosure proof to the verifier.";
  }
  if (state.iproov.status === "pending" && state.iproov.session) {
    return "An iProov session is open. Launch or resume the browser ceremony in the iProov workspace, then continue to Issue BBS+.";
  }
  return iproovScenarioStep.summary;
}

function iproovScenarioButtonLabel(state) {
  if (!state.iproov.realCeremonyEnabled) return "Handled In BBS+";
  if (state.busy && !state.currentStepId) return "Working...";
  if (state.iproov.status === "passed") return "Completed";
  if (state.iproov.status === "pending" && state.iproov.token) return "Launch Ceremony";
  return "Start Ceremony";
}

function iproovScenarioDisabled(state) {
  if (state.busy) return true;
  if (!state.iproov.realCeremonyEnabled) return true;
  if (state.iproov.status === "passed") return true;
  return state.services.issuer.status !== "running" || state.services.verifier.status !== "running";
}

function shouldShowIproovWorkspace(state) {
  return state.iproov.realCeremonyEnabled && state.iproov.status !== "idle";
}

function renderEvidence(state) {
  evidenceList.innerHTML = "";
  for (const entry of state.evidence) {
    const card = document.createElement("article");
    card.className = "evidence-card";
    const requestBlock = entry.request
      ? `<pre class="payload">${escapeHtml(pretty(entry.request))}</pre>`
      : "";
    const responseBlock = entry.response
      ? `<pre class="payload">${escapeHtml(pretty(entry.response))}</pre>`
      : "";
    card.innerHTML = `
      <h3>${entry.title}</h3>
      <p>${entry.detail || `${entry.kind.toUpperCase()} · ${entry.createdAt}`}</p>
      ${requestBlock}
      ${responseBlock}
    `;
    evidenceList.appendChild(card);
  }
}

function renderLogs(state) {
  issuerLogs.textContent = renderLogLines(state.services.issuer.logs);
  verifierLogs.textContent = renderLogLines(state.services.verifier.logs);
}

function renderRelay(state) {
  relayEvents.innerHTML = "";
  if (state.relayEvents.length === 0) {
    relayEvents.innerHTML = `<div class="relay-event">No relay traffic yet.</div>`;
    return;
  }

  for (const event of state.relayEvents) {
    const item = document.createElement("div");
    item.className = "relay-event";
    item.textContent = `${event.status} ${event.target}`;
    relayEvents.appendChild(item);
  }
}

function renderSnapshots(state) {
  issuedSnapshot.textContent = pretty(state.snapshots.issued);
  presentationSnapshot.textContent = pretty(state.snapshots.presentation);
}

function renderIproov(state) {
  const iproov = state.iproov;
  const prerequisitesMet =
    state.services.issuer.status === "running" && state.services.verifier.status === "running";
  const showWorkspace = shouldShowIproovWorkspace(state);

  iproovPanel?.classList.toggle("is-hidden", !showWorkspace);
  if (!showWorkspace) return;

  iproovBanner.textContent = iproov.reason
    ? `iProov: ${iproov.reason}`
    : prerequisitesMet
      ? iproov.note || "Complete the iProov step before Issue BBS+."
      : "Start the issuer and verifier before running the iProov step for Issue BBS+.";

  const metaLines = [
    `Mode: ${iproov.realCeremonyEnabled ? "real browser ceremony" : "simulated callback"}`,
    `Session: ${iproov.session || "none"}`,
    `Status: ${iproov.status}`,
    iproov.validatedAt ? `Validated: ${iproov.validatedAt}` : null
  ].filter(Boolean);
  iproovMeta.innerHTML = metaLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");

  if (!iproov.realCeremonyEnabled) {
    iproovMount.innerHTML = `<p class="iproov-placeholder">Real iProov credentials are not configured. The iProov step stays informational and the BBS+ flow continues with the simulated callback path.</p>`;
    return;
  }

  if (!window.isSecureContext) {
    iproovMount.innerHTML = `<p class="iproov-placeholder">The iProov web ceremony requires a secure context. Use the Railway HTTPS URL for the live ceremony.</p>`;
    return;
  }

  if (iproov.status === "idle" || !iproov.session) {
    iproovMount.innerHTML = `<p class="iproov-placeholder">Use the Complete iProov step to request a live token, then finish the browser ceremony here before Issue BBS+.</p>`;
  }
}

function renderTakeaway(state) {
  const repoUrl = state.repoUrl || "Repository URL unavailable";
  repoLink.href = state.repoUrl || "#";
  repoLink.setAttribute("aria-disabled", String(!state.repoUrl));
  repoUrlText.textContent = repoUrl;
  qrWrapper.innerHTML = state.qrSvg || "<p>No QR code available.</p>";
}

function renderLogLines(lines) {
  if (!lines.length) return "No output yet.";
  return lines.map((line) => `[${line.stream}] ${line.message}`).join("\n");
}

function pretty(value) {
  if (value === null || value === undefined) return "No data yet.";
  return JSON.stringify(value, null, 2);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function humanizeStep(stepId) {
  const step = latestPayload?.steps?.find((item) => item.id === stepId);
  return step ? step.title : "step";
}

function humanizeActivity(state) {
  return state.currentStepId ? humanizeStep(state.currentStepId) : "iProov ceremony";
}

async function runStep(stepId) {
  const response = await apiFetch(`/api/steps/${stepId}`, {
    method: "POST"
  });
  const payload = await response.json();
  latestPayload = { ...latestPayload, state: payload.state || latestPayload.state };
  render();
  if (!response.ok) {
    console.error(payload.error || "Step failed");
  } else {
    await fetchState();
  }
}

async function hardResetDemo() {
  const shouldReset = window.confirm(
    "Reset your signed-in session and clear only your artifacts and progress?"
  );
  if (!shouldReset) return;

  const response = await apiFetch("/api/reset", { method: "POST" });
  const payload = await response.json();
  latestPayload = { ...latestPayload, state: payload.state || latestPayload.state };
  render();
}

async function startIproovCeremony() {
  const response = await apiFetch("/api/iproov/claim", { method: "POST" });
  const payload = await response.json();
  latestPayload = { ...latestPayload, state: payload.state || latestPayload.state };
  render();
  if (!response.ok) {
    console.error(payload.error || "Unable to start iProov ceremony");
    return;
  }

  const nextIproov = latestPayload?.state?.iproov;
  if (nextIproov?.realCeremonyEnabled && nextIproov?.session && nextIproov?.token) {
    focusIproovPanel();
    await launchIproovCeremony(nextIproov);
  }
}

async function runIproovScenarioStep() {
  const iproov = latestPayload?.state?.iproov;
  if (iproov?.realCeremonyEnabled && iproov.status === "pending" && iproov.session && iproov.token) {
    focusIproovPanel();
    await launchIproovCeremony(iproov);
    return;
  }
  await startIproovCeremony();
}

async function launchIproovCeremony(iproov) {
  await ensureIproovSdk(iproov.sdkScriptUrl);

  iproovMount.innerHTML = "";
  const ceremony = document.createElement("iproov-me");
  ceremony.setAttribute("token", iproov.token);
  if (iproov.ceremonyBaseUrl) {
    ceremony.setAttribute("base_url", iproov.ceremonyBaseUrl);
  }

  ceremony.addEventListener("passed", () => {
    iproovBanner.textContent = "iProov reported passed. Validating with the issuer...";
    validateIproovCeremony().catch((error) => console.error(error));
  }, { once: true });

  ceremony.addEventListener("failed", (event) => {
    const message = extractIproovEventMessage(event, "iProov reported a failed ceremony.");
    iproovBanner.textContent = message;
    expireIproovSession(message);
  });

  ceremony.addEventListener("error", (event) => {
    const message = extractIproovEventMessage(event, "The iProov SDK reported an error.");
    iproovBanner.textContent = message;
    expireIproovSession(message);
  });

  ceremony.addEventListener("canceled", () => {
    const message = "The iProov ceremony was canceled. Start a new session to try again.";
    iproovBanner.textContent = message;
    expireIproovSession(message);
  });

  iproovMount.appendChild(ceremony);
}

async function validateIproovCeremony() {
  const response = await apiFetch("/api/iproov/validate", { method: "POST" });
  const payload = await response.json();
  latestPayload = { ...latestPayload, state: payload.state || latestPayload.state };
  render();
  if (!response.ok) {
    console.error(payload.error || "Unable to validate iProov ceremony");
  } else {
    await fetchState();
  }
}

function ensureIproovSdk(scriptUrl) {
  if (customElements.get("iproov-me")) return Promise.resolve();
  if (iproovScriptPromise) return iproovScriptPromise;

  iproovScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl || "https://cdn.jsdelivr.net/npm/@iproov/web";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the iProov web SDK"));
    document.head.appendChild(script);
  });

  return iproovScriptPromise;
}

function focusIproovPanel() {
  iproovPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function expireIproovSession(message) {
  const state = latestPayload?.state;
  const iproov = state?.iproov;
  if (!state || !iproov) return;

  latestPayload = {
    ...latestPayload,
    state: {
      ...state,
      iproov: {
        ...iproov,
        status: "failed",
        token: null,
        note: message || "The iProov session expired. Start a new ceremony to try again."
      }
    }
  };

  render();
}

function extractIproovEventMessage(event, fallback) {
  const detail = event?.detail;
  if (typeof detail?.message === "string" && detail.message) return detail.message;
  if (typeof detail?.reason?.message === "string" && detail.reason.message) return detail.reason.message;
  if (typeof detail?.reason === "string" && detail.reason) return detail.reason;
  return fallback;
}

async function apiFetch(url, init) {
  const response = await fetch(url, init);
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Login required");
  }
  return response;
}

async function logout() {
  await fetch("/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

resetButton.addEventListener("click", hardResetDemo);
logoutButton?.addEventListener("click", () => {
  logout().catch((error) => {
    statusBanner.textContent = error.message;
  });
});

window.addEventListener("keydown", (event) => {
  if (!event.shiftKey || event.key.toLowerCase() !== "r") return;
  event.preventDefault();
  hardResetDemo().catch((error) => {
    console.error(error);
  });
});

Promise.all([fetchCurrentUser(), fetchState()]).catch((error) => {
  statusBanner.textContent = error.message;
});

setInterval(() => {
  fetchState().catch(() => {});
}, 1500);
