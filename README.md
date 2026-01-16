# Healthic

A health agent that actually helps you stick to your goals.


Healthic is an AI-powered health coach built for the [Comet Resolution Hackathon](https://www.encodeclub.com/programmes/comet-resolution-v2-hackathon). Unlike passive fitness trackers that wait for you to log data, Healthic actively coaches you through your health resolutions.


Healthic solves this by being an active coach rather than a passive tracker. It checks in at the right moments, gives specific actionable advice, and adapts the plan when something is not working.

## Tech stack

- **Google Agent Development Kit (ADK)** - The agent framework that handles reasoning, multi-turn conversations, and state management
- **Gemini** - The LLM powering the agent's intelligence
- **Opik** - Tracing and evaluation platform from Comet for observability and automated evals
- **Neon** - Serverless Postgres with pgvector for user data and semantic search
- **Next.js** - Frontend and API routes
- **Vercel** - Deployment

## The eval story

This project is built with evaluation at its core. Every decision the agent makes gets traced through Opik, so we can actually measure whether the agent is doing a good job.

We evaluate things like:
- Was the check-in timing appropriate?
- Did the agent pick the right tone?
- Was the advice specific and actionable?
- Did the agent use the context it retrieved?
- Did the agent handle sensitive topics appropriately?
