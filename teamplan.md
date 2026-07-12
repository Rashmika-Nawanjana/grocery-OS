================================================================================
plango AI v2.0 — 3-PERSON HACKATHON WORKFLOW
================================================================================

TEAM ROLES
----------

Person 1 — Backend + AI orchestration
  Owns: Agent 1 (home inventory RAG), Agent 2 (family preferences RAG),
        Agent 8 (meal planner), Agent 12 (orchestrator), LangChain / vector store

Person 2 — External APIs + data agents
  Owns: Agent 3 (weather), Agent 4 (traffic), Agent 5 (crisis),
        Agent 7 (price scraper)

Person 3 — Frontend + demo + pitch
  Owns: Streamlit UI, 8 dynamic artifacts, Agent 6 (schedule),
        demo script + slides


================================================================================
HOUR-BY-HOUR TIMELINE
================================================================================

H0–1  SETUP
  P1: Shared repo, agent base class, RAG schema defined
  P2: OpenWeatherMap, Google Maps, NewsAPI keys + scaffolding
  P3: Streamlit skeleton — chat page, session state, sidebar layout

H1–2
  P1: Agent 1 — home inventory RAG (vector store + 10 items seeded)       [DONE]
  P2: Agent 7 — price scraper (Keells/Cargills/Arpico mock DB)            [DONE]
  P3: Chat input loop — send/receive messages, intent routing stub

H2–3
  P1: Agent 2 — family preferences RAG (Nisha/Raj/Kids, dietary filter)   [DONE]
  P2: Agent 3 — weather (OpenWeatherMap, spoilage calculator, monsoon)     [DONE]
  P3: Artifact #1 (home inventory table) + Artifact #2 (family pref cards)

H3–4
  P1: Agent 8 — meal planner (recipe KB, calls agents 1+2+3)              [DONE]
  P2: Agents 4 & 5 — traffic (Google Maps stub) + crisis (flood sim)      [DONE]
  P3: Artifact #3 (weather alert panel) + Artifact #4 (traffic display)

H4   BREAK (15–20