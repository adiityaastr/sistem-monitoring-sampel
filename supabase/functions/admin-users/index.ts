// Edge Function: admin membuat akun login (email + kata sandi) dan mengatur
// ulang kata sandi anggota tim. Kunci service role hanya ada di sini (server),
// tidak pernah di aplikasi web.
//
// POST body:
//   { action: "create", email, password, nama?, role? }  -> buat akun + daftarkan ke team_members
//   { action: "set_password", email, password }          -> ganti kata sandi (akun dibuat bila belum ada)
//
// Hanya anggota tim yang aktif dan ber-peran admin yang boleh memanggil.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Metode tidak didukung" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) siapa pemanggilnya?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Belum login" });
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  const callerEmail = who?.user?.email?.toLowerCase();
  if (whoErr || !callerEmail) return json(401, { error: "Sesi login tidak valid, silakan login ulang" });

  // 2) pemanggil harus admin aktif
  const { data: caller, error: callerErr } = await admin
    .from("team_members")
    .select("role, aktif")
    .ilike("email", callerEmail.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (callerErr) return json(500, { error: callerErr.message });
  if (!caller || !caller.aktif || caller.role !== "admin") return json(403, { error: "Hanya admin yang boleh mengelola akun" });

  // 3) validasi input
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Data tidak valid" });
  }
  const action = String(body.action ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email)) return json(400, { error: "Format email tidak valid" });
  if (password.length < MIN_PASSWORD) return json(400, { error: `Kata sandi minimal ${MIN_PASSWORD} karakter` });

  const findUserId = async (target: string): Promise<string | null> => {
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find((u) => u.email?.toLowerCase() === target);
      if (hit) return hit.id;
      if (data.users.length < 200) return null;
    }
    return null;
  };

  try {
    if (action === "create") {
      const nama = String(body.nama ?? "").trim() || null;
      const role = body.role === "admin" ? "admin" : "member";

      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: nama ? { nama } : undefined,
      });
      if (createErr) {
        if (/already|registered|exists/i.test(createErr.message)) {
          return json(409, { error: "Email ini sudah punya akun. Gunakan tombol “Atur kata sandi” di daftar anggota." });
        }
        return json(400, { error: createErr.message });
      }

      const { error: memberErr } = await admin
        .from("team_members")
        .upsert({ email, nama, role, aktif: true }, { onConflict: "email" });
      if (memberErr) return json(500, { error: `Akun dibuat, tetapi gagal mendaftarkan ke tim: ${memberErr.message}` });

      return json(200, { ok: true, created: true });
    }

    if (action === "set_password") {
      const { data: member } = await admin
        .from("team_members")
        .select("id")
        .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
        .maybeSingle();
      if (!member) return json(404, { error: "Email ini bukan anggota tim" });

      const id = await findUserId(email);
      if (id) {
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true, created: false });
      }
      // anggota terdaftar tetapi belum punya akun: buatkan sekalian
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true, created: true });
    }

    return json(400, { error: "Aksi tidak dikenal" });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
