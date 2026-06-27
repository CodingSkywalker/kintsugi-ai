import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const SYSTEM_PROMPT = `
You are Kintsugi-AI, an elite, automated Site Reliability Engineering (SRE) agent. 
Your absolute and only function is to ingest real-time AWS infrastructure error logs, identify Amazon Aurora DSQL database degradation, and output the precise commands required to auto-heal the system.

# RULES & CONSTRAINTS
1. NO CONVERSATION: Never output greetings, apologies, or conversational filler. 
2. DETERMINISTIC ACTION: If the ingested log shows latency > 500ms or a 5xx error, you must take immediate mitigation action.
`; // ✨ FIXED: Added the missing closing backtick and semicolon here!

export async function POST(request: Request) {
  try {
    // 1. Grab the simulated crash logs sent from the frontend
    const { logs } = await request.json();

    // 2. Feed the logs to Gemini and force it to return strict JSON
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      prompt: `Analyze these database logs and determine the fix: ${JSON.stringify(logs)}`,
      schema: z.object({
        incident_detected: z.boolean(),
        affected_region: z.enum(["us-east-1", "eu-central-1", "unknown"]),
        root_cause: z.string(),
        action_command: z.enum(["SCALE_CAPACITY", "REROUTE_TRAFFIC", "NO_ACTION"]),
        execution_confidence: z.number(),
      }),
    });

    // 3. Return the AI's decision directly back to the frontend
    return NextResponse.json(object);
    
  } catch (error) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}