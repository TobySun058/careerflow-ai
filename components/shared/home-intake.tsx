"use client";

import demoData from "@/data/sample/demo.json";
import { ArrowRight, Sparkles, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function HomeIntake() {
  const router = useRouter();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(payload?: {
    resumeText?: string;
    jobDescription?: string;
    jobUrl?: string;
  }) {
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      if (resumeFile) {
        formData.append("resume", resumeFile);
      }
      if (payload?.resumeText) {
        formData.append("resumeText", payload.resumeText);
      }
      formData.append("jobText", payload?.jobDescription ?? jobDescription);
      formData.append("jobUrl", payload?.jobUrl ?? jobUrl);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Unable to create session.");
      }

      const body = (await response.json()) as { sessionId: string };
      router.push(`/workspace?sessionId=${body.sessionId}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-hero-radial px-5 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/80 bg-white/70 p-8 shadow-panel backdrop-blur lg:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Agentic AI track demo
            </div>
            <h1 className="mt-6 max-w-2xl font-heading text-4xl font-semibold leading-tight text-balance lg:text-6xl">
              CareerFlow AI turns a messy application sprint into a grounded workflow.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Upload a resume, add a role, and let a supervisor coordinate specialized
              agents for fit analysis, resume rewrites, outreach, interview prep, and a next-step plan.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Card className="glass-panel p-4">
                <p className="font-heading text-base font-semibold">Truth store</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  User claims stay backed by resume evidence only.
                </p>
              </Card>
              <Card className="glass-panel p-4">
                <p className="font-heading text-base font-semibold">Opportunity store</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Role and company facts stay isolated from candidate facts.
                </p>
              </Card>
              <Card className="glass-panel p-4">
                <p className="font-heading text-base font-semibold">Claim checker</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Major outputs surface lightweight source chips and traceable claims.
                </p>
              </Card>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-panel backdrop-blur lg:p-8">
            <div className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-2xl font-semibold">Start a session</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This MVP runs locally-first and only requires a Gemini API key.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium">
                Resume upload
                <Input
                  accept=".pdf,.doc,.docx,.txt,.md"
                  className="mt-2"
                  onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>

              <label className="block text-sm font-medium">
                Job description
                <Textarea
                  className="mt-2 min-h-[190px]"
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                />
              </label>

              <label className="block text-sm font-medium">
                Optional job URL
                <Input
                  className="mt-2"
                  onChange={(event) => setJobUrl(event.target.value)}
                  placeholder="https://company.com/jobs/role"
                  value={jobUrl}
                />
              </label>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1"
                  disabled={
                    loading || (!resumeFile && !jobDescription.trim() && !jobUrl.trim())
                  }
                  onClick={() => submit()}
                >
                  {loading ? "Preparing..." : "Create workspace"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  className="flex-1"
                  disabled={loading}
                  onClick={() =>
                    submit({
                      resumeText: demoData.resumeText,
                      jobDescription: demoData.jobDescription,
                      jobUrl: demoData.jobUrl
                    })
                  }
                  variant="secondary"
                >
                  Load demo data
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
