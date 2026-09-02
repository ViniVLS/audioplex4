// supabase/functions/queue-clear/index.ts
// DELETE /queue-clear
// Remove todos os itens da fila do usuário autenticado.

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'DELETE') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { supabase, userId } = await authenticate(req);

    const { error, count } = await supabase
      .from('queue_items')
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      console.error('queue-clear error:', error);
      return errorResponse('Erro ao limpar fila.', 500);
    }

    return json({ success: true, removed: count ?? 0 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('queue-clear fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});
