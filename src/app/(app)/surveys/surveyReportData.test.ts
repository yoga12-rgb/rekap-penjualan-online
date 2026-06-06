import { describe, expect, it } from "vitest";
import {
  buildSurveyReportData,
  type SurveyReportResponseRow,
} from "./surveyReportData";

function row(
  overrides: Partial<SurveyReportResponseRow>,
): SurveyReportResponseRow {
  return {
    question_id: "q1",
    answer_id: "a1",
    other_text: null,
    survey_questions: { question_text: "Dari mana tahu produk?" },
    survey_answers: { label: "Instagram" },
    ...overrides,
  };
}

describe("buildSurveyReportData", () => {
  it("groups responses by question and answer, sorted by the largest totals", () => {
    const report = buildSurveyReportData([
      row({ question_id: "q1", answer_id: "a1", survey_answers: { label: "Instagram" } }),
      row({ question_id: "q1", answer_id: "a1", survey_answers: { label: "Instagram" } }),
      row({ question_id: "q1", answer_id: "a2", survey_answers: { label: "Billboard" } }),
      row({
        question_id: "q2",
        answer_id: "a3",
        survey_questions: { question_text: "Apakah akan beli lagi?" },
        survey_answers: { label: "Ya" },
      }),
    ]);

    expect(report.totalResponses).toBe(4);
    expect(report.groups).toEqual([
      {
        question: "Dari mana tahu produk?",
        total: 3,
        answers: [
          { label: "Instagram", count: 2, examples: [] },
          { label: "Billboard", count: 1, examples: [] },
        ],
      },
      {
        question: "Apakah akan beli lagi?",
        total: 1,
        answers: [{ label: "Ya", count: 1, examples: [] }],
      },
    ]);
  });

  it("keeps at most five other-answer examples and handles deleted labels", () => {
    const report = buildSurveyReportData([
      ...["A", "B", "C", "D", "E", "F"].map((other_text) =>
        row({ answer_id: null, other_text }),
      ),
      row({ answer_id: "deleted", survey_answers: null }),
      row({ question_id: "missing", survey_questions: null }),
    ]);

    expect(report.groups[0]).toEqual({
      question: "Dari mana tahu produk?",
      total: 7,
      answers: [
        { label: "Lainnya", count: 6, examples: ["A", "B", "C", "D", "E"] },
        { label: "Jawaban dihapus", count: 1, examples: [] },
      ],
    });
    expect(report.groups[1]).toEqual({
      question: "Pertanyaan tidak ditemukan",
      total: 1,
      answers: [{ label: "Instagram", count: 1, examples: [] }],
    });
  });
});
