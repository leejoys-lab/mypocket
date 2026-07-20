// Vercel 서버리스 함수: 닉네임별 스크랩보드 데이터 저장/조회
//
// Vercel 대시보드 → 프로젝트 → Storage 탭 → Marketplace에서
// "Upstash Redis" (Upstash for Redis) 연동을 추가하면
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// (또는 예전 이름 KV_REST_API_URL / KV_REST_API_TOKEN)
// 환경변수가 이 프로젝트에 자동으로 주입됩니다. 별도 코드 수정은 필요 없어요.

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const NICK_RE = /^[^\s]{1,40}$/; // 공백 없이 1~40자

function keyFor(nickname) {
  return `scrapboard:v1:${nickname}`;
}

export default async function handler(req, res) {
  if (!REST_URL || !REST_TOKEN) {
    res.status(500).json({
      error:
        "서버에 저장소가 연결되어 있지 않아요. Vercel 프로젝트의 Storage 탭에서 Upstash Redis 연동을 추가한 뒤 다시 배포해주세요.",
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const nickname = String(req.query?.nickname || "").trim();
      if (!NICK_RE.test(nickname)) {
        res.status(400).json({ error: "닉네임이 올바르지 않아요." });
        return;
      }
      const r = await fetch(`${REST_URL}/get/${encodeURIComponent(keyFor(nickname))}`, {
        headers: { Authorization: `Bearer ${REST_TOKEN}` },
      });
      const j = await r.json();
      if (j.error) {
        res.status(502).json({ error: String(j.error) });
        return;
      }
      let data = null;
      if (j.result) {
        try { data = JSON.parse(j.result); } catch { data = null; }
      }
      res.status(200).json({ data });
      return;
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const nickname = String(body.nickname || "").trim();
      if (!NICK_RE.test(nickname)) {
        res.status(400).json({ error: "닉네임이 올바르지 않아요." });
        return;
      }
      if (body.data === undefined) {
        res.status(400).json({ error: "저장할 데이터가 없어요." });
        return;
      }
      const value = JSON.stringify(body.data);
      // 10MB 요청 크기 제한 (Upstash 무료/종량제 플랜 공통) 사전 체크
      if (value.length > 9_000_000) {
        res.status(413).json({ error: "저장할 데이터가 너무 커요. 이미지를 좀 줄여주세요." });
        return;
      }
      const r = await fetch(`${REST_URL}/set/${encodeURIComponent(keyFor(nickname))}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REST_TOKEN}`,
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: value,
      });
      const j = await r.json();
      if (j.error) {
        res.status(502).json({ error: String(j.error) });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "지원하지 않는 요청이에요." });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
