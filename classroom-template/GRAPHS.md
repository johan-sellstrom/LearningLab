# Mermaid Diagrams

## Slide 1: Mermaid (overview)
Slide ID: DC5E2A37-6C2D-4079-8E2B-60641ED13F77

```mermaid
flowchart LR;
W[Mobile Wallet - EUDI fork];
I[Issuer OIDC4VCI];
V[Verifier / RP OIDC4VP];
R[OHTTP Relay - Cloudflare/Fastly];
P[iProov Liveness];
S[Bitstring Status List /CDN];
T[DivviUp - DAP Aggregate telemetry];

W -- offer/token/credential --> I;
W -- VP presentation --> V;

W -. encrypted HTTP .-> R;
R -. forwards .-> I;
R -. forwards .-> V;
R -. forwards .-> S;

I -- publish /statuslist/:id.json --> S;
V -- fetch status list --> S;

W -- SDK verify --> P;
P -- webhook signals --> I;

W -. counters .-> T;
V -. counters .-> T;


```

## Slide 2: Mermaid (wallet interactions)
Slide ID: 62DC281A-5983-4799-985A-E22803250033

```mermaid
sequenceDiagram;
participant U as User;
participant W as Wallet (EUDI);
participant R as OHTTP Relay;
participant I as Issuer;
participant V as Verifier;
participant P as iProov;

U->>W: Consent + authenticate;
W->>P: Liveness check (SDK);
P-->>I: Webhook: signals.matching.passed;

W->>R: OIDC4VCI / OIDC4VP requests (encrypted);
R->>I: Forward to issuer origin;
R->>V: Forward to verifier origin;


```

## Slide 3: Mermaid (issuance pipeline)
Slide ID: 934F311B-EFFD-4ACC-B26C-586C9AE55599

```mermaid
flowchart TD;
A[POST /credential-offers] --> B[POST /token access_token + c_nonce];
B --> C[POST /credential SD-JWT or DI+BBS+];

C --> D[Embed credentialStatus - BitstringStatusListEntry];
E[GET /.well-known/jwks.json] --> C;
F[GET /.well-known/bbs-public-key] --> C;

G[GET /statuslist/:id.json]:::pub;
D --> G;

H[POST /revoke/:credentialId] --> G;

classDef pub fill:#EEF2FF,stroke:#C7D2FE,color:#1E3A8A;


```

## Slide 4: Mermaid (verification flow)
Slide ID: F99C533B-A274-4405-A8B7-9117EC033D8E

```mermaid
flowchart TD;
X[Client POST /verify] --> F{Format?};
F -->|vc+sd-jwt| S[Verify SD-JWT signature + disclosures];
F -->|di-bbs| B[Verify BBS+ proof - revealed messages only];

K[Fetch issuer keys] --> S;
K --> B;
R[Fetch status list] --> C{Revoked?};
S --> C;
B --> C;
C -->|No| OK[ok:true + debug payload];
C -->|Yes| NO[Fail: credential_revoked];


```

## Slide 5: Mermaid (OHTTP path)
Slide ID: 127B6F9A-7ED2-4800-A529-EE9A94FAC8B0

```mermaid
sequenceDiagram;
participant C as Client (Wallet / Verifier);
participant R as OHTTP Relay;
participant G as Gateway;
participant O as Origin (Issuer/Verifier/Status);

C->>R: Encrypted request;
R->>G: Forward (client IP hidden from origin);
G->>O: Decrypted HTTP request;
O-->>G: HTTP response;
G-->>R: Encrypted response;
R-->>C: Forward;


```

## Slide 6: Mermaid (liveness gating)
Slide ID: E577ABB3-E25D-4AA9-80D5-3C0D51946E6C

```mermaid
sequenceDiagram;
participant W as Wallet;
participant I as Issuer (or Verifier gate);
participant P as iProov;

W->>I: POST /iproov/claim;
I-->>W: token / streamingURL;
W->>P: SDK session with token;
P-->>I: POST /iproov/webhook;
I-->>W: Allow issuance/presentation (passed=true);


```

## Slide 7: Mermaid (status list check)
Slide ID: 00EA8CF8-D3DC-4415-A1EF-D10AA3D08F21

```mermaid
flowchart LR;
Issuer -- issues VC with credentialStatus{index,url} --> Wallet;
Issuer -- serves --> List[/statuslist/:id.json/];
Verifier -- fetch list + check bit --> List;
Verifier -->|bit=0| Accept;
Verifier -->|bit=1| Reject;
Admin[Admin revoke] --> Issuer;


```

## Slide 8: Mermaid (BBS+ selective disclosure)
Slide ID: E5B4FC62-795C-4B8A-979B-8FD5F0A30106

```mermaid
sequenceDiagram;
participant I as Issuer;
participant W as Wallet;
participant V as Verifier;

I->>W: DI+BBS credential;
Note over I,W: signature over messages[subject, age_over, residency, status];

W->>W: deriveProof(reveal=[age_over], nonce);
W->>V: proof + revealedMessages + nonce;
V->>V: verifyProof(publicKey, revealedMessages, nonce);


```

## Slide 9: Mermaid (aggregate-only telemetry)
Slide ID: 07029CCF-366F-4842-A301-19C6E03D5807

```mermaid
flowchart LR;
Wallet -- counters --> Telemetry[Telemetry client];
Verifier -- counters --> Telemetry;
Telemetry -. batched, encrypted .-> DAP[DivviUp Leader/Helper];
DAP --> Reports[Aggregate reports only];


```

## Slide 10: Mermaid (origin-bound presentation)
Slide ID: A407D35B-61C5-4D8C-B5FE-576D025ED87F

```mermaid
sequenceDiagram;
participant V as Verifier (origin);
participant W as Wallet;

V->>W: vp_request (nonce, client_id=origin);
W->>W: user consent + select claims;
W->>W: create proof bound to nonce + aud;
W->>V: POST /verify (presentation);
V->>V: verify proof + nonce + (optional) WebAuthn;


```

## Slide 11: Mermaid (lab progression)
Slide ID: CACA70AF-BAD7-4CFF-B44F-7A325BA659D7

```mermaid
flowchart LR;
L00[Lab 00] --> L01[Lab 01 SD-JWT issuance];
L01 --> L02[Lab 02 BBS+ selective disclosure];
L02 --> L03[Lab 03 OHTTP];
L03 --> L04[Lab 04 iProov gate];
L04 --> L05[Lab 05 Status list revocation];


```
