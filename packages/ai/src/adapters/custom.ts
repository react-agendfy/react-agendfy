/**
 * Custom adapter — identity wrapper so users can plug ANY async function as
 * an {@link AIAdapter} (another vendor SDK, a local model, a test stub…).
 */
import { AIAdapter, AICompletionRequest, AICompletionResult } from '../types';

export function customAdapter(
  complete: (req: AICompletionRequest) => Promise<AICompletionResult>
): AIAdapter {
  return { complete: (req) => complete(req) };
}
