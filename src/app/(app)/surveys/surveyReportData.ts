import {
  daysAgoWIBKey,
  endOfMonthWIBKey,
  endOfPreviousMonthWIBKey,
  endOfYearWIBKey,
  startOfMonthWIBKey,
  startOfPreviousMonthWIBKey,
  startOfYearWIBKey,
  todayWIBKey,
} from "@/lib/date";

export type SurveyReportTab = "input" | "report";

export type SurveyReportDatePreset =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "lastMonth"
  | "ytd"
  | "year";

export type SurveyReportFilter = {
  tab: SurveyReportTab;
  from: string;
  to: string;
  outlet: string;
  rangeWasReversed?: boolean;
};

export type SurveyReportResponseRow = {
  question_id: string;
  answer_id: string | null;
  other_text: string | null;
  outlet_id: string;
  survey_questions: { question_text: string } | null;
  survey_answers: { label: string } | null;
  outlets: { name: string } | null;
};

export type SurveyReportAnswer = {
  label: string;
  count: number;
  examples: string[];
};

export type SurveyReportGroup = {
  question: string;
  total: number;
  answers: SurveyReportAnswer[];
};

export type SurveyReportData = {
  totalResponses: number;
  groups: SurveyReportGroup[];
};

export type OutletCount = {
  outletId: string;
  outletName: string;
  count: number;
};

export function normalizeSurveyReportTab(value: string) {
  return value === "report" ? "report" : "input";
}

export function getSurveyReportDefaultRange() {
  return { from: daysAgoWIBKey(6), to: todayWIBKey() };
}

export function getSurveyReportPresetRange(preset: SurveyReportDatePreset) {
  if (preset === "today") return { from: todayWIBKey(), to: todayWIBKey() };
  if (preset === "7d") return { from: daysAgoWIBKey(6), to: todayWIBKey() };
  if (preset === "30d") return { from: daysAgoWIBKey(29), to: todayWIBKey() };
  if (preset === "month")
    return { from: startOfMonthWIBKey(), to: endOfMonthWIBKey() };
  if (preset === "lastMonth") {
    return {
      from: startOfPreviousMonthWIBKey(),
      to: endOfPreviousMonthWIBKey(),
    };
  }
  if (preset === "ytd")
    return { from: startOfYearWIBKey(), to: todayWIBKey() };
  return { from: startOfYearWIBKey(), to: endOfYearWIBKey() };
}

export function isSurveyReportPresetActive(
  filter: Pick<SurveyReportFilter, "from" | "to">,
  preset: SurveyReportDatePreset,
) {
  const range = getSurveyReportPresetRange(preset);
  return filter.from === range.from && filter.to === range.to;
}

export function hasActiveSurveyReportFilter(
  filter: Pick<SurveyReportFilter, "from" | "to" | "outlet">,
) {
  const defaultRange = getSurveyReportDefaultRange();
  return (
    filter.from !== defaultRange.from ||
    filter.to !== defaultRange.to ||
    !!filter.outlet
  );
}

export function buildSurveyReportData(
  responses: SurveyReportResponseRow[],
): SurveyReportData {
  const map = new Map<
    string,
    {
      question: string;
      total: number;
      answers: Map<string, SurveyReportAnswer>;
    }
  >();

  for (const row of responses) {
    const questionText =
      row.survey_questions?.question_text ?? "Pertanyaan tidak ditemukan";
    const group = map.get(row.question_id) ?? {
      question: questionText,
      total: 0,
      answers: new Map<string, SurveyReportAnswer>(),
    };
    group.total += 1;

    const key = row.answer_id ?? "__other";
    const label = row.answer_id
      ? (row.survey_answers?.label ?? "Jawaban dihapus")
      : "Lainnya";
    const answer = group.answers.get(key) ?? { label, count: 0, examples: [] };
    answer.count += 1;
    if (!row.answer_id && row.other_text && answer.examples.length < 5) {
      answer.examples.push(row.other_text);
    }
    group.answers.set(key, answer);
    map.set(row.question_id, group);
  }

  return {
    totalResponses: responses.length,
    groups: [...map.values()]
      .map((group) => ({
        ...group,
        answers: [...group.answers.values()].sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total),
  };
}

export function buildOutletCounts(
  responses: SurveyReportResponseRow[],
): OutletCount[] {
  const map = new Map<string, { name: string; count: number }>();
  for (const row of responses) {
    const existing = map.get(row.outlet_id) ?? {
      name: row.outlets?.name ?? "Outlet dihapus",
      count: 0,
    };
    existing.count += 1;
    map.set(row.outlet_id, existing);
  }
  return [...map.entries()]
    .map(([outletId, info]) => ({
      outletId,
      outletName: info.name,
      count: info.count,
    }))
    .sort((a, b) => b.count - a.count);
}
