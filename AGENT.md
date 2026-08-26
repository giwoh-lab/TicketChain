# AGENT.md – AI Assistant Guidance for the Concert Ticket Management Project

## Purpose
This document provides context, architectural guidance, and coding standards for an AI coding assistant (Codex) working on the **Concert Ticket Management** system – a Web3 application that sells concert tickets using a custom Solidity contract. The development workflow is **Remix‑first** for Solidity and a separate lightweight frontend.

---

## High‑Level Architecture
```
concert-tickets-management/
├─ contracts/                # Solidity contracts (Remix IDE)
│   └─ Ticket.sol            # Core ticket contract (to be created in Remix)
├─ scripts/                  # Optional helper scripts (e.g., deployment via Remix scripts)
├─ src/                      # Frontend (plain HTML/JS, no framework required)
│   ├─ pages/                # Static HTML pages (frontend.html, etc.)
│   └─ styles/               # CSS styles (frontend.css)
├─ package.json              # Project metadata (may contain dev dependencies for tooling)
├─ README.md                 # Project overview and setup instructions
└─ AGENT.md                  # THIS FILE – AI guidance
```