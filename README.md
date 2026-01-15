# Healthic

A health resolution agent that actually helps you stick to your goals.

## What is this?

Healthic is an AI-powered health coach built for the [Comet Resolution Hackathon](https://www.encodeclub.com/programmes/comet-resolution-v2-hackathon). Unlike passive fitness trackers that wait for you to log data, Healthic actively coaches you through your health resolutions.

When you say "I want to lose 20 pounds in 3 months," Healthic breaks that down into weekly targets, creates personalized meal and workout suggestions, and actually follows up when you start slipping. It notices patterns like "you always skip morning workouts" and suggests switching to evenings. It connects the dots between your sleep, nutrition, exercise, and stress levels.

The agent adapts its tone based on what works for you. Some people need tough love, others need gentle encouragement. Healthic learns which approach helps you stay on track.

## Why this matters

Every January, millions of people set health resolutions. By February, most have given up. The problem is not willpower. The problem is that goals like "exercise more" are too vague, there is no accountability, and life gets in the way.

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

See [docs/evals.md](docs/evals.md) for the full evaluation framework.

## Documentation

- [The Big Picture](docs/the-big-picture.md) - Project overview and technical architecture
- [Evals](docs/evals.md) - Evaluation framework and metrics
- [Phases](docs/phases.md) - Development roadmap

## Status

Currently in development for the Comet Resolution Hackathon (January 2026).
