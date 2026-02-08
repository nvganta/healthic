# Healthic

An emotionally intelligent health coach that actually helps you stick to your goals.

Built for the [Comet Resolution Hackathon](https://www.encodeclub.com/programmes/comet-resolution-v2-hackathon) | Targeting: **Best Use of Opik** & **Health, Fitness & Wellness**

## The Problem

Most health apps are passive trackers that wait for you to log data. They don't coach you, they don't adapt when you struggle, and they definitely don't know when to push harder or ease up.

**Healthic is different.** It's an active coach that:
- Gives you a personalized plan immediately (no endless questionnaires)
- Asks smart questions only when needed
- Tracks your progress and adapts the plan when something isn't working
- Knows your tone preferences (tough love vs gentle encouragement)

## Key Features

### Smart Conversation Flow
The agent intelligently decides when to ask questions vs give a plan:
- **Specific goal + timeline?** → Immediate actionable plan
- **Vague request?** → 1-2 clarifying questions, then plan
- **Never** endless question loops

### Real-time Evaluations with Opik
Every response is automatically evaluated across multiple dimensions:

| Evaluation | What it measures |
|------------|------------------|
| **Actionability** | Is the advice specific and actionable? |
| **Safety** | Does it avoid dangerous recommendations? |
| **Personalization** | Does it consider user's preferences and constraints? |
| **Goal Decomposition** | Are weekly targets realistic and progressive? |
| **Question Quality** | Are clarifying questions focused and useful? |

### Full Observability
All agent interactions are traced through **Opik**, including:
- User input and agent responses
- Tool calls (goal saving, activity logging, pattern detection)
- Evaluation scores for every response
- Session and conversation tracking

### Adaptive Planning
- Breaks goals into weekly targets with daily actions
- Detects patterns in your behavior
- Adjusts plans based on what's working (or not)

## Opik Integration

This project showcases deep Opik integration for LLM observability:

```
User Message → Opik Trace Created
    ↓
Agent Processing → Tool Call Spans Logged
    ↓
Response Generated → Async Evaluations Triggered
    ↓
Evals Complete → Scores Logged to Opik
```

**What gets traced:**
- Every chat request with full context (user ID, session ID, conversation ID)
- Agent execution spans with model metadata
- Individual tool calls with arguments
- Evaluation results (actionability, safety, personalization scores)
- Error states and recovery

**Built-in Evals Dashboard:**
The app includes an in-app evals dashboard that shows real-time quality metrics, with a direct link to the full Opik dashboard for deeper analysis.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Agent Framework | Google Agent Development Kit (ADK) |
| LLM | Gemini 2.0 Flash |
| Observability | **Opik** (tracing + evaluations) |
| Database | Neon (Serverless Postgres + pgvector) |
| Frontend | Next.js 15 + Tailwind CSS |
| Deployment | Vercel |

## Getting Started

### Prerequisites
- Node.js 18+
- Neon database (or any Postgres)
- Google AI API key (for Gemini)
- Opik account (for tracing)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/nvganta/healthic.git
cd healthic
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Required variables:
```
DATABASE_URL=your_neon_connection_string
GOOGLE_GENAI_API_KEY=your_gemini_api_key
OPIK_API_KEY=your_opik_api_key
OPIK_WORKSPACE=your_opik_workspace
```

4. Run database migrations:
```bash
npm run db:migrate
```

5. Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to start chatting with your health coach.

## Project Structure

```
src/
├── agent/
│   ├── health-agent.ts    # Main agent definition with system prompt
│   └── tools/             # Agent tools (goals, activities, patterns)
├── app/
│   ├── api/
│   │   ├── chat/          # Main chat endpoint with Opik tracing
│   │   └── evals/         # Evaluations API
│   └── page.tsx           # Main UI
├── components/
│   ├── Chat.tsx           # Chat interface
│   └── EvalsDashboard.tsx # In-app evals viewer
└── lib/
    ├── evals/             # LLM-as-judge evaluators
    └── opik.ts            # Opik client configuration
```

## Demo

Try these prompts to see the agent in action:

1. **Specific goal (immediate plan):**
   > "I want to lose 15 pounds in 2 months"

2. **Vague goal (asks 1-2 questions first):**
   > "Help me get healthier"

3. **Goal with constraints (personalized plan):**
   > "I want to exercise more but I have bad knees"

## Future Improvements

- **LLM-as-Judge for Goal Decomposition**: Add a reviewer LLM to validate that decomposed plans are mathematically consistent, progressively paced, and safe before saving
- **Proactive Check-ins**: Schedule smart notifications based on learned optimal timing
- **Multi-modal Input**: Support photo logging for meals and exercises

## License

MIT

---

Built with Opik for the Comet Resolution Hackathon
