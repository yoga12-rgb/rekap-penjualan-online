"use client";
import { memo, useCallback, useMemo, useState, useTransition } from "react";
import { ClipboardList, MessageSquare, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import {
  createSurveyAnswer,
  createSurveyQuestion,
  syncQuestionAnswers,
  updateSurveyAnswer,
  updateSurveyQuestion,
} from "./actions";

type Question = {
  id: string;
  question_text: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type Answer = {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type QuestionAnswer = {
  question_id: string;
  answer_id: string;
  is_active: boolean;
  sort_order: number;
};
type Editing =
  | { type: "question"; row: Question | null }
  | { type: "answer"; row: Answer | null }
  | null;

type Row = Question | Answer;

export function SurveyMasterClient({
  questions,
  answers,
  questionAnswers,
}: {
  questions: Question[];
  answers: Answer[];
  questionAnswers: QuestionAnswer[];
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [assigning, setAssigning] = useState<Question | null>(null);
  const [pending, start] = useTransition();
  const questionAnswerMap = useMemo(() => {
    const map = new Map<string, QuestionAnswer[]>();
    for (const row of questionAnswers) {
      const list = map.get(row.question_id) ?? [];
      list.push(row);
      map.set(row.question_id, list);
    }
    return map;
  }, [questionAnswers]);

  const onSubmit = useCallback(
    (form: HTMLFormElement) => {
      if (!editing) return;
      const fd = new FormData(form);

      start(async () => {
        const res =
          editing.type === "question"
            ? editing.row
              ? await updateSurveyQuestion(editing.row.id, fd)
              : await createSurveyQuestion(fd)
            : editing.row
              ? await updateSurveyAnswer(editing.row.id, fd)
              : await createSurveyAnswer(fd);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((res as any)?.error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toast((res as any).error, "error");
        } else {
          toast("Survey tersimpan", "success");
          setEditing(null);
        }
      });
    },
    [editing],
  );

  const toggleQuestion = useCallback((row: Question) => {
    const fd = new FormData();
    fd.set("question_text", row.question_text);
    fd.set("sort_order", String(row.sort_order));
    if (!row.is_active) fd.set("is_active", "on");
    start(async () => {
      const res = await updateSurveyQuestion(row.id, fd);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((res as any)?.error)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast((res as any).error, "error");
      else
        toast(
          row.is_active ? "Pertanyaan dinonaktifkan" : "Pertanyaan diaktifkan",
          "success",
        );
    });
  }, []);

  const toggleAnswer = useCallback((row: Answer) => {
    const fd = new FormData();
    fd.set("label", row.label);
    fd.set("sort_order", String(row.sort_order));
    if (!row.is_active) fd.set("is_active", "on");
    start(async () => {
      const res = await updateSurveyAnswer(row.id, fd);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((res as any)?.error)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast((res as any).error, "error");
      else
        toast(
          row.is_active ? "Jawaban dinonaktifkan" : "Jawaban diaktifkan",
          "success",
        );
    });
  }, []);

  const onAssignSubmit = useCallback(
    (form: HTMLFormElement) => {
      if (!assigning) return;
      const fd = new FormData(form);
      start(async () => {
        const res = await syncQuestionAnswers(assigning.id, fd);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((res as any)?.error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toast((res as any).error, "error");
        } else {
          toast("Relasi jawaban tersimpan", "success");
          setAssigning(null);
        }
      });
    },
    [assigning],
  );

  const handleOpenAddAnswer = useCallback(
    () => setEditing({ type: "answer", row: null }),
    [],
  );
  const handleOpenAddQuestion = useCallback(
    () => setEditing({ type: "question", row: null }),
    [],
  );
  const handleCloseEditing = useCallback(() => setEditing(null), []);
  const handleCloseAssigning = useCallback(() => setAssigning(null), []);
  const handleEdit = useCallback(
    (row: Row, type: "question" | "answer") =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEditing({ type, row: row as any }),
    [],
  );
  const handleAssign = useCallback((row: Question) => setAssigning(row), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Master Survey</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Atur pertanyaan survey dan template jawaban global.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={handleOpenAddAnswer}
          >
            <Plus size={16} />
            Jawaban
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenAddQuestion}
          >
            <Plus size={16} />
            Pertanyaan
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MasterPanel
          icon={<ClipboardList size={18} />}
          title="Pertanyaan"
          description="Kasir melihat pertanyaan aktif beserta jawaban yang sudah direlasikan."
        >
          <MasterTable
            type="question"
            rows={questions}
            pending={pending}
            questionAnswerMap={questionAnswerMap}
            onEdit={handleEdit}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onAssign={handleAssign as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onToggle={toggleQuestion as any}
          />
        </MasterPanel>

        <MasterPanel
          icon={<MessageSquare size={18} />}
          title="Template Jawaban Global"
          description="Buat jawaban global, lalu hubungkan ke pertanyaan yang relevan."
        >
          <MasterTable
            type="answer"
            rows={answers}
            pending={pending}
            onEdit={handleEdit}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onToggle={toggleAnswer as any}
          />
        </MasterPanel>
      </div>

      <Modal
        open={!!editing}
        onClose={handleCloseEditing}
        title={
          editing?.type === "question"
            ? editing.row
              ? "Edit Pertanyaan"
              : "Tambah Pertanyaan"
            : editing?.row
              ? "Edit Jawaban"
              : "Tambah Jawaban"
        }
      >
        {editing && (
          <SurveyMasterForm
            editing={editing}
            pending={pending}
            onSubmit={onSubmit}
          />
        )}
      </Modal>

      <Modal
        open={!!assigning}
        onClose={handleCloseAssigning}
        title="Atur Jawaban Pertanyaan"
        size="lg"
      >
        {assigning && (
          <QuestionAnswersForm
            key={assigning.id}
            question={assigning}
            answers={answers}
            links={questionAnswerMap.get(assigning.id) ?? []}
            pending={pending}
            onSubmit={onAssignSubmit}
          />
        )}
      </Modal>
    </div>
  );
}

const MasterPanel = memo(function MasterPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-md border"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--card)",
      }}
    >
      <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 font-bold">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
});

const MasterTable = memo(function MasterTable({
  type,
  rows,
  pending,
  questionAnswerMap,
  onEdit,
  onAssign,
  onToggle,
}: {
  type: "question" | "answer";
  rows: Row[];
  pending: boolean;
  questionAnswerMap?: Map<string, QuestionAnswer[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit: (row: any, type: "question" | "answer") => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAssign?: (row: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onToggle: (row: any) => void;
}) {
  const isQuestionTable = type === "question";

  return (
    <div className="overflow-auto">
      <table className="table">
        <thead>
          <tr>
            <th>{type === "question" ? "Pertanyaan" : "Jawaban"}</th>
            <th className="text-center">Urutan</th>
            {isQuestionTable && <th className="text-center">Jawaban</th>}
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const text =
              type === "question"
                ? (row as Question).question_text
                : (row as Answer).label;
            return (
              <MasterTableRow
                key={row.id}
                type={type}
                row={row}
                text={text}
                pending={pending}
                questionAnswerMap={questionAnswerMap}
                onEdit={onEdit}
                onAssign={onAssign}
                onToggle={onToggle}
              />
            );
          })}
          {!rows.length && (
            <tr>
              <td
                colSpan={isQuestionTable ? 5 : 4}
                className="py-8 text-center"
                style={{ color: "var(--muted)" }}
              >
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

const MasterTableRow = memo(function MasterTableRow({
  type,
  row,
  text,
  pending,
  questionAnswerMap,
  onEdit,
  onAssign,
  onToggle,
}: {
  type: "question" | "answer";
  row: Row;
  text: string;
  pending: boolean;
  questionAnswerMap?: Map<string, QuestionAnswer[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit: (row: any, type: "question" | "answer") => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAssign?: (row: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onToggle: (row: any) => void;
}) {
  const isQuestionTable = type === "question";

  return (
    <tr>
      <td className="min-w-64 font-medium">{text}</td>
      <td className="text-center tabular-nums">{row.sort_order}</td>
      {isQuestionTable && (
        <td className="text-center tabular-nums">
          {(questionAnswerMap?.get(row.id) ?? []).length}
        </td>
      )}
      <td>
        <StatusBadge active={row.is_active} />
      </td>
      <td className="whitespace-nowrap text-right">
        {isQuestionTable && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onAssign?.(row)}
          >
            Jawaban
          </button>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => onEdit(row, type)}
        >
          <Pencil size={15} />
          Edit
        </button>
        <button
          type="button"
          className={cn(
            "btn-ghost",
            row.is_active
              ? "text-red-600 dark:text-red-300"
              : "text-emerald-700 dark:text-emerald-300",
          )}
          disabled={pending}
          onClick={() => onToggle(row)}
        >
          {row.is_active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </td>
    </tr>
  );
});

const StatusBadge = memo(function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
});

const SurveyMasterForm = memo(function SurveyMasterForm({
  editing,
  pending,
  onSubmit,
}: {
  editing: Exclude<Editing, null>;
  pending: boolean;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  const isQuestion = editing.type === "question";
  const question = isQuestion ? (editing.row as Question | null) : null;
  const answer = !isQuestion ? (editing.row as Answer | null) : null;
  const active = isQuestion
    ? (question?.is_active ?? true)
    : (answer?.is_active ?? true);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e.currentTarget);
      }}
    >
      <div>
        <label className="label">{isQuestion ? "Pertanyaan" : "Jawaban"}</label>
        {isQuestion ? (
          <textarea
            className="input min-h-24"
            name="question_text"
            defaultValue={question?.question_text ?? ""}
            maxLength={300}
            required
          />
        ) : (
          <input
            className="input"
            name="label"
            defaultValue={answer?.label ?? ""}
            maxLength={120}
            required
          />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Urutan</label>
          <input
            className="input"
            name="sort_order"
            type="number"
            min={0}
            max={9999}
            step={1}
            defaultValue={
              isQuestion
                ? (question?.sort_order ?? 0)
                : (answer?.sort_order ?? 0)
            }
          />
        </div>
        <label
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={active}
            className="h-4 w-4"
          />
          Aktif
        </label>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary min-w-28" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
});

const QuestionAnswersForm = memo(function QuestionAnswersForm({
  question,
  answers,
  links,
  pending,
  onSubmit,
}: {
  question: Question;
  answers: Answer[];
  links: QuestionAnswer[];
  pending: boolean;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  const linksByAnswer = useMemo(
    () => new Map(links.map((link) => [link.answer_id, link])),
    [links],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e.currentTarget);
      }}
    >
      <div
        className="rounded-md border p-3 text-sm"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg)",
        }}
      >
        <div
          className="text-xs font-semibold uppercase"
          style={{ color: "var(--muted)" }}
        >
          Pertanyaan
        </div>
        <div className="font-bold">{question.question_text}</div>
      </div>

      <div className="space-y-2">
        {answers.map((answer) => {
          const link = linksByAnswer.get(answer.id);
          return (
            <label
              key={answer.id}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="flex min-w-0 items-start gap-2">
                <input
                  type="checkbox"
                  name="answer_id"
                  value={answer.id}
                  defaultChecked={!!link}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {answer.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {answer.is_active
                      ? "Jawaban aktif"
                      : "Jawaban global nonaktif"}
                  </span>
                </span>
              </span>
              <span>
                <span
                  className="mb-1 block text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  Urutan
                </span>
                <input
                  className="input"
                  name={`sort_order_${answer.id}`}
                  type="number"
                  min={0}
                  max={9999}
                  step={1}
                  defaultValue={link?.sort_order ?? answer.sort_order}
                />
              </span>
            </label>
          );
        })}
        {!answers.length && (
          <div
            className="rounded-md border p-4 text-center text-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted)",
            }}
          >
            Belum ada template jawaban. Buat jawaban global terlebih dahulu.
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button className="btn-primary min-w-32" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan Relasi"}
        </button>
      </div>
    </form>
  );
});
