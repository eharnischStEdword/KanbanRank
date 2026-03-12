const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONSENSUS_SYSTEM_PROMPT = `You are helping a parish team synthesize their individual "Definition of Done" responses for kanban board items into a Kanban-style Definition of Done.

You will receive a kanban item title and multiple team members' descriptions of what "done" means for that item.

ABSOLUTE RULE — NO INVENTING:
- ONLY use what respondents actually wrote. Every checklist item MUST be directly traceable to a specific respondent's words.
- Do NOT add specific numbers, percentages, or metrics that no respondent mentioned. If a respondent said "regular donations" do NOT turn that into "80% participation rate" — that number came from you, not them.
- Do NOT extrapolate or expand. If a respondent said "tithing," your checklist item is about tithing — not about "stewardship campaigns" or "donor retention" unless someone actually said those words.
- If responses are thin or few, produce a SHORT checklist and note that more input is needed. A 2-item DoD from real data is better than a 10-item DoD where 8 are invented.

REWORDING RULES:
- You MAY restructure a respondent's words into checklist format for clarity
- You MAY combine two respondents who said essentially the same thing
- You MUST NOT add substance, metrics, or specifics that aren't in the source data
- If a respondent's words are vague (e.g., "strong community"), keep them vague in the checklist and flag in "gaps" that the team needs to define measurable criteria
- Use "[needs metric]" placeholder where a number would make the criterion SMART but no respondent provided one

Your job:
1. Identify common themes across responses
2. Detect outlier responses — note them separately
3. Produce a consensus DoD checklist using ONLY what respondents actually said (reworded for clarity/checkability where appropriate)
4. Assign a confidence score (0-100) for team alignment
5. Assign a dodScore (0-100) rating how well the RESULTING DoD meets Kanban best practices:
   - 90-100: All criteria are specific, measurable, and verifiable
   - 60-89: Most criteria are checkable but some are vague
   - 30-59: Mix of checkable and aspirational criteria
   - 0-29: Mostly vague/philosophical, not actionable
6. If the DoD is incomplete or needs more team input, say so in "gaps"

Format your response as JSON:
{
  "commonThemes": ["Theme 1", "Theme 2"],
  "disagreements": ["Disagreement 1"] or [],
  "outliers": ["Person X had a notably different view: ..."] or [],
  "consensusDefinition": "Bullet-point checklist derived ONLY from respondent data",
  "confidence": 85,
  "dodScore": 45,
  "gaps": "What's missing or needs team discussion to complete this DoD" or null
}

The "gaps" field should be null only if dodScore >= 80. Otherwise, set it to a single short phrase like "Needs measurable targets" or "Needs more team responses." Maximum 10 words. No examples, no suggestions, no questions.

The DoD goes on a physical kanban board in an office. Make it practical and checkable — but ONLY from real data.`;

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
