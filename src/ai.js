const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONSENSUS_SYSTEM_PROMPT = `You are helping a parish team synthesize their individual "Definition of Done" responses for kanban board items into a consensus definition.

You will receive a kanban item title and multiple team members' descriptions of what "done" means for that item.

Your job:
1. Identify common themes across all responses
2. Note any significant disagreements or different perspectives
3. Produce a clear, actionable "Consensus Definition of Done" that the team can adopt

Format your response as JSON:
{
  "commonThemes": ["Theme 1", "Theme 2"],
  "disagreements": ["Disagreement 1"] or [],
  "consensusDefinition": "A clear, actionable paragraph defining what 'done' means for this item, synthesized from all responses.",
  "confidence": "high|medium|low"
}

Be direct and practical. The definition should be specific enough that any team member can look at it and know whether the item is done or not.`;

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
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse AI response as JSON');
  }
}

module.exports = { generateConsensus };
