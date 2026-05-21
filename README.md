# Pearl List

A React Native / Expo app for grocery shopping lists and on-demand delivery, with a companion web app sharing the same favorites and accounts.

## Stack

- **Expo** SDK 54 · **React Native** 0.81 · **React** 19
- **React Navigation** (bottom tabs)
- **i18next** (FR / EN)
- **AsyncStorage** for local persistence
- **Jest** + **babel-jest** for tests

## Project layout

```
.
├── App.js                 # Main app shell (screens still inline — being progressively extracted)
├── index.js               # Expo entry point
├── i18n.js                # i18next setup
├── babel.config.js
├── jest.config.js
├── app.json               # Expo app manifest (bundle IDs, permissions…)
│
├── assets/                # Icon, splash, favicon, adaptive icon (replace with brand art before publishing)
├── components/
│   ├── SearchPopup.js
│   └── ui/                # Small reusable UI primitives
│       ├── Toast.js
│       └── RepeatButton.js
├── services/              # API clients (auth, orders, products, delivery, shops, …)
├── utils/                 # Pure helpers (spellcheck, openCamera, distributionMode)
├── lib/                   # (reserved for shared helpers as App.js is split)
├── data/                  # Static JSON (product catalog, search map, dictionaries)
├── locales/               # i18n JSON files
│
├── __tests__/             # Jest test suites
├── scripts/
│   └── archive/           # Historical one-off patch / migration scripts
└── .github/               # CI workflows + Dependabot config
```

## Getting started

### Prerequisites
- Node.js 20+
- npm
- iOS Simulator (Xcode) or Android Emulator, or the Expo Go app on a physical device

### Install

```bash
npm install --legacy-peer-deps
```

### Run

```bash
npm start              # starts Metro + Expo dev server
npm test               # runs Jest with coverage threshold
```

Then press `i` (iOS), `a` (Android), or `w` (web) in the Expo CLI, or scan the QR code with Expo Go.

### Build for web

```bash
npx expo export --platform web --output-dir dist
```

### Build for stores (EAS)

```bash
npx eas build --platform ios
npx eas build --platform android
```

## Environment

The app reads the API base URL from `app.json` → `expo.extra.pearlBaseUrl`. To override per-environment, use EAS profiles (`eas.json`) with `"extra": { "pearlBaseUrl": "…" }` overrides.

## Testing

```bash
npm test                     # run all tests
npm test -- --coverage       # with coverage report
npm test -- --watch          # watch mode
```

Coverage reports land in `coverage/` (gitignored).

## Linting / formatting

```bash
npm run lint                 # ESLint (Expo + Prettier)
npm run format               # Prettier write
```

## Contributing

- All PRs run the CI workflow defined in [.github/workflows/ci.yml](.github/workflows/ci.yml): lint, Jest, web export.
- Dependabot keeps dependencies up to date ([.github/dependabot.yml](.github/dependabot.yml)).

## License

ISC
