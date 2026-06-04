"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Filter,
  Loader2,
  MessageSquareText,
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import {
  daysAgoWIBKey,
  endOfMonthWIBKey,
  startOfMonthWIBKey,
  todayWIBKey,
} from "@/lib/date";
import {
  clearScopedFilterParams,
  copyPersistentUrlParams,
  queryString,
  setScopedFilterParams,
} from "@/lib/urlParams";
import { createSurveyResponse } from "./actions";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Role = "super_admin" | "kasir";
type Tab = "input" | "report";
type Option = { id: string; name: string };
type Question = {
  id: string;
  question_text: string;
  is_active: boolean;
  sort_order: number;
};
type Answer = {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};
type AnswerLink = {
  question_id: string;
  answer_id: string;
  is_active: boolean;
  sort_order: number;
  survey_answers: Answer | null;
};
type ResponseRow = {
  id: string;
  question_id: string;
  answer_id: string | null;
  outlet_id: string;
  other_text: string | null;
  response_date: string;
  created_at: string;
  survey_questions: { question_text: string } | null;
  survey_answers: { label: string } | null;
  outlets: { name: string } | null;
};
type SurveyFilter = {
  tab: Tab;
  from: string;
  to: string;
  outlet: string;
  rangeWasReversed?: boolean;
};
type DatePreset = "today" | "7d" | "30d" | "month";
type FilterKey = "from" | "to" | "outlet";
type SurveyPieDatum = { name: string; value: number };
type SurveyPieLabelProps = {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  percent?: number;
};

const SURVEY_CHART_COLORS = [
  "#63aa00",
  "#3367c9",
  "#e23d10",
  "#ff9800",
  "#109b20",
  "#a600a8",
  "#079bc5",
  "#dc477b",
  "#7d35c8",
  "#f2c200",
];

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function renderSurveyPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: SurveyPieLabelProps) {
  if (!percent || percent < 0.075) return null;

  const centerX = Number(cx ?? 0);
  const centerY = Number(cy ?? 0);
  const inner = Number(innerRadius ?? 0);
  const outer = Number(outerRadius ?? 0);
  const radius = inner + (outer - inner) * 0.58;
  const angle = -Number(midAngle ?? 0) * (Math.PI / 180);
  const x = centerX + radius * Math.cos(angle);
  const y = centerY + radius * Math.sin(angle);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      className="pointer-events-none text-[12px] font-extrabold tabular-nums sm:text-[14px]"
      style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.28)" }}
    >
      {formatPercent(percent * 100)}
    </text>
  );
}

function presetRange(preset: DatePreset) {
  if (preset === "today") return { from: todayWIBKey(), to: todayWIBKey() };
  if (preset === "7d") return { from: daysAgoWIBKey(6), to: todayWIBKey() };
  if (preset === "month") {
    return { from: startOfMonthWIBKey(), to: endOfMonthWIBKey() };
  }
  return { from: daysAgoWIBKey(29), to: todayWIBKey() };
}

