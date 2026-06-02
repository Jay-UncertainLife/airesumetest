import { NextResponse } from "next/server";
import { analyzeResumeWithDeepSeek } from "@/lib/ai";
import { addCandidate, addEvent, readStore, writeStore } from "@/lib/store";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ candidates: store.candidates });
}

export async function POST(request: Request) {
  try {
    const { name, resume_text, resume_file_name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "candidate_name is required" }, { status: 400 });
    const store = await readStore();
    const candidate = addCandidate(store, name.trim());
    candidate.resume_text = resume_text ?? "";
    candidate.resume_file_name = resume_file_name ?? "";
    candidate.selected_model = "deepseek";
    candidate.persona_profile = await analyzeResumeWithDeepSeek({
      name: candidate.name,
      resumeText: candidate.resume_text ?? ""
    });
    addEvent(store, {
      candidate_id: candidate.id,
      event_type: "candidate_login",
      raw_content: `${candidate.name} 登录并创建考核会话`
    });
    addEvent(store, {
      candidate_id: candidate.id,
      event_type: "resume_profile_generated",
      raw_content: candidate.resume_text || "未提交简历文本",
      ai_summary: candidate.persona_profile.summary,
      risk_tags: candidate.persona_profile.risks
    });
    await writeStore(store);
    return NextResponse.json({ candidate });
  } catch (error) {
    return NextResponse.json(
      {
        error: "candidate_create_failed",
        message: error instanceof Error ? error.message : "unknown error"
      },
      { status: 500 }
    );
  }
}
