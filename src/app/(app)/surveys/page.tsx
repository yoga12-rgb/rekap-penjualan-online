import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SurveysClient } from "./SurveysClient";
import {
  daysAgoWIBKey,
  firstParam,
  isValidDateKey,
  todayWIBKey,
} from "@/lib/date";
import { uuidParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = {
  tab?: string | string[];
  from?: string | string[];
  to?: string | string[];
  outlet?: string | string[];
  survey_tab?: string | string[];
  survey_from?: string | string[];
  survey_to?: string | string[];
  survey_outlet?: string | string[];
};

function tabParam(value: string) {
  return value === "report" ? "report" : "input";
}

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const activeTab = tabParam(
    firstParam(params.tab) || firstParam(params.survey_tab),
  );
  const rawFrom = firstParam(params.from) || firstParam(params.survey_from);
  const rawTo = firstParam(params.to) || firstParam(params.survey_to);
  let from = isValidDateKey(rawFrom) ? rawFrom : daysAgoWIBKey(29);
  let to = isValidDateKey(rawTo) ? rawTo : todayWIBKey();
  let rangeWasReversed = false;
  if (from > to) {
    [from, to] = [to, from];
    rangeWasReversed = true;
  }

  const outlet =
    profile.role === "super_admin"
      ? uuidParam(firstParam(params.outlet) || firstParam(params.survey_outlet))
      : "";

  let outletsQuery = supabase.from("outlets").select("id,name").order("name");
  if (profile.role === "kasir") {
    outletsQuery = profile.outlet_id
      ? outletsQuery.eq("id", profile.outlet_id)
      : outletsQuery.is("id", null);
  }

  let responsesQuery = supabase
    .from("survey_responses")
    .select(
      "id,question_id,answer_id,outlet_id,other_text,response_date,created_at,survey_questions(question_text),survey_answers(label),outlets(name)",
    )
    .gte("response_date", from)
    .lte("response_date", to)
    .order("response_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (profile.role === "kasir") {
    responsesQuery = profile.outlet_id
      ? responsesQuery.eq("outlet_id", profile.outlet_id)
      : responsesQuery.is("outlet_id", null);
  }
  if (outlet) responsesQuery = responsesQuery.eq("outlet_id", outlet);

  const [{ data: questions }, { data: answerLinks }, { data: outlets }, { data: responses }] =
    await Promise.all([
      supabase
        .from("survey_questions")
        .select("id,question_text,is_active,sort_order")
        .eq("is_active", true)
        .order("sort_order")
        .order("question_text"),
      supabase
        .from("survey_question_answers")
        .select("question_id,answer_id,is_active,sort_order,survey_answers!inner(id,label,is_active,sort_order)")
        .eq("is_active", true)
        .eq("survey_answers.is_active", true)
        .order("sort_order")
        .order("sort_order", { referencedTable: "survey_answers" }),
      outletsQuery,
      responsesQuery,
    ]);

  return (
    <SurveysClient
      role={profile.role}
      myOutletId={profile.outlet_id}
      questions={(questions ?? []) as any}
      answerLinks={(answerLinks ?? []) as any}
      outlets={(outlets ?? []) as any}
      responses={(responses ?? []) as any}
      filter={{ tab: activeTab, from, to, outlet, rangeWasReversed }}
    />
  );
}
