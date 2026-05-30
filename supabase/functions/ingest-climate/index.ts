import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const ingestKey = req.headers.get("x-ingest-key") || "";
  const expected = Deno.env.get("INGEST_API_KEY") || "";
  if (!expected || ingestKey !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }


  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { temperature, ph, tds, ntu, quality } = body || {};
  if (
    typeof temperature !== "number" ||
    typeof ph !== "number" ||
    typeof tds !== "number" ||
    typeof ntu !== "number" ||
    typeof quality !== "string"
  ) {
    return new Response("Invalid payload", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("climate_readings").insert({
    temperature,
    ph,
    tds,
    ntu,
    quality,
    source: "nodered",
  });

  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ ok: true });

  
});
