const CRITERIA = [
  {
    id: "community",
    short: "Community value",
    question:
      "How well does the project respond to the needs of Ex Cartiera and create value for the local community?",
  },
  {
    id: "clarity",
    short: "Clarity & evidence",
    question:
      "How clear are the proposal’s objectives, activities, and expected results, and how well are they supported by evidence and concepts?",
  },
  {
    id: "feasibility",
    short: "Feasibility",
    question:
      "How realistic and sustainable is the project’s implementation, financial plan, and approach to monitoring results?",
  },
  {
    id: "pitch",
    short: "Pitch quality",
    question:
      "How effective is the 5 min pitch, including participation by all group members and the ability to discuss and justify the proposal?",
  },
];

const ROLES = [
  { id: "student", label: "Student", quota: 8 },
  { id: "teacher", label: "Teacher", quota: 4 },
  { id: "staff", label: "Staff", quota: 4 },
];

const PRESENTATIONS = [
  { id: "p1", name: "Presentation 1" },
  { id: "p2", name: "Presentation 2" },
  { id: "p3", name: "Presentation 3" },
  { id: "p4", name: "Presentation 4" },
];

const SCORE_MIN = 1;
const SCORE_MAX = 5;

module.exports = {
  CRITERIA,
  ROLES,
  PRESENTATIONS,
  SCORE_MIN,
  SCORE_MAX,
};
