const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONSENSUS_SYSTEM_PROMPT = `You are helping a parish team synthesize their individual "Definition of Done" responses for kanban board items into a Kanban-style Definition of Done.

You will receive a kanban item title and multiple team members' descriptions of what "done" means for that item.

CRITICAL: Follow Kanban Definition of Done best practices. The consensus DoD must be:
- A checklist of OBSERVABLE, VERIFIABLE acceptance criteria — not aspirational statements
- Each criterion must be something a team member can objectively confirm as done or not done
- Use concrete, measurable language: specific numbers, frequencies, artifacts, or observable behaviors
- Avoid vague/philosophical language like "strong relationships," "visible harmony," "actively demonstrate care"
- Instead, translate those sentiments into checkable items (e.g., "Monthly community event held with 50%+ attendance" instead of "strong community bonds")

Your job:
1. Identify common themes across all responses
2. Detect OUTLIER responses — if most respondents agree on a direction but one or two are significantly different, treat those as outliers. The consensus should reflect the majority view.
3. Note any significant disagreements or outlier perspectives separately
4. Produce a Kanban-style "Consensus Definition of Done" as a bullet-point checklist of verifiable criteria, weighted toward the majority view
5. Assign a confidence score from 0-100 reflecting how aligned the team is (100 = perfect agreement, 50 = moderate disagreement, below 30 = major splits)

Format your response as JSON:
{
  "commonThemes": ["Theme 1", "Theme 2"],
  "disagreements": ["Disagreement 1"] or [],
  "outliers": ["Person X had a notably different view: ..."] or [],
  "consensusDefinition": "A bullet-point checklist of observable, verifiable criteria that define 'done' for this item. Each bullet should be something you can check off.",
  "confidence": 85
}

GOOD example consensus: "- At least 2 parish social events per quarter with 60%+ member attendance\\n- Conflict resolution process documented and communicated to all members\\n- New member welcome program active with assigned buddy within first 2 weeks\\n- Annual satisfaction survey shows 80%+ positive response rate on community questions"

BAD example consensus: "Parishioners have developed strong relationships characterized by mutual respect and love, with visible harmony and minimal conflicts."

The DoD goes on a physical kanban board in an office. Make it practical and checkable.`;

async function generateConsensus(itemTitle, responses) {
  const formatted = responses.map((r, i) => {
    const label = r.name || 'Respondent ' + (i + 1);
    return label + ' (importance: ' + r.importance + '/5):\n' + r.definition_of_done;
  }).join('\n\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: CONSENSUS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: 'Item: "' + itemTitle + '"\n\nTeam responses:\n\n' + formatted + '\n\nGenerate the consensus. Respond with valid JSON only, no markdown fences.'
    }]
  });

  const text = message.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    console.error('[AI] Failed to parse response directly, trying regex. Raw:', text.substring(0, 500));
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    console.error('[AI] Regex fallback also failed. Full response:', text);
    throw new Error('Failed to parse AI response as JSON');
  }
}

module.exports = { generateConsensus };
