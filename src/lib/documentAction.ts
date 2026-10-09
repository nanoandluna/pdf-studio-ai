import { toastError } from '@components/toast';
import { toFriendlyError } from './errors';

/** Keep rejected document operations visible to users and out of unhandled promises. */
export async function runDocumentAction(action: () => Promise<unknown>): Promise<boolean> {
  try { await action(); return true; }
  catch (error) { toastError(toFriendlyError(error, '操作失败，请重试。').friendly); return false; }
}
