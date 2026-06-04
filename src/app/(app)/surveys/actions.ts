"use server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, type Profile } from "@/lib/auth";
import { todayWIBKey } from "@/lib/date";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SurveyResponseSchema = z.object({
  question_id: z.string().uuid("Pertanyaan tidak valid"),
  answer_id: z.string().uuid("Jawaban tidak valid").optional().or(z.literal("")),
  outlet_id: z.string().uuid("Outlet tidak valid"),
  other_text: z.string().trim().max(200, "Jawaban lainnya maksimal 200 karakter").optional(),
});

function cleanPayload(formData: FormData, profile: Profile) {
  const raw = Object.fromEntries(formData);
  if (profile.role === "kasir") {
    if (!profile.outlet_id) {
      return { error: "Profil kasir belum diassign ke outlet" } as const;
    }
    raw.outlet_id = profile.outlet_id;
  }

  const parsed = SurveyResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data survey tidak valid" } as const;
  }

  const data = parsed.data;
  const answerId = data.answer_id || null;
  const otherText = data.other_text?.trim() || null;
  if (!answerId && !otherText) {
    return { error: "Pilih jawaban atau isi jawaban lainnya" } as const;
  }

  return {
    data: {
      question_id: data.question_id,
      answer_id: answerId,
      outlet_id: data.outlet_id,
      other_text: answerId ? null : otherText,
    },
  } as const;
}

export async function createSurveyResponse(formData: FormData) {
  const profile = await requireProfile();
  const payload = cleanPayload(formData, profile);
  if ("error" in payload) return { error: payload.error };

  const supabase = await createClient();
  const { data: question, error: questionError } = await supabase
    .from("survey_questions")
    .select("id,is_active")
    .eq("id", payload.data.question_id)
    .maybeSingle();
  if (questionError) return { error: questionError.message };
  if (!question?.is_active) return { error: "Pertanyaan survey tidak aktif" };

  if (payload.data.answer_id) {
    const { data: relation, error: relationError } = await supabase
      .from("survey_question_answers")
      .select("answer_id,is_active,survey_answers(is_active)")
      .eq("question_id", payload.data.question_id)
      .eq("answer_id", payload.data.answer_id)
      .eq("is_active", true)
      .maybeSingle();
    if (relationError) return { error: relationError.message };
    const linkedAnswer = relation?.survey_answers as { is_active?: boolean } | null;
    if (!relation || !linkedAnswer?.is_active) {
      return { error: "Jawaban tidak tersedia untuk pertanyaan ini" };
    }
  }

  const { error } = await supabase.from("survey_responses").insert({
    ...payload.data,
    created_by: profile.id,
    response_date: todayWIBKey(),
  });
  if (error) return { error: error.message };

  revalidatePath("/surveys");
  return { ok: true };
}
