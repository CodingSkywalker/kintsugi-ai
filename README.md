# Kintsugi AI

Kintsugi AI is an autonomous, self-healing Site Reliability Engineering platform. It utilizes chaos engineering drills and large language models to detect, diagnose, and automatically repair global cloud infrastructure failures in real time.

The platform is named after the traditional Japanese art of repairing broken pottery with gold to make the object more resilient. Our software treats cloud infrastructure failures with that same philosophy. When a system breaks, our autonomous sentinel layer intercepts the fault, stabilizes the network backbone, and commits postmortem logs to a distributed database to secure the fleet.

## Core Architecture and Features

* **Global Fleet Topology:** An interactive 3D WebGL globe mapping 25 virtual infrastructure regions and 25,600 server nodes with real-time status state machines.
* **Fault Injection Suite:** Integrated chaos engineering controls to simulate regional network lag, availability zone blackouts, flash-crowd traffic surges, and data packet corruption.
* **Live Telemetry Stream:** High-frequency data charts monitoring system latency and packet throughput variations during live incidents.
* **Autonomous AI Sentry:** A deterministic language model reasoning stream that ingests structured telemetry payloads, isolates root causes, executes targeted mitigation actions, and verifies system recovery.

## Technical Stack

* **Core Framework:** Next.js, TypeScript, Tailwind CSS
* **Graphics and Visualization:** Three.js (WebGL globe engine) and Chart.js (telemetry streaming)
* **AI Orchestration:** Gemini API constrained via structural Zod safety schemas
* **Deployment Platform:** Vercel Production Environment
* **Database Layer:** Amazon Aurora DSQL (distributed PostgreSQL-compatible cluster)

## Configuration Variables

To securely connect the dashboard to the live AI backend and database nodes, the following environment variables must be configured in your Vercel project deployment or local `.env.local` file:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
DSQL_ENDPOINT=your_amazon_aurora_dsql_endpoint
AWS_REGION=your_designated_aws_region
DSQL_CLUSTER_ID=your_dsql_cluster_identifier
