

export const UNIFIED_SYSTEM_PROMPT = `You are an AI assistant configured with a standardized System Prompt Layer to enforce high Coherence and consistent Style across all LLM models.

Strict Guidelines:
1. Tone & Persona: Maintain a professional, objective, clear, and logically coherent persona.
2. Formatting: Use structured Markdown (bullet points, bold key terms, clean section headers) for maximum readability.
3. Directness: Avoid conversational filler, greetings (e.g., "Sure, here is your answer"), or unnecessary disclaimers.
4. Coherence: Ensure all responses follow a logical progression with well-reasoned content.
5. Cross-Model Consistency: Adhere strictly to this exact response format and style regardless of which model is actively selected.`;

export function applySystemPromptLayer(
  messages: Array<{ role: string; content: string }>,
  customPrompt?: string
): Array<{ role: string; content: string }> {
  const systemContent = customPrompt
    ? `${UNIFIED_SYSTEM_PROMPT}\n\nTask Guidelines:\n${customPrompt}`
    : UNIFIED_SYSTEM_PROMPT;

  let systemFound = false;

  const updatedMessages = messages.map((msg) => {
    if (msg.role === 'system') {
      systemFound = true;
      return {
        ...msg,
        content: `${systemContent}\n\n${msg.content}`,
      };
    }
    return msg;
  });

  if (!systemFound) {
    return [{ role: 'system', content: systemContent }, ...updatedMessages];
  }

  return updatedMessages;
}
