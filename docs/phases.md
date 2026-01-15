# Phases

This document breaks down the project into phases. Each phase builds on the previous one, and by the end we should have a fully working health resolution agent with proper evaluation infrastructure.


# Phase 1 - Foundation

This phase is about getting all the pipes connected. No fancy features, just the basic infrastructure working end to end.

We start by setting up the Next.js project and deploying it to Vercel. Nothing special here, just the standard create-next-app with the app router. We make sure the deployment pipeline works so we can push changes and see them live immediately.

Next we set up the Neon database. We create the basic tables we will need like users, conversations, and messages. We do not need the full schema yet, just enough to prove that the app can read and write to the database. We also enable the pgvector extension even though we will not use it until later.

Then we connect ADK to Gemini. We create a simple API route that takes a message, sends it to Gemini through ADK, and returns the response. At this point it is just a basic chatbot with no health-specific logic. The goal is to make sure ADK is working correctly.

Finally we wire up Opik. Every request to the agent should create a trace that we can see in the Opik dashboard. We are not doing anything sophisticated with the traces yet, just making sure they show up.

By the end of this phase we should have a simple chat interface where you can talk to Gemini, messages get stored in Neon, and every conversation shows up in Opik. It is boring but it proves everything is connected.


# Phase 2 - Core Agent

This phase is about building the actual health agent logic. We take the generic chatbot from Phase 1 and turn it into something that understands health resolutions.

We start with resolution intake. When a user says something like "I want to lose 20 pounds in 3 months," the agent should recognize this as a goal and start a structured intake flow. It asks clarifying questions about current weight, activity level, dietary preferences, schedule constraints, and anything else relevant to creating a realistic plan.

Then we build goal decomposition. The agent takes the high-level resolution and breaks it down into weekly targets and daily actions. Losing 20 pounds becomes a weekly calorie deficit target, which becomes meal suggestions and workout schedules. The decomposition should be personalized based on what the user said during intake.

We expand the database schema to store all this properly. User profiles with their goals and preferences. Plans with weekly and daily targets. We also start storing conversation history so the agent has context for future interactions.

We add daily logging. Users should be able to tell the agent what they did today, whether that is a workout, a meal, their sleep, or how they are feeling. The agent stores this and acknowledges it appropriately.

All of this gets traced in Opik. We start adding more structured traces, not just "request in, response out" but actual decision points like "parsed this as a weight loss goal" or "decomposed into these weekly targets."

By the end of this phase we should have an agent that can take a health resolution, break it into a plan, and track daily progress. It is not smart yet but it has the core functionality.


# Phase 3 - Intelligence

This phase is where the agent gets smart. We add the features that make it feel like an actual coach rather than a form with a chatbot attached.

We start with pattern detection. The agent looks at the user's history and identifies patterns. They always skip workouts after bad sleep. They do well during the week but fall off on weekends. Morning workouts fail but evening ones stick. These patterns get stored and used to inform future interactions.

Then we build proactive check-ins. Instead of waiting for the user to come to the agent, the agent reaches out when it notices something concerning. Three missed workouts in a row triggers a check-in. A sudden drop in mood logs triggers a check-in. The timing and decision to check in gets traced so we can evaluate whether these decisions were good.

We add tone calibration. The agent learns whether this user responds better to tough love or gentle encouragement. Some people need a push, others need support. The agent tracks what works and adjusts its communication style accordingly. Each tone decision gets traced.

We implement plan adaptation. When something is not working, the agent suggests changes. If morning workouts keep getting skipped, it suggests switching to evenings. If a meal plan is too restrictive, it suggests modifications. The agent explains its reasoning based on the patterns it has observed.

We add vector search for context retrieval. When the agent needs to give advice, it searches for similar past situations this user has faced. What worked before? What did not? This makes the advice feel personalized rather than generic.

By the end of this phase the agent should feel genuinely intelligent. It notices things, it reaches out at the right times, it adapts to what works for each user.


# Phase 4 - Evals

This phase is about implementing the evaluation framework from our evals doc. This is what will make us stand out in the hackathon because we can actually prove our agent works.

We start with the basic eval infrastructure. We set up the ability to run evals against traces in Opik. We create scoring functions that can be applied to traces either in real-time or in batch.

We implement the decision quality evals. Check-in timing appropriateness, tone matching, and plan adaptation relevance. For each of these we create an LLM-as-judge prompt that can score a trace on that dimension.

We implement the advice quality evals. Actionability, personalization accuracy, and context utilization. These are critical because they directly measure whether the agent is giving useful advice.

We implement the conversation quality evals. Goal decomposition quality, follow-up coherence, and appropriate escalation. These measure whether the agent is good at having productive conversations over time.

We build the safety eval suite. Harmful advice detection, sensitive topic handling, and hallucination detection. These run on every trace, not just samples, because safety is non-negotiable.

We create synthetic test scenarios. We cannot wait for real users to generate enough data, so we create simulated user journeys that cover the key scenarios. A user who is doing well. A user who is struggling. A user who brings up sensitive topics. A user with conflicting constraints. We run these through the agent and evaluate the results.

By the end of this phase we should have a comprehensive eval suite that can score the agent across all the dimensions we care about. We can show judges real numbers about how the agent performs.


# Phase 5 - Polish

This phase is about getting ready for the hackathon demo. Everything should already work, now we make it presentable.

We clean up the UI. The chat interface should look good and feel responsive. We add appropriate loading states, error handling, and visual feedback. Nothing fancy, just polished.

We build a demo flow. We create a specific scenario that showcases all the features. A user sets a resolution, the agent creates a plan, the user logs progress, the agent notices a pattern, the agent reaches out with a well-timed check-in, the user gets personalized advice. We practice this flow until it is smooth.

We prepare the Opik dashboard for the demo. We make sure we have good example traces that show the evaluation scores. We set up views that highlight the interesting decisions the agent made.

We write documentation for judges. A clear README that explains what we built, why it matters, and how to try it. We highlight the eval story because that is our differentiator.

We do edge case testing. We try to break the agent with weird inputs and make sure it handles them gracefully. We fix any obvious issues.

By the end of this phase we should be ready to demo. The app works, looks good, and we can tell a compelling story about how we built an observable and evaluable health agent.
