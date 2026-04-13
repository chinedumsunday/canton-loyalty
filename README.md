# Canton Loyalty

A customer loyalty program built on the Canton Network using DAML smart contracts and a React frontend. Customers apply for membership, airlines approve applications and award points, and customers redeem points — all enforced by smart contracts on a local Canton ledger.

---

## What it does

Canton Loyalty models a real airline loyalty program as DAML contracts:

1. **Customer** submits a loyalty membership application with their details
2. **Airline** reviews and approves the application, creating a `CLPAccount` on the ledger
3. **Airline** awards points to member accounts for flights and activity
4. **Customer** redeems points from their account (with on-chain balance validation)

Every action is a ledger transaction. The points balance is stored in the contract state — not in a database. Redeeming more points than you have fails at the contract level, not the application level.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | DAML (SDK 3.4.11) |
| Ledger | Canton LocalNet (Sandbox) |
| HTTP API | Canton JSON Ledger API v2 |
| Frontend | React 19 |
| Proxy | http-proxy-middleware |

---

## DAML Contracts

**`CLPApplication`**
Created by the customer with their membership details. The airline is an observer. Two choices:
- `ReviewApplication` (airline) — approves the application and creates a `CLPAccount`
- `WithdrawApplication` (customer) — cancels the application

**`CLPAccount`**
Created when the airline approves an application. Both customer and airline are signatories. Two choices:
- `Addpoints` (airline) — awards points to the account, creating an updated contract
- `RedeemPoints` (customer) — redeems points, asserting sufficient balance exists

**Key design decision:** No contract keys — Canton 3.x removed contract key support. Duplicate prevention is handled at the application layer by querying the ACS before submitting.

---

## Architecture

```
React Frontend (localhost:3000)
        ↕  /v2/* proxied via setupProxy.js
Canton JSON Ledger API v2 (localhost:7575)
        ↕  gRPC
Canton Sandbox Ledger (localhost:6865)
        ↕
canton-loyalty-0.0.1.dar (compiled DAML contracts)
```

---

## Project Structure

```
canton-loyalty/
├── daml/
│   ├── CLP.daml          ← DAML smart contracts
│   └── TestCLP.daml      ← DAML test scripts
├── frontend/
│   ├── src/
│   │   ├── App.js        ← React UI (Customer + Airline views)
│   │   ├── App.css       ← Pink/gold dark theme
│   │   ├── api.js        ← Canton JSON API v2 client
│   │   └── setupProxy.js ← Dev proxy for CORS
│   └── package.json
└── daml.yaml
```

---

## Running Locally

**Prerequisites:**
- DAML SDK 3.4.11 installed
- Node.js and npm installed

**Step 1 — Build the contracts:**
```bash
daml build
```

**Step 2 — Start Canton:**
```bash
daml sandbox --json-api-port 7575 --dar .daml/dist/canton-loyalty-0.0.1.dar
```

**Step 3 — Start the frontend:**
```bash
cd frontend
npm install
npm start
```

**Step 4 — Open the app:**

Navigate to `http://localhost:3000` and click **Initialise Ledger**.

**Test the full flow:**
1. **Customer** tab → apply for membership with your details
2. **Airline** tab → approve the application
3. **Airline** tab → add points to the member account
4. **Customer** tab → redeem points

---

## What Changed from DAML 2.x

This project was originally based on `Lab2x.daml` which used contract keys — a feature removed in Canton 3.x. The key differences:

**Old approach (2.x):**
```daml
key (airline, id): (Party, Text)
maintainer key._1
-- lookupByKey to check for duplicates
```

**New approach (3.x):**
- No `key` or `maintainer` declarations
- Duplicate prevention handled in the frontend by querying the ACS before submitting
- `lookupByKey` replaced by filtering the active contract set in application code

This reflects Canton's architectural direction — uniqueness constraints that require global state don't fit well in a distributed multi-participant network where different nodes have different visibility into the ledger.

---

## About

Built as part of a structured DAML learning path toward smart contract development on the Canton Network. Demonstrates how to adapt DAML 2.x patterns for Canton 3.x, including handling the removal of contract keys and working with the new JSON Ledger API v2.