# Repository Guidelines

Welcome to the **concert‑tickets‑management** codebase! This document gives contributors a quick reference for the most common workflows, style rules, and review expectations.

---

## Project Structure & Module Organization

```
concert-tickets-management/
├─ assets/            # Images, fonts, static files
├─ contracts/         # Smart‑contract source (Solidity, etc.)
├─ scripts/           # Build & utility scripts
├─ src/               # Application source (TypeScript/JavaScript)
├─ tests/ (optional)  # Unit / integration tests
├─ package.json       # npm/Yarn metadata
└─ README.md
```

All runtime code lives under **src**. Keep related modules together (e.g., `src/api`, `src/models`).

---

## Build, Test, and Development Commands

| Command                | What it does                                           |
|-----------------------|--------------------------------------------------------|
| `npm install`         | Install dependencies listed in `package.json`.        |
| `npm run build`       | Compile TypeScript (if used) and bundle the app.       |
| `npm run dev`         | Start a local development server with hot‑reload.      |
| `npm test`            | Run the test suite (Jest/Mocha) and output coverage. |
| `npm run lint`        | Execute ESLint/Prettier checks and fix autofixable bugs. |

These scripts are defined in **package.json** under the `scripts` field.

---

## Coding Style & Naming Conventions

* **Indentation:** 2 spaces, no tabs.
* **Semicolons:** Use semicolons consistently (TS/JS).
* **Naming:** `camelCase` for variables/functions, `PascalCase` for classes/types, `UPPER_SNAKE_CASE` for constants.
* **Files:** Use kebab‑case (`user-service.ts`) for module filenames.
* **Formatting:** Run `npm run lint -- --fix` before committing. The project uses **ESLint** + **Prettier**.

---

## Testing Guidelines

* **Framework:** Jest (configured in `jest.config.js`).
* **Location:** Tests reside in `tests/` mirroring the `src/` folder structure.
* **Naming:** Test files end with `.test.ts` or `.spec.ts`.
* **Coverage:** Aim for ≥80 % line coverage. CI will fail below this threshold.
* **Running:** `npm test` runs all tests; use `npm test -- -t "MyFeature"` to target a single suite.

---

## Commit & Pull Request Guidelines

### Commit Messages
```
type(scope): short summary

Longer description (optional).
```
*Types* – `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
*Scope* – folder or feature name, e.g., `api`, `ui`.

### Pull Requests
1. **Title** – Same format as commit type, e.g., `feat(ui): add ticket list view`.
2. **Description** – Explain the problem, solution, and any breaking changes.
3. **Link Issues** – Reference the relevant GitHub issue (`Closes #123`).
4. **Screenshots** – Include UI changes or console output when applicable.
5. **Checks** – All CI jobs (lint, build, test) must pass before merge.

---

## Security & Configuration Tips (Optional)

* Store secrets in environment variables; never commit `.env` files.
* Review third‑party dependencies with `npm audit` and address vulnerabilities.
* Follow the **principle of least privilege** when configuring smart‑contract permissions.

---

Happy coding! If you have questions, open an issue or ping the maintainers.

