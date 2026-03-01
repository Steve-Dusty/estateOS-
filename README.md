# EstateOS

An AI-powered real estate operating system built for agents and clients. EstateOS combines an interactive property map, 3D environment generation, live video walkthroughs, a real-time knowledge graph, and an AI voice assistant into a single unified platform.

## Overview

**Agent Dashboard** — A command center for real estate agents with an interactive Mapbox property map, portfolio overview, client management, and an AI Intelligence module that builds a live knowledge graph from conversations — tracking persons, topics, and relationships in real time.

**Client Portal** — An immersive experience for buyers and renters featuring:
- **World Builder** — Generate panoramic and 3D scenes from natural language descriptions of spaces
- **Odyssey** — Stream live AI-generated video walkthroughs of neighborhoods and properties
- **Agent Chat** — Connect directly with your agent via voice (LiveKit) for real-time guidance

## Tech Stack

| Category | Technologies |
|---|---|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| 3D / Graphics | Three.js, react-force-graph-3d |
| Maps | Mapbox GL |
| Real-time | Socket.IO, LiveKit |
| AI / LLM | Google Gemini, OpenAI |
| Voice | ElevenLabs, LiveKit Agents |
| Video | OdysseyML |
| Tooling | Composio (email), PDFKit |
| Database | SQLite (better-sqlite3) |
| Server | Node.js custom server via tsx |

## Team

- [AnanthKini1](https://github.com/AnanthKini1)
- [SanjayMarathe](https://github.com/SanjayMarathe)

## How to Run

### Prerequisites

- Node.js 18+
- API keys for: Google Gemini, OpenAI, LiveKit, ElevenLabs, Mapbox, Composio

### Setup

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the project root and add your API keys.

3. Start the development server:

```bash
npm run dev
```

This runs the custom server (`server.ts`) which handles both Next.js and Socket.IO on the same port.

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other Scripts

```bash
npm run build    # Production build
npm run start    # Production server
npm run lint     # Lint the codebase
npm run seed     # Seed the database with sample data
```
