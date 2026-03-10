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

const componentDefs = [
  { key: "issuer", title: "Issuer", description: "Credential offers, tokens, issuance, iProov gate." },
  { key: "verifier", title: "Verifier", description: "Presentation verification and status checking." },
  { key: "relay", title: "Relay", description: "Local privacy relay showing the fetch path." },
  { key: "sdJwt", title: "SD-JWT", description: "Baseline selective disclosure with signed disclosures." },
  { key: "bbs", title: "BBS+", description: "Selective-disclosure proof revealing only one claim." },
  { key: "revocation", title: "Revocation", description: "Bitstring status list and failure after the bit flips." }
];

let latestPayload = null;

async function fetchState() {
  const response = await fetch(stateUrl);
  if (!response.ok) {
    throw new Error(`Failed to load state: ${response.status}`);
  }
  latestPayload = await response.json();
  render();
}

function render() {
  if (!latestPayload) return;

  const { steps, state } = latestPayload;
  renderComponents(state);
  renderSteps(steps, state);
  renderEvidence(state);
  renderLogs(state);
  renderRelay(state);
  renderSnapshots(state);
  renderTakeaway(state);

  statusBanner.textContent = state.lastError
    ? `Last error: ${state.lastError}`
    : state.busy
      ? `Running ${humanizeStep(state.currentStepId)}...`
      : "Ready. Run the next step, or use Hard Reset to rewind the booth to a clean start.";
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
    const card = document.createElement("article");
    const status = state.steps[step.id];
    card.className = `step-card ${status}`;
    const button = document.createElement("button");
    button.className = "button button-primary";
    button.type = "button";
    button.textContent = state.currentStepId === step.id && state.busy ? "Running..." : "Run Step";
    button.disabled = state.busy;
    button.addEventListener("click", () => runStep(step.id));

    card.innerHTML = `
      <header>
        <div>
          <p class="step-meta">${status}</p>
          <h3>${step.title}</h3>
        </div>
      </header>
      <p>${step.summary}</p>
    `;
    card.appendChild(button);
    stepList.appendChild(card);
  }
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

async function runStep(stepId) {
  const response = await fetch(`/api/steps/${stepId}`, {
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
    "Hard reset will stop the local services, clear the artifacts, and rewind the demo to step one."
  );
  if (!shouldReset) return;

  const response = await fetch("/api/reset", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ force: true })
  });
  const payload = await response.json();
  latestPayload = { ...latestPayload, state: payload.state || latestPayload.state };
  render();
}

resetButton.addEventListener("click", hardResetDemo);

window.addEventListener("keydown", (event) => {
  if (!event.shiftKey || event.key.toLowerCase() !== "r") return;
  event.preventDefault();
  hardResetDemo().catch((error) => {
    console.error(error);
  });
});

fetchState().catch((error) => {
  statusBanner.textContent = error.message;
});

setInterval(() => {
  fetchState().catch(() => {});
}, 1500);
