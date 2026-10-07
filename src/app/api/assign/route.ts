/**
 * POST /api/assign
 *
 * Confirms a recommendation and triggers GitHub assignment + email.
 * Body: { recommendationId: number, developerId: number }
 */

import { NextRequest } from "next/server";
import { confirmAssignment } from "@/lib/services/assignment.service";

export async function POST(req: NextRequest) {
  let body: { recommendationId: number; developerId: number };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { recommendationId, developerId } = body;

  if (!recommendationId || !developerId) {
    return Response.json(
      { error: "recommendationId and developerId are required" },
      { status: 400 }
    );
  }

  const result = await confirmAssignment(recommendationId, developerId);

  if (!result.success && result.message.includes("not found")) {
    return Response.json({ error: result.message }, { status: 404 });
  }

  return Response.json(result);
}
