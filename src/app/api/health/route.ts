import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export async function GET() {
  try {
    const database = await checkDatabaseHealth();
    return NextResponse.json({
      status: "ok",
      service: "brief",
      database,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        service: "brief",
        database: {
          status: "disconnected",
          error: error instanceof Error ? error.message : "Unknown DB error",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
