# Evals

This document covers how we evaluate whether our health agent is actually doing a good job. Every eval here maps to something we can trace in Opik, which means we can show judges real data instead of just saying "trust us, it works."


# Decision Quality Evals

These evals measure whether the agent is making smart decisions about when and how to interact with users.

## Check-in Timing Appropriateness

When the agent decides to reach out to a user, was it the right moment? This is tricky because timing matters a lot. Too early and the agent feels naggy, like that friend who texts you five minutes after you said you would go to the gym. Too late and the user has already spiraled into a week of skipped workouts and feels like the agent does not care.

We evaluate this by looking at the context the agent had when it made the decision. Did the user just miss one workout or three in a row? Is this a pattern or a one-off? Did something else in their life suggest they might be struggling, like bad sleep or high stress logs? The agent should be able to justify its timing based on actual signals, not arbitrary rules.

## Tone Matching

Did the agent pick the right tone given the user's current state and history? Some users respond well to tough love. Others shut down when pushed too hard. The agent needs to learn this over time and calibrate accordingly.

We evaluate this by looking at the user's recent interactions and emotional state. If someone just logged that they are stressed and exhausted, hitting them with "you need to push harder" is the wrong call. If someone has been making excuses for two weeks and responds well to direct feedback, gentle encouragement might not cut it. The agent should be matching its tone to what actually works for this specific user.

## Plan Adaptation Relevance

When the agent suggests changing something, like switching morning workouts to evening ones, does the reasoning actually match the patterns in the data? It is not enough to just suggest changes. The changes need to be grounded in what the agent has observed.

We evaluate this by checking whether the agent cited real patterns. If it says "you seem to struggle with morning workouts," we can verify that the user actually has a history of skipping or failing morning sessions. If the agent is making stuff up or pattern-matching on insufficient data, this eval catches it.


# Advice Quality Evals

These evals measure whether the advice the agent gives is actually useful.

## Actionability

Is the advice specific enough to actually do something with? This is one of the most important evals because vague advice is worthless. "Eat healthier" is not actionable. "Swap your afternoon chips for greek yogurt" is actionable. "Exercise more" fails. "Add a 20-minute walk after lunch on Tuesday and Thursday" passes.

We evaluate this by checking whether the advice contains specific actions, times, or quantities. An LLM-as-judge can score this reliably because the distinction between vague and specific is pretty clear once you see examples.

## Personalization Accuracy

Does the advice account for the user's stated constraints, preferences, and history? Or is it generic advice that could apply to anyone? If a user said they hate running and the agent suggests a running routine, that is a personalization failure. If a user mentioned they are vegetarian and the agent suggests chicken breast, that is a failure.

We evaluate this by cross-referencing the advice against the user's profile and conversation history. The agent should be pulling from what it knows about this specific person, not defaulting to generic health advice.

## Context Utilization

Did the agent actually use the relevant context it retrieved, or did it ignore important information? This is related to personalization but focuses specifically on the retrieval and reasoning step. When the agent does a vector search to find similar past situations, does it incorporate what it found into its response?

We evaluate this by looking at the trace. What context did the agent retrieve? Did that context appear in the reasoning or the final response? If the agent retrieved "user struggled with motivation last winter" and then gave advice without acknowledging seasonal patterns, that is a context utilization failure.


# Conversation Quality Evals

These evals measure whether the agent is good at having coherent, helpful conversations over time.

## Goal Decomposition Quality

When the user says "lose 20 pounds," does the agent break it down into realistic weekly targets? Good decomposition means the agent understands that 20 pounds in 3 months is about 1.5 pounds per week, which is achievable. It means creating sub-goals for nutrition, exercise, and habits rather than just saying "lose 1.5 pounds per week."

We evaluate this by checking whether the decomposed plan is mathematically reasonable, covers multiple dimensions of the goal, and includes concrete milestones. An agent that just says "okay, let's lose 20 pounds" without breaking it down fails this eval.

## Follow-up Coherence

Does the agent remember what was discussed before and build on it? If the user mentioned last week that they were traveling for work, the agent should not be confused when the user logs irregular meals. If the agent suggested trying evening workouts and the user agreed, the next check-in should reference that experiment.

We evaluate this by tracking conversation continuity. Does the agent reference previous conversations appropriately? Does it avoid asking questions that were already answered? Does it follow up on things it said it would follow up on?

## Appropriate Escalation

If someone mentions something concerning, does the agent handle it properly? This is critical for safety. If a user says they have not eaten in three days, the agent should not just say "that's not great for your goals." If someone expresses signs of disordered eating or body dysmorphia, the agent needs to recognize this and respond appropriately.

We evaluate this by testing with scenarios that should trigger escalation. The agent should acknowledge the concern, avoid giving advice that could be harmful, and suggest professional resources when appropriate. This is not about being overly cautious with everything, but about catching the cases that actually matter.


# Safety Evals

These evals are specifically about making sure the agent does not cause harm. Health is a sensitive domain and we need to get this right.

## Harmful Advice Detection

Does the agent ever give advice that could be physically harmful? Suggesting extreme calorie restriction, excessive exercise, or ignoring pain signals are all failures. The agent should stay within safe, evidence-based recommendations.

We evaluate this by running the agent through scenarios designed to elicit potentially harmful advice and checking whether it stays within safe bounds. We also monitor production traces for any advice that crosses safety lines.

## Sensitive Topic Handling

When users bring up topics like eating disorders, body image issues, mental health struggles, or injuries, does the agent respond appropriately? This means not dismissing concerns, not giving advice that could make things worse, and knowing when to recommend professional help.

We evaluate this with a test suite of sensitive scenarios. The agent should pass all of them before we consider it production-ready.

## Hallucination Detection

Did the agent make up facts about the user? This is particularly bad in a personalized health context. If the agent says "you mentioned you love running" when the user never said that, it breaks trust immediately. If the agent claims "last week you hit your protein goals" when the user did not, that is a hallucination.

We evaluate this by cross-referencing specific claims the agent makes against the actual user data. Any claim about the user's history, preferences, or past statements should be verifiable in the database.


# Outcome Tracking

These are longer-term evals that measure whether the agent is actually helping users achieve their goals. They are harder to demo in a hackathon timeframe, but we can simulate user journeys to show the framework working.

## Intervention Effectiveness

After a check-in, did the user get back on track? If the agent reached out because someone missed three workouts and then the user completed their next workout, that is a successful intervention. If the user continued to miss workouts, maybe the intervention did not work or the approach was wrong.

We track this by correlating check-in events with subsequent user behavior. Over time, we can see which types of interventions are most effective for which types of users.

## Plan Adherence Correlation

Are users following plans the agent created more than their original vague goals? This measures whether the agent's goal decomposition and planning actually helps. If users who get detailed plans from the agent stick with their resolutions longer than users who just have vague goals, that is evidence the agent is providing value.

We track this by comparing adherence rates across different plan types and measuring how long users stay engaged with their goals.


# How We Run These Evals

All of these evals run through Opik. For development, we run them on every significant change to catch regressions. For production, we sample traces and run evals continuously to monitor quality.

Some evals use heuristics, like checking whether advice contains specific numbers or times. Others use LLM-as-judge, where we have another model score the output against our criteria. The safety evals are the most strict and run on every trace, not just samples.

The Opik dashboard gives us visibility into all of this. We can see aggregate scores trending over time, drill into specific failures to understand what went wrong, and compare different versions of the agent to see if changes actually improved things.

For the hackathon demo, we will show the evals running on a set of synthetic user journeys that cover the key scenarios. This lets us demonstrate the full eval framework even without weeks of real user data.
