// supabase/functions/tracks-delete/index.ts
// DELETE /tracks-delete?id=XXX
// Remove uma track do usuário. RLS garante que só consegue deletar
// as próprias. Cascata remove também da fila (FK on delete cascade).

import { authenticate } from '../_shared/auth.ts';
import { handlePreflight, json, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'DELETE') {
    return errorResponse('Método não permitido.', 405);
  }

  try {
    const { supabase } = await authenticate(req);

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return errorResponse('Parâmetro "id" é obrigatório.', 400);
    }

    const { error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('tracks-delete error:', error);
      return errorResponse(error.message, 500);
    }

    return json({ success: true, deletedId: id });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('tracks-delete fatal:', e);
    return errorResponse('Erro interno.', 500);
  }
});