export function SurveysClient({
  role,
  myOutletId,
  questions,
  answerLinks,
  outlets,
  responses,
  filter,
}: {
  role: Role;
  myOutletId: string | null;
  questions: Question[];
  answerLinks: AnswerLink[];
  outlets: Option[];
  responses: ResponseRow[];
  filter: SurveyFilter;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterPending, startFilterTransition] = useTransition();
  const [draftFilter, setDraftFilter] = useState<SurveyFilter>({
    tab: filter.tab,
    from: filter.from,
    to: filter.to,
    outlet: filter.outlet,
  });

  useEffect(() => {
    setDraftFilter({
      tab: filter.tab,
      from: filter.from,
      to: filter.to,
      outlet: filter.outlet,
    });
  }, [filter.tab, filter.from, filter.to, filter.outlet]);

  const outletName =
    outlets.find((outlet) => outlet.id === (myOutletId || filter.outlet))?.name ??
    "";
  const totalResponses = responses.length;
  const answersByQuestion = useMemo(() => {
    const map = new Map<string, Answer[]>();
    for (const link of answerLinks) {
      const answer = link.survey_answers;
      if (!answer?.is_active || !link.is_active) continue;
      const list = map.get(link.question_id) ?? [];
      list.push({ ...answer, sort_order: link.sort_order });
      map.set(link.question_id, list);
    }
    for (const [questionId, list] of map.entries()) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
      map.set(questionId, list);
    }
    return map;
  }, [answerLinks]);

  function buildParams(nextFilter: SurveyFilter) {
    const next = new URLSearchParams();
    copyPersistentUrlParams(searchParams, next);
    next.set("tab", nextFilter.tab);
    next.set("from", nextFilter.from);
    next.set("to", nextFilter.to);
    if (nextFilter.outlet) next.set("outlet", nextFilter.outlet);
    setScopedFilterParams("surveys", next, {
      tab: nextFilter.tab,
      from: nextFilter.from,
      to: nextFilter.to,
      outlet: nextFilter.outlet,
    });
    return next;
  }

  function navigate(nextFilter: SurveyFilter) {
    const next = buildParams(nextFilter);
    startFilterTransition(() => router.push(`/surveys${queryString(next)}`));
  }

  function setTab(tab: Tab) {
    const nextFilter = { ...filter, tab };
    setDraftFilter(nextFilter);
    navigate(nextFilter);
  }

  function setDraftParam(key: FilterKey, value: string) {
    setDraftFilter((current) => ({ ...current, [key]: value }));
  }

  function applyFilter(nextFilter = draftFilter) {
    navigate({ ...nextFilter, tab: "report" });
  }

  function clearFilter() {
    const reset: SurveyFilter = {
      tab: "report",
      from: daysAgoWIBKey(29),
      to: todayWIBKey(),
      outlet: "",
    };
    const next = new URLSearchParams();
    copyPersistentUrlParams(searchParams, next);
    clearScopedFilterParams("surveys", next);
    setScopedFilterParams("surveys", next, {
      tab: reset.tab,
      from: reset.from,
      to: reset.to,
      outlet: reset.outlet,
    });
    setDraftFilter(reset);
    startFilterTransition(() => router.push(`/surveys${queryString(next)}`));
  }

  function setRangePreset(preset: DatePreset) {
    const range = presetRange(preset);
    const nextFilter = { ...filter, ...range, tab: "report" as const };
    setDraftFilter(nextFilter);
    applyFilter(nextFilter);
  }

  const hasDraftChanges =
    draftFilter.from !== filter.from ||
    draftFilter.to !== filter.to ||
    draftFilter.outlet !== filter.outlet;
  const hasActiveFilter =
    filter.from !== daysAgoWIBKey(29) ||
    filter.to !== todayWIBKey() ||
    !!filter.outlet;

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Survey Customer</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Catat dan analisis dari mana customer mengetahui produk.
          </p>
        </div>
        <div
          className="inline-flex w-full rounded-md border p-1 sm:w-auto"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <TabButton
            active={filter.tab === "input"}
            icon={<ClipboardList size={16} />}
            label="Input"
            onClick={() => setTab("input")}
          />
          <TabButton
            active={filter.tab === "report"}
            icon={<BarChart3 size={16} />}
            label="Laporan"
            onClick={() => setTab("report")}
          />
        </div>
      </div>

      {filter.tab === "input" ? (
        <SurveyInput
          role={role}
          myOutletId={myOutletId}
          outletName={outletName}
          outlets={outlets}
          questions={questions}
          answersByQuestion={answersByQuestion}
        />
      ) : (
        <SurveyReport
          role={role}
          outlets={outlets}
          filter={filter}
          draftFilter={draftFilter}
          setDraftParam={setDraftParam}
          applyFilter={() => applyFilter()}
          clearFilter={clearFilter}
          setRangePreset={setRangePreset}
          filterPending={filterPending}
          hasDraftChanges={hasDraftChanges}
          hasActiveFilter={hasActiveFilter}
          responses={responses}
          totalResponses={totalResponses}
          rangeWasReversed={filter.rangeWasReversed}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-semibold transition sm:flex-none",
        active
          ? "bg-red-600 text-white"
          : "text-slate-600 hover:bg-[var(--hover)] dark:text-slate-300",
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function SurveyInput({
  role,
  myOutletId,
  outletName,
  outlets,
  questions,
  answersByQuestion,
}: {
  role: Role;
  myOutletId: string | null;
  outletName: string;
  outlets: Option[];
  questions: Question[];
  answersByQuestion: Map<string, Answer[]>;
}) {
  const [outletId, setOutletId] = useState(
    role === "kasir" ? myOutletId ?? "" : outlets[0]?.id ?? "",
  );

  useEffect(() => {
    if (role === "kasir") setOutletId(myOutletId ?? "");
  }, [myOutletId, role]);

  const missingOutlet = role === "kasir" && !myOutletId;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-3">
        <div
          className="rounded-md border p-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Outlet</label>
              {role === "super_admin" ? (
                <select
                  className="input"
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                >
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  disabled
                  value={outletName || "(belum diassign)"}
                />
              )}
            </div>
            <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <div className="font-semibold">Input cepat</div>
              <div style={{ color: "var(--muted)" }}>
                Pilih jawaban pada satu pertanyaan, lalu simpan.
              </div>
            </div>
          </div>
        </div>

        {missingOutlet && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Akun kasir ini belum diassign ke outlet.
          </div>
        )}

        {!questions.length && (
          <EmptyState
            icon={<MessageSquareText size={20} />}
            title="Belum ada pertanyaan aktif"
            message="Super admin perlu mengaktifkan pertanyaan survey terlebih dahulu."
          />
        )}

        {questions.map((question) => (
          <SurveyQuestionCard
            key={question.id}
            question={question}
            answers={answersByQuestion.get(question.id) ?? []}
            outletId={outletId}
            disabled={!outletId || missingOutlet}
          />
        ))}
      </div>

      <aside
        className="rounded-md border p-4 text-sm lg:sticky lg:top-20 lg:self-start"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="mb-2 flex items-center gap-2 font-bold">
          <CheckCircle2 size={17} className="text-emerald-600" />
          Checklist
        </div>
        <div className="space-y-2" style={{ color: "var(--muted)" }}>
          <p>Pertanyaan dan jawaban yang tampil hanya yang aktif.</p>
          <p>Jawaban Lainnya tersimpan sebagai teks bebas dan tampil di laporan.</p>
          <p>Respon tidak dikaitkan ke transaksi.</p>
        </div>
      </aside>
    </div>
  );
}

