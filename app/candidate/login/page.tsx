"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import mammoth from "mammoth/mammoth.browser";
import FlowGuide from "@/app/components/FlowGuide";

export default function CandidateLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [error, setError] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, resume_text: resumeText, resume_file_name: resumeFileName })
      });
      const text = await res.text();
      const data = parseResponse(text);
      if (!res.ok || !data?.candidate?.id) {
        throw new Error(data?.message || data?.error || `创建候选人失败：HTTP ${res.status}`);
      }
      localStorage.setItem("candidate_id", data.candidate.id);
      router.push("/candidate/roles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建候选人失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file?: File) {
    setError("");
    setFileStatus("");
    setResumeFileName(file?.name ?? "");
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    try {
      if (lowerName.endsWith(".docx")) {
        setFileStatus("正在解析 Word 简历...");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setResumeText(result.value.trim());
        setFileStatus(result.value.trim() ? "Word 简历已解析，文本已填入下方。" : "Word 文件已读取，但没有提取到文本。");
        return;
      }

      if (lowerName.endsWith(".txt")) {
        setFileStatus("正在读取文本简历...");
        setResumeText(await file.text());
        setFileStatus("文本简历已读取。");
        return;
      }

      if (lowerName.endsWith(".pdf")) {
        setFileStatus("正在解析 PDF 简历...");
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractPdfText(arrayBuffer);
        setResumeText(text.trim());
        setFileStatus(text.trim() ? "PDF 简历已解析，文本已填入下方。" : "PDF 文件已读取，但没有提取到文本。");
        return;
      }

      if (lowerName.endsWith(".doc")) {
        setFileStatus("当前只支持 .docx，不支持旧版 .doc，请另存为 .docx 或粘贴文本。");
        return;
      }

      setFileStatus("当前只支持 .docx 和 .txt 自动读取，其他格式请粘贴文本。");
    } catch (err) {
      setError(err instanceof Error ? `简历解析失败：${err.message}` : "简历解析失败，请粘贴文本。");
    }
  }

  function parseResponse(text: string) {
    const clean = stripBom(text).trim();
    if (!clean) return null;
    if (clean.startsWith("<")) {
      throw new Error("接口返回了页面而不是 JSON。请重启 npm.cmd run dev 后再试。");
    }
    return JSON.parse(clean);
  }

  function stripBom(text: string) {
    return text.replace(/^\uFEFF/, "");
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

  return (
    <div className="container narrow with-guide">
      <FlowGuide active={0} />
      <section className="panel">
        <h1 className="title">候选人登录</h1>
        <p className="subtitle">先提交简历文本，系统会调用 DS 画像分析，并在后续 AI 产品经理闯关中动态调整追问重点。</p>
        <div className="field">
          <label>候选人姓名</label>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入姓名" />
        </div>
        <div className="field">
          <label>简历文件</label>
          <input
            className="input"
            type="file"
            accept=".txt,.pdf,.doc,.docx"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          {resumeFileName ? <span className="badge">已选择：{resumeFileName}</span> : null}
          {fileStatus ? <span className="muted">{fileStatus}</span> : null}
        </div>
        <div className="field">
          <label>简历文本</label>
          <textarea
            className="textarea"
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="请粘贴简历核心内容。MVP 阶段用文本触发 DS 人物画像分析。"
          />
        </div>
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? "DS 分析画像中..." : "提交简历并开始考核"}
        </button>
        {error ? <p className="badge cut" style={{ marginTop: 12 }}>{error}</p> : null}
      </section>
    </div>
  );
}
