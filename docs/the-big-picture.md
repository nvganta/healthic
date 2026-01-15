# The Big Picture

# The Idea

We are building a health resolution agent that actively helps you stick to your health goals.

Millions of people set health resolutions like "lose 20 pounds" or "exercise more" or "sleep better." By February, most have already given up. The issue is not a lack of willpower. The issue is that these goals are vague, there is no real accountability, and life gets in the way. Traditional apps just track what you tell them. They do not adapt, they do not notice patterns, and they definitely do not check in on you when you have been slacking.

When user says "I want to lose 20 pounds in 3 months," it breaks that down into weekly targets that actually make sense. It creates meal suggestions based on what you like eating. It schedules workouts around your actual calendar. And most importantly, it pays attention.

The agent notices when the user has skipped the gym consecutively and asks what is going on. It sees that you always fail at morning workouts and suggests maybe evenings would work better. It connects the dots between your bad sleep nights and your skipped workouts the next day. It understands that health is not just one thing but a web of sleep, nutrition, exercise, stress, and mood all affecting each other.

The tone matters too. Sometimes you need tough love and sometimes you need gentle encouragement. The agent learns when to push and when to back off. It is like having a personal coach who actually knows you, not a generic chatbot reading from a script.

# The Tech Stack Overview

We are building this with Google's Agent Development Kit as the brain, Opik for evaluation and observability, a database layer for storing user data and conversation history, and deploying the whole thing on Vercel. The frontend will be a simple chat interface because that is the most natural way to interact with a health coach.

The idea is to keep things simple but properly instrumented from day one. Every decision the agent makes gets traced through Opik so we can actually see what is happening under the hood and evaluate whether the agent is making good choices.


# Google Agent Development Kit

Google's Agent Development Kit is valuable here because instead of wrestling with prompt chains and hoping for the best, ADK gives us a structured way to define agent behaviors, handle multi-turn conversations, and manage the state that builds up as the agent learns about a user over time.


We will be using the TypeScript version of ADK since we are deploying on Vercel.

One particularly useful feature is the thinking level control that comes with Gemini 3. We can adjust how much the model reasons through a problem on a per-request basis. For simple check-ins, we use lighter reasoning. For complex decisions like restructuring someone's entire workout plan because they got injured, we crank up the reasoning depth.


# Opik for Evaluation and Observability

Opik is an open-source platform from Comet that lets us trace, evaluate, and monitor everything our agent does. This is not just nice to have for a hackathon, it is essential. When a judge asks "how do you know your agent is giving good advice?" we can actually show them the data.

We are using Opik to trace every decision the agent makes. When the agent decides to send a check-in message, we log why it made that decision, what context it looked at, and what alternatives it considered. When the agent chooses a "tough love" tone instead of gentle encouragement, we capture that decision point. When the agent adapts someone's plan because they keep failing at morning workouts, we trace the reasoning.

Beyond tracing, Opik lets us run automated evaluations. We can define metrics like "was this advice actionable" or "was this check-in timing appropriate" and run them across all our traces. We can use LLM-as-a-judge to score outputs at scale. We can build test suites that run on every deploy to catch regressions.


The integration is straightforward. Opik has a Python SDK and a TypeScript SDK, plus OpenTelemetry support. Since we are using TypeScript for ADK, we will use the TypeScript SDK. Every tool call, every LLM response, every decision point gets wrapped in Opik traces automatically.


# The Database Layer

For the database, we are going with PostgreSQL with the pgvector extension. This gives us the best of both worlds. We get a proper relational database for structured data like user profiles, goals, workout logs, and check-in history. And we get vector storage for the semantic stuff like finding similar past situations or retrieving relevant context for personalization.

Here is what we are storing. User profiles with their goals, preferences, and constraints. Daily logs for sleep, nutrition, exercise, mood, and stress. Conversation history so the agent has context about past interactions. Plan snapshots so we can track how the plan has evolved over time. Pattern data so the agent can reference what it has learned about this specific user.

The vector side is important for personalization. When the agent needs to give advice about skipping a workout, it can semantically search for similar situations this user has faced before. What worked last time? What did the user say was blocking them? This makes the agent feel like it actually remembers and knows the user, not like it is starting fresh every conversation.

We might also add a simple graph layer later if we want to model the relationships between different health factors more explicitly. Sleep affects energy which affects workout performance which affects mood which affects sleep. But we will start simple with Postgres and add complexity only if we need it.


# Vercel for Deployment

We are deploying on Vercel because it is purpose-built for the kind of application we are building. We get serverless functions for the API layer, edge functions for low-latency responses, and easy integration with the frontend.

The architecture will be a Next.js app with API routes that talk to our ADK agent. The frontend is a simple chat interface where users can set goals, log their daily activities, and have conversations with the agent. The backend handles all the agent logic, database operations, and Opik instrumentation.

Vercel's AI SDK also integrates nicely with what we are building. It handles streaming responses so the user sees the agent "typing" in real-time rather than waiting for a complete response. It manages the back-and-forth of multi-turn conversations cleanly.

For the hackathon, Vercel also gives us easy sharing. We can deploy a preview for every pull request, share a live URL with judges, and not worry about infrastructure. The free tier is plenty for a hackathon project, and we get credits from the hackathon sponsors anyway.


# How It All Fits Together

Here is the flow. A user opens the app and tells the agent their resolution. The ADK agent processes this, uses Gemini to break it down into actionable pieces, and stores the plan in Postgres. Every step of this reasoning is traced in Opik.

Each day, the user can log their activities through a quick chat. The agent stores this in the database and starts building a picture of patterns and trends. If the agent notices something concerning, like three missed workouts in a row, it triggers a check-in. The decision to check in, the timing, and the tone are all traced in Opik so we can evaluate whether these decisions are good ones.

When the agent gives advice, it pulls relevant context from the database. It uses vector search to find similar past situations. It considers the user's history, preferences, and current state. Then it generates a response that is personalized and actionable. Again, all traced in Opik.

Over time, the agent adapts. If someone keeps failing at morning workouts, the agent notices this pattern and suggests a change. If tough love is not working, the agent dials back. These adaptations are logged and can be evaluated. Did the adaptation actually help? Did the user stick with the new approach?

The Opik dashboard becomes our command center. We can see how the agent is performing across all users. We can drill into specific conversations to understand what is working and what is not. We can run evaluations to score the agent on our defined metrics. And when we make changes to the agent, we can see whether those changes actually improved things.

This is not just a chatbot. It is an observable, evaluable, improvable system. And that is exactly what the hackathon is looking for.
