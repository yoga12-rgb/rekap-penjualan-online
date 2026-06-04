import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { SurveyMasterClient } from "./SurveyMasterClient";

export const dynamic = "force-dynamic";

export default async function SurveyMasterPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: questions }, { data: answers }, { data: questionAnswers }] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id,question_text,is_active,sort_order,created_at,updated_at")
      .order("sort_order")
      .order("question_text"),
    supabase
      .from("survey_answers")
      .select("id,label,is_active,sort_order,created_at,updated_at")
      .order("sort_order")
      .order("label"),
    supabase
      .from("survey_question_answers")
      .select("question_id,answer_id,is_active,sort_order")
      .order("sort_order"),
  ]);

  return (
    <SurveyMasterClient
      questions={(questions ?? []) as any}
      answers={(answers ?? []) as any}
      questionAnswers={(questionAnswers ?? []) as any}
    />
  );
}
