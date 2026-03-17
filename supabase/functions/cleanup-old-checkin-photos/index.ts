import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'check-in-photos';
const RETENTION_DAYS = 60;

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 5000 });

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let deleted = 0;
    const pathsToNull: string[] = [];

    for (const folder of files ?? []) {
      if (folder.name === '.emptyFolderPlaceholder') continue;
      const { data: items } = await supabase.storage.from(BUCKET).list(folder.name);
      for (const item of items ?? []) {
        const match = item.name?.match(/^(\d{4}-\d{2}-\d{2})-(in|out)\.jpg$/);
        if (!match) continue;
        const [, dateStr] = match;
        if (dateStr >= cutoffStr) continue;

        const path = `${folder.name}/${item.name}`;
        const { error: delError } = await supabase.storage.from(BUCKET).remove([path]);
        if (!delError) {
          deleted++;
          pathsToNull.push(path);
        }
      }
    }

    for (const path of pathsToNull) {
      const col = path.endsWith('-in.jpg') ? 'check_in_photo_url' : 'check_out_photo_url';
      await supabase.from('attendances').update({ [col]: null }).eq(col, path);
    }

    return new Response(
      JSON.stringify({ deleted, message: `Deleted ${deleted} files older than ${RETENTION_DAYS} days` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
