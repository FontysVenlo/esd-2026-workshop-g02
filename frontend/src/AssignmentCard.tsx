export default function AssignmentCard({ challenge, scenario, assignment, criteria, tools, deliverable }: {
  challenge: string; scenario: string; assignment: string; criteria: string; tools: string; deliverable: string;
}) {
  return <section className="assignment-card" aria-label={`${challenge} assignment`}><p className="eyebrow">{challenge} · YOUR ASSIGNMENT</p><h2>{assignment}</h2><p><strong>Scenario:</strong> {scenario}</p><p><strong>Success criteria:</strong> {criteria}</p><p><strong>Available tools:</strong> {tools}</p><p><strong>Deliverable:</strong> {deliverable}</p></section>;
}
