// Auto-generated mermaid overlay for Keynote HTML export.
(() => {
  const SHOW_WIDTH = 960;
  const SHOW_HEIGHT = 540;
  const SLIDE_LIST = ["F638A463-375A-45B2-B5CC-5C67EA6CCD92", "DC5E2A37-6C2D-4079-8E2B-60641ED13F77", "62DC281A-5983-4799-985A-E22803250033", "934F311B-EFFD-4ACC-B26C-586C9AE55599", "F99C533B-A274-4405-A8B7-9117EC033D8E", "127B6F9A-7ED2-4800-A529-EE9A94FAC8B0", "E577ABB3-E25D-4AA9-80D5-3C0D51946E6C", "00EA8CF8-D3DC-4415-A1EF-D10AA3D08F21", "E5B4FC62-795C-4B8A-979B-8FD5F0A30106", "07029CCF-366F-4842-A301-19C6E03D5807", "A407D35B-61C5-4D8C-B5FE-576D025ED87F", "CACA70AF-BAD7-4CFF-B44F-7A325BA659D7"];
  const MERMAID_DIAGRAMS = {"07029CCF-366F-4842-A301-19C6E03D5807": {"label": "Mermaid (aggregate-only telemetry)", "code": " flowchart LR\n   Wallet -- counters --> Telemetry[Telemetry client]\n   Verifier -- counters --> Telemetry\n   Telemetry -. batched, encrypted .-> DAP[DivviUp Leader/Helper]\n   DAP --> Reports[Aggregate reports only]", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 332.052734375, "height": 74.0}}, "E5B4FC62-795C-4B8A-979B-8FD5F0A30106": {"label": "Mermaid (BBS+ selective disclosure)", "code": " sequenceDiagram\n   participant I as Issuer\n   participant W as Wallet\n   participant V as Verifier\n\n   I->>W: DI+BBS credential\n   Note over I,W: signature over messages[subject, age_over, residency, status]\n\n   W->>W: deriveProof(reveal=[age_over], nonce)\n   W->>V: proof + revealedMessages + nonce\n   V->>V: verifyProof(publicKey, revealedMessages, nonce)", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 326.0517578125, "height": 151.0}}, "00EA8CF8-D3DC-4415-A1EF-D10AA3D08F21": {"label": "Mermaid (status list check)", "code": " flowchart LR\n   Issuer -- issues VC with\n credentialStatus{index,url} --> Wallet\n   Issuer -- serves --> List[/statuslist/:id.json/]\n   Verifier -- fetch list + check bit --> List\n   Verifier -->|bit=0| Accept\n   Verifier -->|bit=1| Reject\n   Admin[Admin revoke] --> Issuer", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 320.05078125, "height": 96.0}}, "934F311B-EFFD-4ACC-B26C-586C9AE55599": {"label": "Mermaid (issuance pipeline)", "code": " flowchart TD\n   A[POST /credential-offers] --> B[POST /token access_token + c_nonce]\n   B --> C[POST /credential SD-JWT or DI+BBS+]\n\n   C --> D[Embed credentialStatus - BitstringStatusListEntry]\n   E[GET /.well-known/jwks.json] --> C\n   F[GET /.well-known/bbs-public-key] --> C\n\n   G[GET /statuslist/:id.json]:::pub\n   D --> G\n\n   H[POST /revoke/:credentialId] --> G\n\n   classDef pub fill:#EEF2FF,stroke:#C7D2FE,color:#1E3A8A;", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 302.0478515625, "height": 206.0}}, "62DC281A-5983-4799-985A-E22803250033": {"label": "Mermaid (wallet interactions)", "code": " sequenceDiagram\n   participant U as User\n   participant W as Wallet (EUDI)\n   participant R as OHTTP Relay\n   participant I as Issuer\n   participant V as Verifier\n   participant P as iProov\n\n   U->>W: Consent + authenticate\n   W->>P: Liveness check (SDK)\n   P-->>I: Webhook: signals.matching.passed\n\n   W->>R: OIDC4VCI / OIDC4VP requests (encrypted)\n   R->>I: Forward to issuer origin\n   R->>V: Forward to verifier origin", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 314.0498046875, "height": 173.0}}, "CACA70AF-BAD7-4CFF-B44F-7A325BA659D7": {"label": "Mermaid (lab progression)", "code": " flowchart LR\n   L00[Lab 00] --> L01[Lab 01 SD-JWT issuance]\n   L01 --> L02[Lab 02 BBS+ selective disclosure]\n   L02 --> L03[Lab 03 OHTTP]\n   L03 --> L04[Lab 04 iProov gate]\n   L04 --> L05[Lab 05 Status list revocation]", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 194.0302734375, "height": 129.0}}, "F99C533B-A274-4405-A8B7-9117EC033D8E": {"label": "Mermaid (verification flow)", "code": " flowchart TD\n   X[Client POST /verify] --> F{Format?}\n   F -->|vc+sd-jwt| S[Verify SD-JWT signature + disclosures]\n   F -->|di-bbs| B[Verify BBS+ proof (revealed messages only)]\n\n   K[Fetch issuer keys] --> S\n   K --> B\n   R[Fetch status list] --> C{Revoked?}\n   S --> C\n   B --> C\n   C -->|No| OK[ok:true + debug payload]\n   C -->|Yes| NO[Fail: credential_revoked]", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 290.0458984375, "height": 162.0}}, "A407D35B-61C5-4D8C-B5FE-576D025ED87F": {"label": "Mermaid (origin-bound presentation)", "code": " sequenceDiagram\n   participant V as Verifier (origin)\n   participant W as Wallet\n\n   V->>W: vp_request (nonce, client_id=origin)\n   W->>W: user consent + select claims\n   W->>W: create proof bound to nonce + aud\n   W->>V: POST /verify (presentation)\n   V->>V: verify proof + nonce + (optional) WebAuthn", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 326.0517578125, "height": 107.0}}, "DC5E2A37-6C2D-4079-8E2B-60641ED13F77": {"label": "Mermaid (overview)", "code": " flowchart LR\n   W[Mobile Wallet (EUDI fork)]\n   I[Issuer OIDC4VCI]\n   V[Verifier / RP OIDC4VP]\n   R[OHTTP Relay (Cloudflare/Fastly)]\n   P[iProov Liveness]\n   S[Bitstring Status List /CDN]\n   T[DivviUp (DAP) Aggregate telemetry]\n\n   W -- offer/token/credential --> I\n   W -- VP presentation --> V\n\n   W -. encrypted HTTP .-> R\n   R -. forwards .-> I\n   R -. forwards .-> V\n   R -. forwards .-> S\n\n   I -- publish /statuslist/:id.json --> S\n   V -- fetch status list --> S\n\n   W -- SDK verify --> P\n   P -- webhook signals --> I\n\n   W -. counters .-> T\n   V -. counters .-> T", "box": {"x": 535.2800107955932, "y": 116.95999563217157, "width": 272.04296875, "height": 360.0}}, "E577ABB3-E25D-4AA9-80D5-3C0D51946E6C": {"label": "Mermaid (liveness gating)", "code": " sequenceDiagram\n   participant W as Wallet\n   participant I as Issuer (or Verifier gate)\n   participant P as iProov\n\n   W->>I: POST /iproov/claim\n   I-->>W: token / streamingURL\n   W->>P: SDK session with token\n   P-->>I: POST /iproov/webhook\n   I-->>W: Allow issuance/presentation (passed=true)", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 332.052734375, "height": 118.0}}, "127B6F9A-7ED2-4800-A529-EE9A94FAC8B0": {"label": "Mermaid (OHTTP path)", "code": " sequenceDiagram\n   participant C as Client (Wallet / Verifier)\n   participant R as OHTTP Relay\n   participant G as Gateway\n   participant O as Origin (Issuer/Verifier/Status)\n\n   C->>R: Encrypted request\n   R->>G: Forward (client IP hidden from origin)\n   G->>O: Decrypted HTTP request\n   O-->>G: HTTP response\n   G-->>R: Encrypted response\n   R-->>C: Forward", "box": {"x": 535.2800164713822, "y": 116.95999868392943, "width": 326.0517578125, "height": 140.0}}};

  const OVERLAY_ID = 'mermaid-overlay';
  const DIAGRAM_CLASS = 'mermaid-diagram';
  let overlayRoot = null;
  let renderPromise = null;
  let currentSlideIndex = 0;

  function ensureStyle() {
    if (document.getElementById('mermaid-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'mermaid-overlay-style';
    style.textContent = `
      #${OVERLAY_ID} {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999;
      }
      #${OVERLAY_ID} .${DIAGRAM_CLASS} {
        position: absolute;
        box-sizing: border-box;
        padding: 4px;
        background: #0c101f;
        border-radius: 3px;
        overflow: hidden;
      }
      #${OVERLAY_ID} .${DIAGRAM_CLASS} svg {
        width: 100%;
        height: 100%;
        max-width: none;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlayRoot() {
    const stage = document.getElementById('stage');
    if (!stage) return null;
    if (!overlayRoot || !overlayRoot.isConnected) {
      overlayRoot = document.createElement('div');
      overlayRoot.id = OVERLAY_ID;
      stage.appendChild(overlayRoot);
    }
    return overlayRoot;
  }

  function initMermaid() {
    if (!window.mermaid || initMermaid.done) return;
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      themeVariables: {
        background: 'transparent',
        primaryColor: '#111827',
        primaryBorderColor: '#475569',
        primaryTextColor: '#E5E7EB',
        lineColor: '#94A3B8',
        secondaryColor: '#0f172a',
        tertiaryColor: '#1f2937',
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: '12px'
      }
    });
    initMermaid.done = true;
  }

  function normalizeMermaid(code) {
    const rawLines = code.split('\n').map((line) => line.replace(/\s+$/g, ''));
    const lines = [];
    const pairs = { '[': ']', '(': ')', '{': '}' };
    const openers = new Set(Object.keys(pairs));
    const closers = new Set(Object.values(pairs));

    const updateBalance = (line) => {
      let bal = 0;
      for (const ch of line) {
        if (openers.has(ch)) bal += 1;
        else if (closers.has(ch)) bal -= 1;
      }
      return bal;
    };

    const needsContinuation = (line) => {
      if (!line) return false;
      const trimmed = line.trim();
      if (!trimmed) return false;
      // Handle flowchart edge labels wrapped onto the next line.
      const hasEdge = /--|-\.\s*|\s==/.test(trimmed);
      const hasArrowEnd = /-->|--o|--x|---|-\.\->|==>|=>|<--|<->|->/.test(trimmed);
      if (hasEdge && !hasArrowEnd) return true;
      // Handle sequence messages wrapped after the ':'.
      if (/(->>|-->>|->|-->|<->|<--|<<--)/.test(trimmed) && trimmed.endsWith(':')) {
        return true;
      }
      return false;
    };

    let current = null;
    let balance = 0;
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (current === null) {
        current = trimmed;
        balance = updateBalance(current);
        continue;
      }

      if (balance > 0 && trimmed) {
        current = `${current} ${trimmed}`.trim();
        balance += updateBalance(trimmed);
        continue;
      }

      if (needsContinuation(current) && trimmed) {
        current = `${current} ${trimmed}`.trim();
        balance += updateBalance(trimmed);
        continue;
      }

      lines.push(current);
      current = trimmed;
      balance = updateBalance(current);
    }

    if (current !== null) lines.push(current);
    // Trim leading/trailing empty lines.
    while (lines.length && !lines[0]) lines.shift();
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return lines.join('\n');
  }

  async function renderDiagram(slideId, diagram) {
    const container = document.createElement('div');
    container.className = DIAGRAM_CLASS;
    container.dataset.slideId = slideId;
    container.style.left = `${diagram.box.x}px`;
    container.style.top = `${diagram.box.y}px`;
    container.style.width = `${diagram.box.width}px`;
    container.style.height = `${diagram.box.height}px`;
    container.style.display = 'none';
    overlayRoot.appendChild(container);

    try {
      const renderId = `mermaid-${slideId}`;
      const normalized = normalizeMermaid(diagram.code);
      const result = await window.mermaid.render(renderId, normalized);
      const svgMarkup = result.svg || result;
      const temp = document.createElement('div');
      temp.innerHTML = svgMarkup;
      const svgEl = temp.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.maxWidth = 'none';
        container.appendChild(svgEl);
        if (result.bindFunctions) result.bindFunctions(svgEl);
      } else {
        container.innerHTML = svgMarkup;
      }
    } catch (err) {
      console.warn('Mermaid render failed for slide', slideId, err);
    }
  }

  async function renderAll() {
    ensureStyle();
    const root = ensureOverlayRoot();
    if (!root) return;
    if (!window.mermaid) {
      console.warn('Mermaid library not loaded.');
      return;
    }
    initMermaid();
    const entries = Object.entries(MERMAID_DIAGRAMS);
    for (const [slideId, diagram] of entries) {
      await renderDiagram(slideId, diagram);
    }
    updateVisibility();
  }

  function updateVisibility() {
    if (!overlayRoot) return;
    const slideId = SLIDE_LIST[currentSlideIndex];
    const children = overlayRoot.querySelectorAll(`.${DIAGRAM_CLASS}`);
    for (const child of children) {
      child.style.display = child.dataset.slideId === slideId ? 'block' : 'none';
    }
  }

  function handleSlideChange(event) {
    const idx = event && event.detail && typeof event.detail.slideIndex === 'number'
      ? event.detail.slideIndex
      : 0;
    currentSlideIndex = idx;
    updateVisibility();
  }

  function maybeRender() {
    if (renderPromise) return;
    const root = ensureOverlayRoot();
    if (!root) return;
    if (!window.mermaid) return;
    renderPromise = renderAll().catch(err => {
      console.warn('Mermaid overlay render failed', err);
      renderPromise = null;
    });
  }

  document.addEventListener('ShowController:SlideIndexDidChangeEvent', handleSlideChange);
  document.addEventListener('StageManager:StageIsReadyEvent', maybeRender);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeRender);
  } else {
    maybeRender();
  }
})();
