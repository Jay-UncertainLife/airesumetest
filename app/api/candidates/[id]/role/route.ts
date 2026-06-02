import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "role_selection_disabled", message: "候选人目标岗位由审核人员建档时确定，候选人端不能自行选择岗位。" },
    { status: 403 }
  );
}
