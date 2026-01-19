# Interaction Channels

This document covers the different ways users can interact with the health agent. The core idea is that the agent should be able to reach users where they are, not just when they remember to open an app.


# The Vision

A health coach that only exists inside a web app is easy to ignore. Real accountability means the agent can reach out to you through the channels you actually use. Maybe you get a text when you have skipped the gym three days in a row. Maybe the agent calls you for a weekly check-in. Maybe you prefer to do your daily logging through WhatsApp while you are on the go.

The agent stays the same regardless of the channel. It has the same memory, the same personality, the same understanding of your goals. The channel is just how the conversation happens.


# Channels

## Web Chat

This is the primary interface. A chat window on the webapp where users can have full conversations with the agent. This is where most of the detailed interactions happen, like setting up a new resolution, reviewing progress over time, or having a longer discussion about why something is not working.

The web chat has the richest experience because we can show things beyond just text. Progress charts, meal suggestions with images, workout plans with videos. But the core interaction is still conversational.

## Goals UI

A dedicated section in the webapp for managing resolutions and goals. This is not just chat, it is a structured interface where users can see their active goals, add new ones, edit existing ones, and track progress visually.

The goals UI and the chat are connected. If a user adds a goal through the UI, the agent knows about it and can reference it in conversation. If the agent helps break down a goal in chat, it shows up in the goals UI. Two ways to interact with the same underlying data.

## SMS and Messaging

The agent can send and receive text messages through services like Twilio. This is critical for proactive check-ins because users do not have to be in the app to hear from the agent.

When the agent decides it is time to check in, it can send a text. The user can reply right there in their normal messaging app. The conversation continues seamlessly. If the user wants to switch to the web for a longer discussion, they can, but they do not have to.

We might also support WhatsApp through Twilio's API since many users prefer it over SMS.

## Voice Calls

The agent can make or receive phone calls. This is the most personal touchpoint and the hardest to ignore. A weekly accountability call where the agent reviews your progress and talks through challenges could be powerful.

Voice is more complex to build because it involves speech-to-text, text-to-speech, and real-time conversation handling. But it makes the agent feel like a real coach rather than just software.


# Priority for the Hackathon

We have three weeks and two people. We cannot build everything perfectly, so we need to prioritize.

## Must Have

Web chat is the core experience and the easiest to demo. Judges need to see the agent in action, and a chat interface is the clearest way to show that. This is non-negotiable.

Goals UI is also essential because it shows we are building an application, not just a chatbot. The structured interface for managing resolutions makes the product feel complete and gives judges something tangible to click through.

## Should Have

SMS through Twilio is high impact for the demo. When we show the proactive check-in feature, being able to say "and then the user gets this text" is way more compelling than "and then if the user opens the app they would see this." Twilio's API is straightforward and we can get basic SMS working in a day.

## Nice to Have

WhatsApp support through Twilio is essentially free once we have SMS working. It is the same API with a different channel. If we have time, we add it.

Voice calls are cool but complex. We would need to integrate something like Twilio Voice or a dedicated voice AI platform. This is a stretch goal only if everything else is done and polished.


# Architecture Implications

Even though we are prioritizing web and SMS for the hackathon, we should architect the system to support multiple channels from the start. This means the agent logic is completely separate from the channel handling.

The flow looks like this. A message comes in from any channel, whether that is web, SMS, or voice. It gets normalized into a common format with the user ID, the message content, and the channel it came from. The agent processes it the same way regardless of source. The response goes back out through the appropriate channel.

This separation means adding a new channel later is just a matter of writing the adapter, not changing the agent itself. It also means all channels share the same conversation history and user context.

For tracing in Opik, we tag each interaction with its channel. This lets us evaluate whether the agent behaves differently across channels and whether certain channels are more effective for certain types of interactions.