function SurveyQuestionCard({
  question,
  answers,
  outletId,
  disabled,
}: {
  question: Question;
  answers: Answer[];
  outletId: string;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [otherText, setOtherText] = useState("");
  const [pending, start] = useTransition();
  const isOther = selected === "__other";

  function submit() {
    const fd = new FormData();
    fd.set("question_id", question.id);
    fd.set("outlet_id", outletId);
    if (isOther) fd.set("other_text", otherText);
    else fd.set("answer_id", selected);

    start(async () => {
      const res = await createSurveyResponse(fd);
      if ((res as any)?.error) {
        toast((res as any).error, "error");
      } else {
        toast("Survey tersimpan", "success");
        setSelected("");
        setOtherText("");
      }
    });
  }

  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
            Pertanyaan
          </div>
          <div className="font-bold">{question.question_text}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {!answers.length && (
          <div
            className="col-span-2 rounded-md border p-3 text-sm sm:col-span-3 lg:col-span-4"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Belum ada template jawaban untuk pertanyaan ini. Gunakan Lainnya
            atau minta admin mengatur jawaban.
          </div>
        )}
        {answers.map((answer) => (
          <button
            key={answer.id}
            type="button"
            disabled={disabled || pending}
            className={cn(
              "min-h-11 rounded-md border px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
              selected === answer.id
                ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "hover:bg-[var(--hover)]",
            )}
            style={{ borderColor: selected === answer.id ? undefined : "var(--border)" }}
            onClick={() => setSelected(answer.id)}
          >
            {answer.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || pending}
          className={cn(
            "min-h-11 rounded-md border px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
            isOther
              ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              : "hover:bg-[var(--hover)]",
          )}
          style={{ borderColor: isOther ? undefined : "var(--border)" }}
          onClick={() => setSelected("__other")}
        >
          Lainnya
        </button>
      </div>

      {isOther && (
        <div className="mt-3">
          <label className="label">Jawaban lainnya</label>
          <input
            className="input"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            maxLength={200}
            placeholder="Contoh: event komunitas"
          />
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="btn-primary min-w-32"
          disabled={disabled || pending || !selected || (isOther && !otherText.trim())}
          onClick={submit}
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Simpan
        </button>
      </div>
    </div>
  );
}

function SurveyReport({
  role,
  outlets,
  filter,
  draftFilter,
  setDraftParam,
  applyFilter,
  clearFilter,
  setRangePreset,
  filterPending,
  hasDraftChanges,
  hasActiveFilter,
  responses,
  totalResponses,
  rangeWasReversed,
}: {
  role: Role;
  outlets: Option[];
  filter: SurveyFilter;
  draftFilter: SurveyFilter;
  setDraftParam: (key: FilterKey, value: string) => void;
  applyFilter: () => void;
  clearFilter: () => void;
  setRangePreset: (preset: DatePreset) => void;
  filterPending: boolean;
  hasDraftChanges: boolean;
  hasActiveFilter: boolean;
  responses: ResponseRow[];
  totalResponses: number;
  rangeWasReversed?: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        question: string;
        total: number;
        answers: Map<string, { label: string; count: number; examples: string[] }>;
      }
    >();

    for (const row of responses) {
      const questionText =
        row.survey_questions?.question_text ?? "Pertanyaan tidak ditemukan";
      const group =
        map.get(row.question_id) ??
        {
          question: questionText,
          total: 0,
          answers: new Map(),
        };
      group.total += 1;

      const key = row.answer_id ?? "__other";
      const label = row.answer_id ? row.survey_answers?.label ?? "Jawaban dihapus" : "Lainnya";
      const answer =
        group.answers.get(key) ?? { label, count: 0, examples: [] };
      answer.count += 1;
      if (!row.answer_id && row.other_text && answer.examples.length < 5) {
        answer.examples.push(row.other_text);
      }
      group.answers.set(key, answer);
      map.set(row.question_id, group);
    }

    return [...map.values()]
      .map((group) => ({
        ...group,
        answers: [...group.answers.values()].sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);
  }, [responses]);

  return (
    <div className="space-y-4">
      <div
        className="rounded-md border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold">
            <Filter size={17} />
            Filter Laporan
          </div>
          {rangeWasReversed && (
            <span className="badge">Rentang tanggal disesuaikan</span>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Dari</label>
            <input
              className="input"
              type="date"
              value={draftFilter.from}
              onChange={(e) => setDraftParam("from", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Sampai</label>
            <input
              className="input"
              type="date"
              value={draftFilter.to}
              onChange={(e) => setDraftParam("to", e.target.value)}
            />
          </div>
          {role === "super_admin" && (
            <div>
              <label className="label">Outlet</label>
              <select
                className="input"
                value={draftFilter.outlet}
                onChange={(e) => setDraftParam("outlet", e.target.value)}
              >
                <option value="">Semua outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="btn-primary h-10 flex-1"
              disabled={filterPending || !hasDraftChanges}
              onClick={applyFilter}
            >
              {filterPending ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />}
              Terapkan
            </button>
            {(hasActiveFilter || hasDraftChanges) && (
              <button
                type="button"
                className="btn-outline h-10 w-10 p-0"
                onClick={clearFilter}
                disabled={filterPending}
                title="Reset filter"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["today", "Hari ini"],
            ["7d", "7 hari"],
            ["30d", "30 hari"],
            ["month", "Bulan ini"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="btn-outline h-8 px-3 py-1 text-xs"
              onClick={() => setRangePreset(key as DatePreset)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ReportStat label="Total Respon" value={totalResponses.toLocaleString("id-ID")} />
        <ReportStat label="Pertanyaan Terjawab" value={groups.length.toLocaleString("id-ID")} />
        <ReportStat
          label="Periode"
          value={`${filter.from} - ${filter.to}`}
          compact
        />
      </div>

      {!groups.length && (
        <EmptyState
          icon={<BarChart3 size={20} />}
          title="Belum ada respon"
          message="Ubah filter tanggal atau mulai input survey terlebih dahulu."
        />
      )}

      {groups.map((group) => (
        <div
          key={group.question}
          className="min-w-0 rounded-md border p-3 sm:p-4"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
                Pertanyaan
              </div>
              <h2 className="text-sm font-bold leading-snug sm:text-base">{group.question}</h2>
            </div>
            <span className="badge">{group.total.toLocaleString("id-ID")} respon</span>
          </div>

          <div className="grid min-w-0 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-center xl:grid-cols-[20rem_minmax(0,1fr)]">
            <SurveyPieChart answers={group.answers} total={group.total} />
            <div className="min-w-0 space-y-3">
              {group.answers.map((answer, index) => {
                const percent = group.total ? (answer.count / group.total) * 100 : 0;
                return (
                  <div key={answer.label} className="min-w-0">
                    <div className="mb-1 grid min-w-0 gap-1 text-sm sm:flex sm:items-center sm:justify-between sm:gap-3">
                      <span className="flex min-w-0 items-start gap-2">
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              SURVEY_CHART_COLORS[index % SURVEY_CHART_COLORS.length],
                          }}
                        />
                        <span className="min-w-0 break-words font-semibold leading-snug sm:truncate">
                          {answer.label}
                        </span>
                      </span>
                      <span
                        className="pl-5 text-xs tabular-nums sm:shrink-0 sm:pl-0 sm:text-sm"
                        style={{ color: "var(--muted)" }}
                      >
                        {answer.count.toLocaleString("id-ID")} - {formatPercent(percent)}
                      </span>
                    </div>
                    <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 sm:h-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(percent, answer.count ? 2 : 0)}%`,
                          backgroundColor:
                            SURVEY_CHART_COLORS[index % SURVEY_CHART_COLORS.length],
                        }}
                      />
                    </div>
                    {!!answer.examples.length && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {answer.examples.map((example) => (
                          <span key={example} className="badge">
                            {example}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SurveyPieChart({
  answers,
  total,
}: {
  answers: Array<{ label: string; count: number }>;
  total: number;
}) {
  const data = answers.map((answer) => ({
    name: answer.label,
    value: answer.count,
  }));

  return (
    <div
      className="relative h-[236px] overflow-hidden rounded-md border p-1.5 sm:h-72 sm:p-2 lg:h-80"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="38%"
            outerRadius="80%"
            paddingAngle={0}
            stroke="#fff"
            strokeWidth={2}
            label={renderSurveyPieLabel}
            labelLine={false}
          >
            {data.map((item, index) => (
              <Cell
                key={item.name}
                fill={SURVEY_CHART_COLORS[index % SURVEY_CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            content={<SurveyPieTooltip total={total} />}
            wrapperStyle={{ zIndex: 30 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div
          className="text-xs font-semibold uppercase"
          style={{ color: "var(--muted)" }}
        >
          Total
        </div>
        <div className="text-xl font-extrabold tabular-nums">
          {total.toLocaleString("id-ID")}
        </div>
        <div
          className="text-xs font-semibold"
          style={{ color: "var(--muted)" }}
        >
          respon
        </div>
      </div>
    </div>
  );
}

function SurveyPieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: SurveyPieDatum;
    value?: number | string;
    name?: string;
    color?: string;
  }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const name = item.payload?.name ?? item.name ?? "-";
  const count = Number(item.value ?? item.payload?.value ?? 0);
  const percent = total ? (count / total) * 100 : 0;

  return (
    <div
      className="-translate-y-16 rounded-md border px-3 py-2 text-sm shadow-xl"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--fg)",
        boxShadow: "0 12px 30px color-mix(in oklab, #000 35%, transparent)",
      }}
    >
      <div className="flex items-center gap-2 font-bold">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: item.color ?? "#dc2626" }}
        />
        <span>{name}</span>
      </div>
      <div className="mt-1 tabular-nums" style={{ color: "var(--muted)" }}>
        {count.toLocaleString("id-ID")} respon - {formatPercent(percent)}
      </div>
    </div>
  );
}

function ReportStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className={cn("mt-1 font-extrabold", compact ? "text-sm" : "text-xl")}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div
      className="rounded-md border p-6 text-center"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300">
        {icon}
      </div>
      <div className="font-bold">{title}</div>
      <div className="text-sm" style={{ color: "var(--muted)" }}>
        {message}
      </div>
    </div>
  );
}
