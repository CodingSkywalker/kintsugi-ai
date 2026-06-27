import { NextResponse } from 'next/server';

// 🌪️ THE CHAOS ENGINE: Generates fake infrastructure failures on command
export async function POST(request: Request) {
  try {
    const { chaos_type } = await request.json();

    let simulatedLogs = [];

    if (chaos_type === "INJECT_LATENCY") {
      simulatedLogs = [
        { "timestamp": new Date().toISOString(), "region": "eu-central-1", "error_code": "504", "latency_ms": 895 },
        { "timestamp": new Date().toISOString(), "region": "eu-central-1", "error_code": "504", "latency_ms": 912 }
      ];
    } else if (chaos_type === "SIMULATE_BLACKOUT") {
      simulatedLogs = [
        { "timestamp": new Date().toISOString(), "region": "us-east-1", "error_code": "500", "latency_ms": 4500 },
        { "timestamp": new Date().toISOString(), "region": "us-east-1", "error_code": "503", "latency_ms": 0 }
      ];
    } else {
      // Default healthy state if no specific chaos is triggered
      simulatedLogs = [
        { "timestamp": new Date().toISOString(), "region": "us-east-1", "error_code": "200", "latency_ms": 12 }
      ];
    }

    // Return the corrupted logs back to the dashboard so the UI can display them
    return NextResponse.json({
      status: "chaos_active",
      trigger: chaos_type,
      logs: simulatedLogs
    });

  } catch (error) {
    return NextResponse.json({ error: "Failed to generate chaos" }, { status: 500 });
  }
}