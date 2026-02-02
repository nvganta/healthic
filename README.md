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

## Roadmap

### LLM-as-Judge for Goal Decomposition

Currently, when a user sets a goal, the agent (Gemini) decomposes it into weekly targets and daily actions. This decomposition is stored directly without any validation — there's no check that weekly targets sum correctly, that pacing is progressive, or that the plan is safe and realistic.

The proposed improvement is to add a second LLM call that acts as a judge, similar to how we already use LLM-as-judge for our Opik evaluations (actionability, safety, personalization). After the agent generates a decomposed plan but before it gets saved to the database, a reviewer LLM would evaluate the plan against criteria like:

- **Mathematical consistency** — Do weekly target values sum to the overall goal target?
- **Progressive pacing** — Does intensity build gradually rather than front-loading?
- **Safety** — Are daily actions realistic and not dangerous (e.g., no extreme calorie restriction, no overtraining for beginners)?
- **Completeness** — Does every week have daily actions? Are there gaps?
- **Realism** — Is the timeline feasible for the goal type?

If the plan fails review, the tool would return an error to the agent with specific feedback, prompting it to regenerate a better plan. This creates a self-correcting loop without requiring human intervention.

This mirrors the eval pipeline we already have for chat responses, extending the same LLM-as-judge pattern to plan generation.
