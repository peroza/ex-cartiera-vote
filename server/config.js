const CRITERIA = [
  {
    id: "pitch",
    short: "Presentation quality and effectiveness",
    question:
      "How effective is the 5 min pitch, including participation by all group members and the ability to discuss and justify the proposal?",
  },
  {
    id: "clarity",
    short: "Project logic and clarity",
    question:
      "How clear are the proposal’s objectives, activities, and expected results, and how well are they supported by evidence and concepts?",
  },
  {
    id: "feasibility",
    short: "Feasibility of the proposal",
    question:
      "How realistic and sustainable is the project’s implementation, financial plan, and approach to monitoring results?",
  },
  {
    id: "community",
    short: "Value for the local community (impact)",
    question:
      "How well does the project respond to the needs of Ex Cartiera and create value for the local community?",
  },
];

const ROLES = [
  { id: "student", label: "Student", quota: 28, weight: 0.4 },
  { id: "teacher", label: "Teaching", quota: 5, weight: 0.7 },
  { id: "staff", label: "Cartiera staff", quota: 5, weight: 1.0 },
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
