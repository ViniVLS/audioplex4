// supabase/functions/queue-reorder/index.ts
// PATCH /queue-reorder
// Body: { items: [{ id: string, position: number }, ...] }
// Atualiza as posições em batch (drag-and-drop). Depois chama
// compact_queue() para garantir posições contíguas (0,1,2,...).

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts';

interface ReorderBody {
  items?: Array<{ id: string; position: number }>;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'PATCH') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { userId, supabase } = await authenticate(req);

    let body: ReorderBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Body JSON inválido.', 400);
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse('items deve ser um array não-vazio.', 400);
    }

    // Atualiza cada item (RLS valida ownership)
    const updates = await Promise.all(
      body.items!.map((item) =>
        supabase
          .from('queue_items')
          .update({ position: item.position })
          .eq('id', item.id)
          .eq('user_id', userId), // defesa em profundidade
      ),
    );

    const failed = updates.find((r) => r.error);
    if (failed?.error) {
      console.error('queue-reorder update error:', failed.error);
      return errorResponse('Erro ao reordenar itens.', 500);
    }

    // Compacta posições (função SECURITY INVOKER, RLS ainda protege)
    const admin = getSupabaseAdmin();
    const { error: compactErr } = await admin.rpc('compact_queue', { p_user_id: userId });
    if (compactErr) {
      console.warn('queue-reorder compact_queue warning:', compactErr);
    }

    return json({ success: true, updated: body.items.length });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('queue-reorder fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});
