"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import mammoth from "mammoth/mammoth.browser";
import BackLink from "@/app/components/BackLink";
import { InterviewerEvaluation } from "@/lib/types";

const emptyEvaluation: InterviewerEvaluation = {
  round_no: 1,
  interviewer_name: "",
  interview_stage: "",
  evaluation_text: "",
  recommendation: ""
};

export default function NewCandidatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetRole, setTargetRole] = useState("AI 产品经理");
  const [targetDifficulty, setTargetDifficulty] = useState("L2");
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [evaluations, setEvaluations] = useState<InterviewerEvaluation[]>([{ ...emptyEvaluation }]);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    setResumeFileName(file.name);
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".docx")) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setResumeText(result.value.trim());
      return;
    }
    if (lowerName.endsWith(".txt")) {
      setResumeText(await file.text());
      return;
    }
    if (lowerName.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      setResumeText((await extractPdfText(arrayBuffer)).trim());
      return;
    }
    setError("当前支持 .docx、.txt、.pdf 简历解析。");
  }

  function updateEvaluation(index: number, key: keyof InterviewerEvaluation, value: string) {
    setEvaluations((current) => current.map((item, i) => i === index ? { ...item, [key]: key === "round_no" ? Number(value) : value } : item));
  }

  async function createAndAnalyze() {
    setLoading(true);
    setError("");
    setResultUrl("");
    try {
      const createRes = await fetch("/api/admin/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          target_role: targetRole,
          target_difficulty: targetDifficulty,
          resume_text: resumeText,
          resume_file_name: resumeFileName,
          interviewer_evaluations: evaluations.filter((item) => item.evaluation_text.trim())
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.message ?? createData.error);
      const analyzeRes = await fetch(`/api/admin/candidates/${createData.candidate.id}/analyze`, { method: "POST" });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.message ?? analyzeData.error);
      setResultUrl(analyzeData.invite_url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <BackLink />
      <h1 className="title">创建候选人档案</h1>
      <section className="panel">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="field"><label>候选人姓名</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>目标岗位</label><input className="input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} /></div>
          <div className="field"><label>目标难度</label><select className="select" value={targetDifficulty} onChange={(e) => setTargetDifficulty(e.target.value)}>{["L1","L2","L3","L4","L5"].map((level) => <option key={level}>{level}</option>)}</select></div>
        </div>
        <div className="field">
          <label>简历文件</label>
          <input className="input" type="file" accept=".txt,.pdf,.docx" onChange={(event) => handleFile(event.target.files?.[0])} />
          {resumeFileName ? <span className="badge">已上传：{resumeFileName}</span> : null}
        </div>
        <div className="field">
          <label>简历文本预览</label>
          <textarea className="textarea" value={resumeText} onChange={(event) => setResumeText(event.target.value)} />
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>多轮面试官评价</h2>
          <button className="btn secondary" onClick={() => setEvaluations((items) => [...items, { ...emptyEvaluation, round_no: items.length + 1 }])}>新增一轮</button>
        </div>
        {evaluations.map((item, index) => (
          <div className="grid" style={{ gridTemplateColumns: "80px 1fr 1fr 1fr", marginBottom: 12 }} key={index}>
            <input className="input" type="number" value={item.round_no} onChange={(e) => updateEvaluation(index, "round_no", e.target.value)} />
            <input className="input" placeholder="面试官" value={item.interviewer_name} onChange={(e) => updateEvaluation(index, "interviewer_name", e.target.value)} />
            <input className="input" placeholder="阶段" value={item.interview_stage} onChange={(e) => updateEvaluation(index, "interview_stage", e.target.value)} />
            <input className="input" placeholder="建议" value={item.recommendation} onChange={(e) => updateEvaluation(index, "recommendation", e.target.value)} />
            <textarea className="textarea" style={{ gridColumn: "1 / -1" }} placeholder="评价正文" value={item.evaluation_text} onChange={(e) => updateEvaluation(index, "evaluation_text", e.target.value)} />
          </div>
        ))}
      </section>

      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={loading || !name.trim()} onClick={createAndAnalyze}>{loading ? "正在调用 DeepSeek 生成画像..." : "生成画像与专属链接"}</button>
        {resultUrl ? <button className="btn secondary" onClick={() => navigator.clipboard.writeText(resultUrl)}>复制链接</button> : null}
      </div>
      {resultUrl ? <p className="badge">专属链接：{resultUrl}</p> : null}
      {error ? <p className="badge cut">{error}</p> : null}
    </div>
  );
}

async function extractPdfText(arrayBuffer: ArrayBuffer) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n\n");
}
