import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "precheck_chat_removed", message: "准备阶段不再提供候选人准备对话框，请进入正式关卡后使用模型工作区。" },
    { status: 410 }
  );
}
