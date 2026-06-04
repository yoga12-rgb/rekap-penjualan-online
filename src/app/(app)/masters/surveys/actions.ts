"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const IdSchema = z.string().uuid();
const QuestionSchema = z.object({
  question_text: z.string().trim().min(1, "Pertanyaan wajib diisi").max(300),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.coerce.boolean().optional(),
});
const AnswerSchema = z.object({
  label: z.string().trim().min(1, "Jawaban wajib diisi").max(120),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.coerce.boolean().optional(),
});

function checkboxValue(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function parseQuestion(formData: FormData) {
  return QuestionSchema.safeParse({
    question_text: formData.get("question_text"),
    sort_order: formData.get("sort_order") || "0",
    is_active: checkboxValue(formData, "is_active"),
  });
}

function parseAnswer(formData: FormData) {
  return AnswerSchema.safeParse({
    label: formData.get("label"),
    sort_order: formData.get("sort_order") || "0",
    is_active: checkboxValue(formData, "is_active"),
  });
}

function revalidateSurveyPaths() {
  revalidatePath("/masters/surveys");
  revalidatePath("/surveys");
}

function sortOrderFor(formData: FormData, answerId: string) {
  const value = Number(formData.get(`sort_order_${answerId}`) ?? 0);
  return Number.isInteger(value) && value >= 0 ? Math.min(value, 9999) : 0;
}

export async function createSurveyQuestion(formData: FormData) {
  await requireAdmin();
  const parsed = parseQuestion(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data pertanyaan tidak valid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("survey_questions").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateSurveyPaths();
  return { ok: true };
}

export async function updateSurveyQuestion(id: string, formData: FormData) {
  await requireAdmin();
  const idResult = IdSchema.safeParse(id);
  if (!idResult.success) return { error: "ID pertanyaan tidak valid" };
  const parsed = parseQuestion(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data pertanyaan tidak valid" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("survey_questions")
    .update(parsed.data)
    .eq("id", idResult.data);
  if (error) return { error: error.message };
  revalidateSurveyPaths();
  return { ok: true };
}

export async function createSurveyAnswer(formData: FormData) {
  await requireAdmin();
  const parsed = parseAnswer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data jawaban tidak valid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("survey_answers").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateSurveyPaths();
  return { ok: true };
}

export async function updateSurveyAnswer(id: string, formData: FormData) {
  await requireAdmin();
  const idResult = IdSchema.safeParse(id);
  if (!idResult.success) return { error: "ID jawaban tidak valid" };
  const parsed = parseAnswer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data jawaban tidak valid" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("survey_answers")
    .update(parsed.data)
    .eq("id", idResult.data);
  if (error) return { error: error.message };
  revalidateSurveyPaths();
  return { ok: true };
}

export async function syncQuestionAnswers(questionId: string, formData: FormData) {
  await requireAdmin();
  const questionIdResult = IdSchema.safeParse(questionId);
  if (!questionIdResult.success) return { error: "ID pertanyaan tidak valid" };

  const selectedAnswerIds = formData
    .getAll("answer_id")
    .map((value) => String(value))
    .filter((value) => IdSchema.safeParse(value).success);
  const uniqueAnswerIds = [...new Set(selectedAnswerIds)];

  const supabase = await createClient();
  const { data: question, error: questionError } = await supabase
    .from("survey_questions")
    .select("id")
    .eq("id", questionIdResult.data)
    .maybeSingle();
  if (questionError) return { error: questionError.message };
  if (!question) return { error: "Pertanyaan tidak ditemukan" };

  const { data: existing, error: existingError } = await supabase
    .from("survey_question_answers")
    .select("answer_id")
    .eq("question_id", questionIdResult.data);
  if (existingError) return { error: existingError.message };

  const existingIds = new Set((existing ?? []).map((row) => row.answer_id as string));
  const selectedIds = new Set(uniqueAnswerIds);
  const toDelete = [...existingIds].filter((answerId) => !selectedIds.has(answerId));

  if (toDelete.length) {
    const { error } = await supabase
      .from("survey_question_answers")
      .delete()
      .eq("question_id", questionIdResult.data)
      .in("answer_id", toDelete);
    if (error) return { error: error.message };
  }

  if (uniqueAnswerIds.length) {
    const { data: activeAnswers, error: answersError } = await supabase
      .from("survey_answers")
      .select("id")
      .in("id", uniqueAnswerIds);
    if (answersError) return { error: answersError.message };

    const validAnswerIds = new Set((activeAnswers ?? []).map((row) => row.id as string));
    const rows = uniqueAnswerIds
      .filter((answerId) => validAnswerIds.has(answerId))
      .map((answerId) => ({
        question_id: questionIdResult.data,
        answer_id: answerId,
        is_active: true,
        sort_order: sortOrderFor(formData, answerId),
      }));

    if (rows.length) {
      const { error } = await supabase
        .from("survey_question_answers")
        .upsert(rows, { onConflict: "question_id,answer_id" });
      if (error) return { error: error.message };
    }
  }

  revalidateSurveyPaths();
  return { ok: true };
}
