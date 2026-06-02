import { NextResponse } from "next/server";
import { now, readStore, writeStore } from "@/lib/store";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ jobRoles: store.jobRoles });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const store = await readStore();
  const job = store.jobRoles.find((item) => item.id === body.id) ?? store.jobRoles[0];
  if (!job) return NextResponse.json({ error: "job role not found" }, { status: 404 });
  job.name = body.name ?? job.name;
  job.difficulty = body.difficulty ?? job.difficulty;
  job.description = body.description ?? job.description;
  job.enabled = body.enabled ?? job.enabled;
  job.ability_dimensions = body.ability_dimensions ?? job.ability_dimensions;
  job.basic_participation = body.basic_participation ?? job.basic_participation;
  job.ability_participation = body.ability_participation ?? job.ability_participation;
  job.updated_at = now();
  await writeStore(store);
  return NextResponse.json({ jobRole: job });
}
