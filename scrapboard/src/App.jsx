import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus, Sun, Moon, Trash2, Pencil, ChevronUp, ChevronDown, X, Check,
  ChevronDown as CaretDown, Image as ImageIcon, Link2, Settings2,
  ArrowUpDown, GripVertical, Copy, ExternalLink, Eye, ListOrdered, LayoutGrid, List as ListIcon, Languages, Loader2,
  CheckSquare, Square, FileSpreadsheet, AlertTriangle
} from "lucide-react";
import * as XLSX from "xlsx";

/* ───────────────────────── 유틸 ───────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const extractUrls = (text) => {
  const m = text.match(/https?:\/\/[^\s"'<>【】（）「」《》，。！？、]+/g) || [];
  return m.map((u) => u.replace(/[),.!?;:]+$/, "")).filter(Boolean);
};

const formatViews = (v) => {
  if (v === "" || v === null || v === undefined || isNaN(v)) return null;
  const n = Number(v);
  if (n >= 1) {
    const s = n % 1 === 0 ? String(n) : String(n.toFixed(1)).replace(/\.0$/, "");
    return s + "만";
  }
  return String(Math.round(n * 10000));
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("파일을 읽을 수 없어요"));
    r.readAsDataURL(file);
  });

// FileReader(data: URL) 기반 — 샌드박스에서 blob: URL이 차단되는 문제 회피.
// 캔버스 압축이 실패하면 원본 dataURL을 그대로 사용 (폴백).
const compressImage = async (file) => {
  const dataUrl = await readFileAsDataURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new window.Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("이미지 디코딩 실패"));
      im.src = dataUrl;
    });
    const MAX = 800;
    let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return dataUrl;
    const s = Math.min(1, MAX / Math.max(w, h));
    w = Math.round(w * s); h = Math.round(h * s);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const out = c.toDataURL("image/jpeg", 0.8);
    // toDataURL이 빈 값/깨진 값을 주면 원본 사용
    return out && out.startsWith("data:image") && out.length > 100 ? out : dataUrl;
  } catch {
    return dataUrl;
  }
};

// 브라우저 localStorage 기반 저장소 (기기/브라우저별로 저장됨, 용량 제한 약 5~10MB)
const store = {
  async get(k) { try { const v = window.localStorage.getItem(k); return v === null ? null : v; } catch { return null; } },
  async set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { console.error("저장 실패", e); return false; } },
  async del(k) { try { window.localStorage.removeItem(k); } catch {} },
};

const DATA_KEY = "scrapboard-data";
const THEME_KEY = "scrapboard-theme";
const IMG_KEY = (id) => "scrapimg-" + id;

const DEFAULT_CATS = [
  { id: "cat-kitchen", name: "주방·레시피" },
  { id: "cat-clean", name: "정리·청소" },
  { id: "cat-etc", name: "기타" },
];

const KEYWORD_GROUPS = [
  { title: "🏠 살림/생활용품", items: [
    ["家居好物", "집에서 쓰는 추천템, 살림 추천템"], ["居家好物", "집에서 쓰는 생활용품"],
    ["生活好物", "생활 꿀템"], ["家居神器", "집안 신박템"], ["居家神器", "집에서 쓰는 신박템"],
    ["家务神器", "집안일을 쉽게 해주는 아이템"], ["家居用品", "생활용품"], ["居家用品", "집에서 쓰는 용품"],
    ["家庭必备", "집에 꼭 있어야 하는 제품"],
  ]},
  { title: "📦 수납", items: [
    ["收纳", "수납"], ["收纳神器", "수납 신박템"], ["收纳好物", "수납 추천템"], ["家居收纳", "집 수납"],
    ["厨房收纳", "주방 수납"], ["冰箱收纳", "냉장고 수납"], ["缝隙收纳", "틈새 수납"], ["衣柜收纳", "옷장 수납"],
    ["抽屉收纳", "서랍 수납"], ["鞋柜收纳", "신발장 수납"], ["收纳技巧", "수납 팁"], ["收纳设计", "수납 아이디어"],
  ]},
  { title: "🍳 주방", items: [
    ["厨房神器", "주방 신박템"], ["厨房好物", "주방 추천템"], ["厨房用品", "주방용품"], ["厨房收纳", "주방 수납"],
    ["厨房整理", "주방 정리"], ["厨房清洁", "주방 청소"], ["厨房改造", "주방 꾸미기"],
  ]},
  { title: "🧹 청소", items: [
    ["清洁神器", "청소 신박템"], ["清洁好物", "청소 추천템"], ["家务清洁", "집안 청소"], ["地板清洁", "바닥 청소"],
    ["玻璃清洁", "유리 청소"], ["卫生间清洁", "화장실 청소"], ["清洁技巧", "청소 팁"],
  ]},
  { title: "🚿 욕실", items: [
    ["浴室好物", "욕실 추천템"], ["卫生间神器", "화장실 신박템"], ["浴室收纳", "욕실 수납"],
    ["卫生间收纳", "화장실 수납"], ["浴室用品", "욕실용품"],
  ]},
  { title: "🛏 침실", items: [
    ["卧室收纳", "침실 수납"], ["床下收纳", "침대 밑 수납"], ["衣柜整理", "옷장 정리"], ["衣柜神器", "옷장 신박템"],
  ]},
  { title: "🧺 세탁", items: [
    ["洗衣神器", "세탁 신박템"], ["洗衣好物", "세탁 추천템"], ["晾衣神器", "빨래 건조 신박템"], ["阳台收纳", "베란다 수납"],
  ]},
  { title: "🚗 차량용품", items: [
    ["车载好物", "차량 추천템"], ["车载神器", "차량 신박템"], ["汽车用品", "자동차 용품"],
    ["汽车收纳", "차량 수납"], ["汽车清洁", "차량 청소"],
  ]},
  { title: "🏡 인테리어", items: [
    ["家居设计", "인테리어 디자인"], ["装修设计", "집 인테리어"], ["装修灵感", "인테리어 아이디어"],
    ["小户型装修", "소형 평수 인테리어"], ["家居改造", "집 꾸미기"], ["软装", "홈스타일링"],
  ]},
  { title: "🔥 조회수 잘 나오는 키워드", items: [
    ["懒人神器", "귀차니즘 필수템"], ["真香", "써보니 진짜 좋음"], ["太方便了", "너무 편하다"],
    ["后悔没早买", "왜 이제 샀지"], ["提升幸福感", "삶의 질 상승"], ["高颜值", "디자인이 예쁘다"],
    ["爆款", "대박 상품, 베스트셀러"], ["推荐", "추천"], ["必买", "꼭 사야 하는 제품"], ["值得买", "살 만한 가치가 있는 제품"],
  ]},
];

/* ───────────────────────── 테마 ───────────────────────── */

const THEMES = {
  light: {
    bg: "#fafafa", panel: "#ffffff", panel2: "#f4f4f5", border: "#e4e4e7",
    text: "#18181b", sub: "#71717a", faint: "#a1a1aa",
    accent: "#0095f6", accentText: "#ffffff",
    grid: "#ffffff", placeholder: "#e9e9ec", placeholderIcon: "#a1a1aa",
    overlay: "rgba(0,0,0,0.45)", chip: "#f0f0f2", danger: "#ef4444",
    badgeBg: "rgba(0,0,0,0.62)", badgeText: "#fff",
    shadow: "0 8px 30px rgba(0,0,0,0.12)",
  },
  dark: {
    bg: "#09090b", panel: "#131316", panel2: "#1c1c21", border: "#27272d",
    text: "#f4f4f5", sub: "#a1a1aa", faint: "#63636b",
    accent: "#0095f6", accentText: "#ffffff",
    grid: "#131316", placeholder: "#1f1f25", placeholderIcon: "#63636b",
    overlay: "rgba(0,0,0,0.6)", chip: "#26262c", danger: "#f87171",
    badgeBg: "rgba(0,0,0,0.7)", badgeText: "#fff",
    shadow: "0 8px 30px rgba(0,0,0,0.5)",
  },
};

/* ───────────────────────── 메인 ───────────────────────── */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [themeName, setThemeName] = useState("light");
  const T = THEMES[themeName];

  const [categories, setCategories] = useState(DEFAULT_CATS);
  const [posts, setPosts] = useState([]); // {id,url,views,cats:[catId],sources:[{id,url,downloaded}],createdAt}
  const [orders, setOrders] = useState({ all: [] }); // viewKey -> [postId]
  const [images, setImages] = useState({}); // postId -> dataURL

  const [viewCat, setViewCat] = useState("all");
  const [sortMode, setSortMode] = useState("order"); // order | views
  const [accountOpen, setAccountOpen] = useState(false);
  const [page, setPage] = useState("board"); // board | translate

  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState("grid"); // grid | list

  const [reorderMode, setReorderMode] = useState(false);
  const [pickedId, setPickedId] = useState(null);
  const dragId = useRef(null);

  const [sourcePostId, setSourcePostId] = useState(null);
  const [editPostId, setEditPostId] = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [addOpen, setAddOpen] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);

  // confirm() / alert() 는 샌드박스에서 차단되므로 자체 UI 사용
  const [confirmReq, setConfirmReq] = useState(null); // {message, action}
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // 선택 삭제 모드
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const fileRef = useRef(null);
  const pendingImgTarget = useRef(null);

  /* ── 반응형 ── */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  /* ── 로드 ── */
  useEffect(() => {
    (async () => {
      const t = await store.get(THEME_KEY);
      if (t === "dark" || t === "light") setThemeName(t);
      const raw = await store.get(DATA_KEY);
      let d = null;
      if (raw) { try { d = JSON.parse(raw); } catch {} }
      const cats = d?.categories?.length ? d.categories : DEFAULT_CATS;
      const ps = d?.posts || [];
      const ord = d?.orders || { all: [] };
      // 순서 정합성 보정
      const fixed = fixOrders(ord, ps, cats);
      setCategories(cats); setPosts(ps); setOrders(fixed);
      // 이미지 로드
      const entries = await Promise.all(
        ps.map(async (p) => [p.id, await store.get(IMG_KEY(p.id))])
      );
      const map = {};
      for (const [id, v] of entries) if (v) map[id] = v;
      setImages(map);
      setLoaded(true);
    })();
  }, []);

  /* ── 저장 ── */
  useEffect(() => {
    if (!loaded) return;
    store.set(DATA_KEY, JSON.stringify({ categories, posts, orders }));
  }, [categories, posts, orders, loaded]);

  useEffect(() => { if (loaded) store.set(THEME_KEY, themeName); }, [themeName, loaded]);

  function fixOrders(ord, ps, cats) {
    const next = {};
    const keys = ["all", ...cats.map((c) => c.id)];
    for (const k of keys) {
      const belong = ps.filter((p) => k === "all" || (p.cats || []).includes(k)).map((p) => p.id);
      const prev = (ord[k] || []).filter((id) => belong.includes(id));
      const missing = belong.filter((id) => !prev.includes(id));
      next[k] = [...prev, ...missing];
    }
    return next;
  }

  /* ── 파생: 현재 보이는 게시물 ── */
  const visibleIds = useMemo(() => {
    const base = orders[viewCat] || [];
    if (sortMode === "views") {
      return [...base].sort((a, b) => {
        const pa = posts.find((p) => p.id === a), pb = posts.find((p) => p.id === b);
        const va = pa?.views === "" || pa?.views == null ? -1 : Number(pa.views);
        const vb = pb?.views === "" || pb?.views == null ? -1 : Number(pb.views);
        return vb - va;
      });
    }
    return base;
  }, [orders, viewCat, sortMode, posts]);

  const visiblePosts = visibleIds.map((id) => posts.find((p) => p.id === id)).filter(Boolean);
  const postById = (id) => posts.find((p) => p.id === id);
  const catName = (id) => (id === "all" ? "전체보기" : categories.find((c) => c.id === id)?.name || "?");

  /* ── 게시물 CRUD ── */
  const addPost = async ({ url, views, cats, imageFile }) => {
    const id = uid();
    const post = { id, url: url.trim(), views: views === "" ? "" : Number(views), cats, sources: [], createdAt: Date.now() };
    setPosts((p) => [...p, post]);
    setOrders((o) => {
      const n = { ...o, all: [...(o.all || []), id] };
      for (const c of cats) n[c] = [...(n[c] || []), id];
      return n;
    });
    if (imageFile) {
      try {
        const data = await compressImage(imageFile);
        setImages((m) => ({ ...m, [id]: data }));
        const ok = await store.set(IMG_KEY(id), data);
        if (!ok) showToast("이미지 영구 저장에 실패했어요. 새로고침 시 사라질 수 있어요.");
      } catch (e) {
        showToast("이미지를 등록하지 못했어요: " + (e?.message || e));
      }
    }
  };

  // 엑셀 일괄 등록: rows = [{url, views, catNames[]}]
  const bulkAdd = (rows) => {
    if (!rows.length) return;
    let cats = [...categories];
    const nameToId = {};
    cats.forEach((c) => { nameToId[c.name] = c.id; });
    const newPosts = [];
    for (const r of rows) {
      const catIds = [];
      for (const raw of r.catNames || []) {
        const n = String(raw).trim();
        if (!n) continue;
        if (!nameToId[n]) {
          const cid = "cat-" + uid();
          cats.push({ id: cid, name: n });
          nameToId[n] = cid;
        }
        catIds.push(nameToId[n]);
      }
      newPosts.push({
        id: uid(), url: r.url,
        views: r.views === "" || r.views == null ? "" : Number(r.views),
        cats: [...new Set(catIds)], sources: [], createdAt: Date.now(),
      });
    }
    setCategories(cats);
    setPosts((p) => [...p, ...newPosts]);
    setOrders((o) => {
      const n = { ...o };
      n.all = [...(n.all || []), ...newPosts.map((p) => p.id)];
      for (const c of cats) if (!n[c.id]) n[c.id] = [];
      for (const p of newPosts) for (const cid of p.cats) n[cid] = [...(n[cid] || []), p.id];
      return n;
    });
    showToast(`${newPosts.length}개 링크를 등록했어요`);
  };

  const updatePost = (id, patch) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (patch.cats) {
      setOrders((o) => {
        const n = { ...o };
        for (const c of categories) {
          const key = c.id;
          const has = patch.cats.includes(key);
          const arr = n[key] || [];
          if (has && !arr.includes(id)) n[key] = [...arr, id];
          if (!has && arr.includes(id)) n[key] = arr.filter((x) => x !== id);
        }
        return n;
      });
    }
  };

  const reallyDeletePosts = (ids) => {
    const set = new Set(ids);
    setPosts((ps) => ps.filter((p) => !set.has(p.id)));
    setOrders((o) => {
      const n = {};
      for (const k of Object.keys(o)) n[k] = o[k].filter((x) => !set.has(x));
      return n;
    });
    setImages((m) => {
      const n = { ...m };
      for (const id of ids) delete n[id];
      return n;
    });
    for (const id of ids) store.del(IMG_KEY(id));
    setSelectedIds([]);
    if (set.has(sourcePostId)) setSourcePostId(null);
    if (set.has(editPostId)) setEditPostId(null);
    showToast(ids.length > 1 ? `${ids.length}개 링크를 삭제했어요` : "링크를 삭제했어요");
  };

  const deletePost = (id) => {
    setConfirmReq({
      message: "이 링크를 삭제할까요?\n소스 목록도 함께 삭제돼요.",
      action: () => reallyDeletePosts([id]),
    });
  };

  const deleteSelected = () => {
    if (!selectedIds.length) { showToast("삭제할 항목을 먼저 선택해 주세요"); return; }
    setConfirmReq({
      message: `선택한 ${selectedIds.length}개 링크를 삭제할까요?\n소스 목록도 함께 삭제돼요.`,
      action: () => { reallyDeletePosts(selectedIds); setSelectMode(false); },
    });
  };

  const setPostImage = async (id, file) => {
    try {
      const data = await compressImage(file);
      setImages((m) => ({ ...m, [id]: data }));
      const ok = await store.set(IMG_KEY(id), data);
      if (!ok) showToast("이미지 영구 저장에 실패했어요. 새로고침 시 사라질 수 있어요.");
    } catch (e) {
      showToast("이미지를 불러오지 못했어요: " + (e?.message || e));
    }
  };

  const removePostImage = (id) => {
    setImages((m) => { const n = { ...m }; delete n[id]; return n; });
    store.del(IMG_KEY(id));
  };

  const requestImage = (postId) => {
    pendingImgTarget.current = postId;
    fileRef.current?.click();
  };

  const onFilePicked = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f && pendingImgTarget.current) setPostImage(pendingImgTarget.current, f);
    pendingImgTarget.current = null;
  };

  /* ── 순서 변경 (현재 보기 기준, 양쪽 동기화) ── */
  const moveTo = useCallback((id, targetId) => {
    if (id === targetId) return;
    setOrders((o) => {
      const arr = [...(o[viewCat] || [])];
      const from = arr.indexOf(id);
      let to = arr.indexOf(targetId);
      if (from < 0 || to < 0) return o;
      arr.splice(from, 1);
      to = arr.indexOf(targetId);
      arr.splice(from < to ? to + 1 : to, 0, id);
      return { ...o, [viewCat]: arr };
    });
  }, [viewCat]);

  const nudge = (id, dir) => {
    setOrders((o) => {
      const arr = [...(o[viewCat] || [])];
      const i = arr.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return o;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...o, [viewCat]: arr };
    });
  };

  const canReorder = sortMode === "order";

  /* ── 소스 관리 ── */
  const addSources = (postId, text) => {
    const urls = extractUrls(text);
    if (!urls.length) { showToast("텍스트에서 링크를 찾지 못했어요"); return 0; }
    setPosts((ps) => ps.map((p) =>
      p.id === postId
        ? { ...p, sources: [...(p.sources || []), ...urls.map((u) => ({ id: uid(), url: u, downloaded: false }))] }
        : p
    ));
    return urls.length;
  };
  const updateSource = (postId, srcId, patch) =>
    setPosts((ps) => ps.map((p) =>
      p.id === postId ? { ...p, sources: p.sources.map((s) => (s.id === srcId ? { ...s, ...patch } : s)) } : p
    ));
  const deleteSource = (postId, srcId) =>
    setPosts((ps) => ps.map((p) =>
      p.id === postId ? { ...p, sources: p.sources.filter((s) => s.id !== srcId) } : p
    ));

  /* ── 카테고리 관리 ── */
  const addCategory = (name) => {
    const n = name.trim();
    if (!n) return;
    const id = "cat-" + uid();
    setCategories((c) => [...c, { id, name: n }]);
    setOrders((o) => ({ ...o, [id]: [] }));
  };
  const renameCategory = (id, name) =>
    setCategories((c) => c.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x)));
  const deleteCategory = (id) => {
    setConfirmReq({
      message: `"${catName(id)}" 카테고리를 삭제할까요?\n(링크는 삭제되지 않고 카테고리 표시만 해제돼요)`,
      action: () => {
        setCategories((c) => c.filter((x) => x.id !== id));
        setPosts((ps) => ps.map((p) => ({ ...p, cats: (p.cats || []).filter((c) => c !== id) })));
        setOrders((o) => { const n = { ...o }; delete n[id]; return n; });
        if (viewCat === id) setViewCat("all");
        showToast("카테고리를 삭제했어요");
      },
    });
  };

  /* ── 그리드 아이템 클릭 ── */
  const onCellTap = (id) => {
    if (reorderMode) {
      if (!pickedId) setPickedId(id);
      else { moveTo(pickedId, id); setPickedId(null); }
      return;
    }
    if (images[id]) setSourcePostId(id);
    else requestImage(id);
  };

  /* ───────── 스타일 공통 ───────── */
  const btn = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
    border: `1px solid ${primary ? T.accent : T.border}`,
    background: primary ? T.accent : T.panel,
    color: primary ? T.accentText : T.text,
    borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600,
    lineHeight: 1, whiteSpace: "nowrap",
  });
  const iconBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, borderRadius: 8, cursor: "pointer",
    border: `1px solid ${T.border}`, background: T.panel, color: T.sub,
  };
  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "9px 11px", fontSize: 14,
    borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel2,
    color: T.text, outline: "none",
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEMES.light.bg, color: THEMES.light.sub, fontFamily: "system-ui" }}>
        불러오는 중…
      </div>
    );
  }

  /* ───────────────── 하위 뷰 ───────────────── */

  const Header = (
    <header style={{
      position: "sticky", top: 0, zIndex: 30, background: T.panel,
      borderBottom: `1px solid ${T.border}`, padding: isMobile ? "10px 14px" : "12px 20px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* 계정(카테고리) 드롭다운 */}
      {page === "board" ? (
      <div style={{ position: "relative" }}>
        <button onClick={() => setAccountOpen((v) => !v)} style={{
          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
          background: "transparent", border: "none", color: T.text, padding: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg,#feda75,#d62976,#4f5bd5)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 15,
          }}>
            {catName(viewCat).slice(0, 1)}
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{catName(viewCat)}</span>
          <CaretDown size={16} style={{ color: T.sub, transform: accountOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
        {accountOpen && (
          <>
            <div onClick={() => setAccountOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 41,
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12,
              boxShadow: T.shadow, minWidth: 200, overflow: "hidden", padding: 6,
            }}>
              {["all", ...categories.map((c) => c.id)].map((cid) => (
                <button key={cid} onClick={() => { setViewCat(cid); setAccountOpen(false); setPickedId(null); }}
                  style={{
                    display: "flex", width: "100%", alignItems: "center", gap: 8,
                    padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: viewCat === cid ? T.panel2 : "transparent", color: T.text,
                    fontSize: 14, fontWeight: viewCat === cid ? 700 : 500, textAlign: "left",
                  }}>
                  {viewCat === cid ? <Check size={15} style={{ color: T.accent }} /> : <span style={{ width: 15 }} />}
                  {catName(cid)}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: T.faint }}>
                    {(orders[cid] || []).length}
                  </span>
                </button>
              ))}
              <div style={{ height: 1, background: T.border, margin: "6px 4px" }} />
              <button onClick={() => { setCatModal(true); setAccountOpen(false); }} style={{
                display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "9px 10px",
                borderRadius: 8, border: "none", cursor: "pointer", background: "transparent",
                color: T.sub, fontSize: 13.5, textAlign: "left",
              }}>
                <Settings2 size={15} /> 카테고리 관리
              </button>
            </div>
          </>
        )}
      </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#f5576c,#f093fb)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 15,
          }}>译</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>키워드 번역기</span>
        </div>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        {/* 번역기 기능은 배포 버전에서 비활성화됨 (Anthropic API 키가 필요해 나중에 서버리스 함수로 추가 예정) */}
        {page === "board" && (
          <>
        {/* 정렬 토글 */}
        <button onClick={() => setSortMode((m) => (m === "order" ? "views" : "order"))}
          title="정렬 방식 전환"
          style={{ ...btn(sortMode === "views"), padding: "7px 10px" }}>
          {sortMode === "views" ? <Eye size={14} /> : <ListOrdered size={14} />}
          {sortMode === "views" ? "조회수순" : "저장순"}
        </button>
        {/* 순서 편집 (저장순일 때만) */}
        {canReorder && (
          <button onClick={() => { setReorderMode((v) => !v); setPickedId(null); }}
            style={{ ...btn(reorderMode), padding: "7px 10px" }}>
            <ArrowUpDown size={14} /> {reorderMode ? "편집 완료" : "순서 편집"}
          </button>
        )}
          </>
        )}
        <button onClick={() => setThemeName((t) => (t === "light" ? "dark" : "light"))} style={iconBtn} title="라이트/다크 전환">
          {themeName === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>
    </header>
  );

  const AddForm = (
    <AddFormBox
      T={T} btn={btn} inputStyle={inputStyle}
      categories={categories} open={addOpen} setOpen={setAddOpen}
      onAdd={addPost} notify={showToast}
    />
  );

  const allSelected = visiblePosts.length > 0 && visiblePosts.every((p) => selectedIds.includes(p.id));
  const toggleSelect = (id) =>
    setSelectedIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const LinkList = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 목록 도구줄 */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setBulkOpen(true)} style={{ ...btn(false), padding: "6px 10px", fontSize: 12.5 }}>
          <FileSpreadsheet size={13} /> 엑셀 일괄 등록
        </button>
        {visiblePosts.length > 0 && (
          selectMode ? (
            <>
              <button onClick={() => setSelectedIds(allSelected ? [] : visiblePosts.map((p) => p.id))}
                style={{ ...btn(false), padding: "6px 10px", fontSize: 12.5 }}>
                {allSelected ? <CheckSquare size={13} /> : <Square size={13} />} 전체선택
              </button>
              <button onClick={deleteSelected}
                style={{ ...btn(false), padding: "6px 10px", fontSize: 12.5, color: T.danger, borderColor: T.danger }}>
                <Trash2 size={13} /> 선택 삭제 ({selectedIds.length})
              </button>
              <button onClick={() => { setSelectMode(false); setSelectedIds([]); }}
                style={{ ...btn(false), padding: "6px 10px", fontSize: 12.5 }}>
                <X size={13} /> 취소
              </button>
            </>
          ) : (
            <button onClick={() => { setSelectMode(true); setSelectedIds([]); }}
              style={{ ...btn(false), padding: "6px 10px", fontSize: 12.5 }}>
              <CheckSquare size={13} /> 선택
            </button>
          )
        )}
      </div>
      {visiblePosts.length === 0 && (
        <div style={{ color: T.faint, fontSize: 13.5, textAlign: "center", padding: "28px 0", lineHeight: 1.6 }}>
          아직 저장된 링크가 없어요.<br />위에서 인스타그램 링크를 추가해 보세요.
        </div>
      )}
      {visiblePosts.map((p, i) => (
        <div key={p.id} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: T.panel,
          border: `1px solid ${selectMode && selectedIds.includes(p.id) ? T.accent : pickedId === p.id ? T.accent : T.border}`,
          borderRadius: 12, padding: 10,
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {selectMode && (
              <input type="checkbox" checked={selectedIds.includes(p.id)}
                onChange={() => toggleSelect(p.id)}
                style={{ width: 17, height: 17, accentColor: T.accent, cursor: "pointer" }} />
            )}
            <span style={{ fontSize: 12, fontWeight: 800, color: T.faint, width: 22, textAlign: "center" }}>{i + 1}</span>
            {canReorder && !selectMode && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => nudge(p.id, -1)} style={{ ...iconBtn, width: 22, height: 22 }} title="위로"><ChevronUp size={13} /></button>
                <button onClick={() => nudge(p.id, 1)} style={{ ...iconBtn, width: 22, height: 22 }} title="아래로"><ChevronDown size={13} /></button>
              </div>
            )}
          </div>

          {/* 썸네일 */}
          <button onClick={() => requestImage(p.id)} title={images[p.id] ? "이미지 변경" : "이미지 첨부"} style={{
            width: 44, height: 55, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            border: `1px solid ${T.border}`, background: T.placeholder, cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {images[p.id]
              ? <img src={images[p.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <ImageIcon size={16} style={{ color: T.placeholderIcon }} />}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={p.url} target="_blank" rel="noreferrer" style={{
              display: "block", fontSize: 13, color: T.accent, textDecoration: "none",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600,
            }}>{p.url.replace(/^https?:\/\/(www\.)?/, "")}</a>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5, alignItems: "center" }}>
              {formatViews(p.views) && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text, background: T.chip, borderRadius: 6, padding: "2.5px 7px" }}>
                  👁 {formatViews(p.views)}
                </span>
              )}
              {(p.cats || []).map((c) => (
                <span key={c} style={{ fontSize: 11.5, color: T.sub, background: T.chip, borderRadius: 6, padding: "2.5px 7px" }}>
                  {catName(c)}
                </span>
              ))}
              {(p.sources?.length || 0) > 0 && (
                <span style={{ fontSize: 11.5, color: T.sub }}>
                  · 소스 {p.sources.filter((s) => s.downloaded).length}/{p.sources.length}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => setSourcePostId(p.id)} style={{ ...btn(false), padding: "5px 9px", fontSize: 12 }}>
                <Link2 size={12} /> 소스
              </button>
              <button onClick={() => setEditPostId(p.id)} style={{ ...btn(false), padding: "5px 9px", fontSize: 12 }}>
                <Pencil size={12} /> 수정
              </button>
              <button onClick={() => deletePost(p.id)} style={{ ...btn(false), padding: "5px 9px", fontSize: 12, color: T.danger }}>
                <Trash2 size={12} /> 삭제
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const Grid = (
    <div>
      {reorderMode && (
        <div style={{
          fontSize: 12.5, color: T.accent, background: T.panel, border: `1px dashed ${T.accent}`,
          borderRadius: 10, padding: "8px 12px", marginBottom: 10, lineHeight: 1.5,
        }}>
          {isMobile
            ? pickedId ? "이동할 위치의 게시물을 탭하세요" : "옮길 게시물을 탭한 뒤, 이동할 위치를 탭하세요"
            : "게시물을 드래그해서 순서를 바꾸세요 (탭 방식도 가능)"}
        </div>
      )}
      {sortMode === "views" && (
        <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 10 }}>
          조회수순으로 보는 중이에요. 순서를 바꾸려면 <b>저장순</b>으로 전환하세요.
        </div>
      )}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3,
        background: T.grid, borderRadius: 4, overflow: "hidden",
      }}>
        {visiblePosts.map((p, i) => (
          <GridCell
            key={p.id} post={p} index={i} T={T}
            img={images[p.id]}
            picked={pickedId === p.id}
            reorderMode={reorderMode}
            draggable={canReorder && !isMobile}
            onTap={() => onCellTap(p.id)}
            onDragStart={() => { dragId.current = p.id; }}
            onDragEnter={() => { if (dragId.current && canReorder) moveTo(dragId.current, p.id); }}
            onDragEnd={() => { dragId.current = null; }}
          />
        ))}
        {visiblePosts.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: "48px 0", textAlign: "center", color: T.faint, fontSize: 13.5 }}>
            표시할 게시물이 없어요
          </div>
        )}
      </div>
    </div>
  );

  const sourcePost = sourcePostId ? postById(sourcePostId) : null;
  const editPost = editPostId ? postById(editPostId) : null;

  /* ───────────────── 레이아웃 ───────────────── */

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: "'Pretendard','Apple SD Gothic Neo',system-ui,-apple-system,sans-serif",
      transition: "background .2s",
    }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFilePicked} />
      {Header}

      {page === "translate" ? (
        <TranslatorPage T={T} btn={btn} inputStyle={inputStyle} isMobile={isMobile} />
      ) : isMobile ? (
        <>
          {/* 모바일: 세그먼트 탭 */}
          <div style={{ display: "flex", gap: 6, padding: "12px 14px 0" }}>
            {[["grid", "그리드", LayoutGrid], ["list", "링크 목록", ListIcon]].map(([key, label, Icon]) => (
              <button key={key} onClick={() => setMobileTab(key)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 0", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${mobileTab === key ? T.accent : T.border}`,
                background: mobileTab === key ? T.accent : T.panel,
                color: mobileTab === key ? T.accentText : T.sub,
              }}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          <main style={{ padding: 14, paddingBottom: 40 }}>
            {mobileTab === "list" ? (
              <>
                {AddForm}
                <div style={{ height: 12 }} />
                {LinkList}
              </>
            ) : Grid}
          </main>
        </>
      ) : (
        <main style={{
          display: "grid", gridTemplateColumns: "minmax(340px, 420px) 1fr",
          gap: 20, padding: 20, maxWidth: 1280, margin: "0 auto", alignItems: "start",
        }}>
          <section>
            {AddForm}
            <div style={{ height: 14 }} />
            {LinkList}
          </section>
          <section style={{ position: "sticky", top: 76 }}>
            {Grid}
          </section>
        </main>
      )}

      {/* ── 소스 관리 모달 ── */}
      {sourcePost && (
        <SourceModal
          T={T} btn={btn} inputStyle={inputStyle} isMobile={isMobile}
          post={sourcePost} img={images[sourcePost.id]}
          catName={catName}
          onClose={() => setSourcePostId(null)}
          onAdd={(text) => addSources(sourcePost.id, text)}
          onToggle={(sid, v) => updateSource(sourcePost.id, sid, { downloaded: v })}
          onEditUrl={(sid, url) => updateSource(sourcePost.id, sid, { url })}
          onDelete={(sid) => deleteSource(sourcePost.id, sid)}
          onChangeImage={() => requestImage(sourcePost.id)}
          onRemoveImage={() => removePostImage(sourcePost.id)}
        />
      )}

      {/* ── 링크 수정 모달 ── */}
      {editPost && (
        <EditModal
          T={T} btn={btn} inputStyle={inputStyle}
          post={editPost} categories={categories} notify={showToast}
          onClose={() => setEditPostId(null)}
          onSave={(patch) => { updatePost(editPost.id, patch); setEditPostId(null); }}
        />
      )}

      {/* ── 카테고리 관리 모달 ── */}
      {catModal && (
        <CatModal
          T={T} btn={btn} inputStyle={inputStyle}
          categories={categories}
          onClose={() => setCatModal(false)}
          onAdd={addCategory} onRename={renameCategory} onDelete={deleteCategory}
        />
      )}

      {/* ── 엑셀 일괄 등록 모달 ── */}
      {bulkOpen && (
        <BulkImportModal
          T={T} btn={btn} inputStyle={inputStyle} notify={showToast}
          onClose={() => setBulkOpen(false)}
          onImport={(rows) => { bulkAdd(rows); setBulkOpen(false); }}
        />
      )}

      {/* ── 삭제 확인 모달 (샌드박스에서 confirm() 차단 대응) ── */}
      {confirmReq && (
        <ConfirmModal T={T} btn={btn} req={confirmReq} onClose={() => setConfirmReq(null)} />
      )}

      {/* ── 토스트 ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 90,
          background: T.text, color: T.bg, borderRadius: 999, padding: "10px 18px",
          fontSize: 13.5, fontWeight: 600, boxShadow: T.shadow, maxWidth: "88vw",
          textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 그리드 셀 ───────────────────────── */

function GridCell({ post, index, T, img, picked, reorderMode, draggable, onTap, onDragStart, onDragEnter, onDragEnd }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(); }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onClick={onTap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", aspectRatio: "4 / 5", cursor: draggable ? "grab" : "pointer",
        background: T.placeholder, overflow: "hidden", userSelect: "none",
        outline: picked ? `3px solid ${T.accent}` : "none", outlineOffset: -3,
        opacity: 1,
      }}
    >
      {img ? (
        <img src={img} alt="" draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6, color: T.placeholderIcon,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", border: `2px dashed ${T.placeholderIcon}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Plus size={20} />
          </div>
          <span style={{ fontSize: 11 }}>이미지 첨부</span>
        </div>
      )}

      {/* 순번 뱃지 */}
      <span style={{
        position: "absolute", top: 6, left: 6, fontSize: 10.5, fontWeight: 800,
        background: T.badgeBg, color: T.badgeText, borderRadius: 6, padding: "2px 6px",
        opacity: reorderMode || hover ? 1 : 0.55,
      }}>{index + 1}</span>

      {/* 조회수 뱃지 (우측 하단) */}
      {formatViews(post.views) && (
        <span style={{
          position: "absolute", right: 6, bottom: 6, fontSize: 11, fontWeight: 700,
          background: T.badgeBg, color: T.badgeText, borderRadius: 6, padding: "2.5px 7px",
          display: "inline-flex", alignItems: "center", gap: 3,
        }}>
          <Eye size={11} /> {formatViews(post.views)}
        </span>
      )}

      {/* 소스 개수 */}
      {(post.sources?.length || 0) > 0 && (
        <span style={{
          position: "absolute", left: 6, bottom: 6, fontSize: 10.5, fontWeight: 700,
          background: T.badgeBg, color: T.badgeText, borderRadius: 6, padding: "2.5px 7px",
          display: "inline-flex", alignItems: "center", gap: 3,
        }}>
          <Link2 size={10} /> {post.sources.length}
        </span>
      )}

      {reorderMode && (
        <div style={{
          position: "absolute", inset: 0, background: picked ? "rgba(0,149,246,0.18)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
        }}>
          <GripVertical size={20} style={{ color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))", opacity: 0.9 }} />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 링크 추가 폼 ───────────────────────── */

function AddFormBox({ T, btn, inputStyle, categories, open, setOpen, onAdd, notify }) {
  const [url, setUrl] = useState("");
  const [views, setViews] = useState("");
  const [cats, setCats] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const pickFile = (f) => {
    setFile(f || null);
    if (!f) { setPreview(null); return; }
    readFileAsDataURL(f).then(setPreview).catch(() => setPreview(null));
  };

  const submit = () => {
    const clean = extractUrls(url)[0] || url.trim();
    if (!clean) { notify("링크를 입력해 주세요"); return; }
    onAdd({ url: clean, views: views.trim(), cats, imageFile: file });
    setUrl(""); setViews(""); setCats([]); pickFile(null);
    notify("링크를 추가했어요");
  };

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px",
        background: "transparent", border: "none", cursor: "pointer", color: T.text,
        fontSize: 14, fontWeight: 700,
      }}>
        <Plus size={16} style={{ color: T.accent }} /> 링크 추가
        <CaretDown size={15} style={{ marginLeft: "auto", color: T.sub, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/…  (공유 문구째 붙여넣어도 링크만 추출돼요)"
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...inputStyle, width: 130 }} value={views}
              onChange={(e) => setViews(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="조회수 (선택)" inputMode="decimal"
            />
            <span style={{ fontSize: 13, color: T.sub, whiteSpace: "nowrap" }}>만 회 · 예) 10 = 10만</span>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 6, fontWeight: 600 }}>카테고리 (중복 선택 가능)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categories.map((c) => {
                const on = cats.includes(c.id);
                return (
                  <button key={c.id}
                    onClick={() => setCats((v) => on ? v.filter((x) => x !== c.id) : [...v, c.id])}
                    style={{
                      ...btn(on), padding: "6px 11px", fontSize: 12.5,
                      borderRadius: 999,
                    }}>
                    {on && <Check size={12} />} {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => pickFile(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} style={btn(false)}>
              <ImageIcon size={14} /> {file ? "이미지 변경" : "캡처 이미지 (선택)"}
            </button>
            {preview && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src={preview} alt="" style={{ width: 32, height: 40, objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}` }} />
                <button onClick={() => pickFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex" }}>
                  <X size={15} />
                </button>
              </div>
            )}
            <button onClick={submit} style={{ ...btn(true), marginLeft: "auto" }}>
              <Plus size={14} /> 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 소스 관리 모달 ───────────────────────── */

function SourceModal({ T, btn, inputStyle, isMobile, post, img, catName, onClose, onAdd, onToggle, onEditUrl, onDelete, onChangeImage, onRemoveImage }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(null); // srcId
  const [editVal, setEditVal] = useState("");

  const add = () => {
    const n = onAdd(text);
    if (n) setText("");
  };

  const copy = async (u) => {
    try { await navigator.clipboard.writeText(u); } catch {}
  };

  return (
    <Modal T={T} onClose={onClose} wide>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{
          width: 96, aspectRatio: "4/5", borderRadius: 10, overflow: "hidden", flexShrink: 0,
          background: T.placeholder, border: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <ImageIcon size={22} style={{ color: T.placeholderIcon }} />}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>참고 소스 관리</div>
          <a href={post.url} target="_blank" rel="noreferrer" style={{
            fontSize: 13, color: T.accent, textDecoration: "none", wordBreak: "break-all", display: "block",
          }}>{post.url}</a>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
            {formatViews(post.views) && (
              <span style={{ fontSize: 11.5, fontWeight: 700, background: T.chip, borderRadius: 6, padding: "2.5px 7px" }}>👁 {formatViews(post.views)}</span>
            )}
            {(post.cats || []).map((c) => (
              <span key={c} style={{ fontSize: 11.5, color: T.sub, background: T.chip, borderRadius: 6, padding: "2.5px 7px" }}>{catName(c)}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={onChangeImage} style={{ ...btn(false), padding: "5px 10px", fontSize: 12 }}>
              <ImageIcon size={12} /> {img ? "이미지 변경" : "이미지 첨부"}
            </button>
            {img && (
              <button onClick={onRemoveImage} style={{ ...btn(false), padding: "5px 10px", fontSize: 12, color: T.danger }}>
                <Trash2 size={12} /> 이미지 삭제
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, marginBottom: 6 }}>
          소스 추가 — 더우인·샤오홍슈 공유 문구를 통째로 붙여넣으면 링크만 추출돼요
        </div>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"예) 6.41 NJI:/ … https://v.douyin.com/AQR8-V6i4ds/ 复制此链接…"}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={add} style={btn(true)}><Plus size={14} /> 링크 추출해서 추가</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {(post.sources || []).length === 0 && (
          <div style={{ fontSize: 13, color: T.faint, textAlign: "center", padding: "16px 0" }}>
            저장된 소스가 없어요
          </div>
        )}
        {(post.sources || []).map((s, i) => (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: T.panel2, borderRadius: 10, padding: "9px 11px",
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.faint, width: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
            {/* 다운로드 체크 */}
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}
              title="소스 다운로드 완료 여부">
              <input type="checkbox" checked={!!s.downloaded}
                onChange={(e) => onToggle(s.id, e.target.checked)}
                style={{ width: 16, height: 16, accentColor: T.accent, cursor: "pointer" }} />
              {!isMobile && <span style={{ fontSize: 11.5, color: s.downloaded ? T.accent : T.faint, fontWeight: 700 }}>다운</span>}
            </label>

            {editing === s.id ? (
              <>
                <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                  style={{ ...inputStyle, padding: "6px 9px", fontSize: 12.5 }} />
                <button onClick={() => { onEditUrl(s.id, editVal.trim() || s.url); setEditing(null); }}
                  style={{ ...btn(true), padding: "6px 9px", fontSize: 12 }}><Check size={12} /></button>
                <button onClick={() => setEditing(null)} style={{ ...btn(false), padding: "6px 9px", fontSize: 12 }}><X size={12} /></button>
              </>
            ) : (
              <>
                <a href={s.url} target="_blank" rel="noreferrer" style={{
                  flex: 1, minWidth: 0, fontSize: 12.5, color: s.downloaded ? T.faint : T.text,
                  textDecoration: s.downloaded ? "line-through" : "none",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{s.url}</a>
                <button onClick={() => copy(s.url)} title="복사" style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, display: "flex", padding: 3 }}>
                  <Copy size={14} />
                </button>
                <button onClick={() => { setEditing(s.id); setEditVal(s.url); }} title="수정" style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, display: "flex", padding: 3 }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(s.id)} title="삭제" style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex", padding: 3 }}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ───────────────────────── 링크 수정 모달 ───────────────────────── */

function EditModal({ T, btn, inputStyle, post, categories, onClose, onSave, notify }) {
  const [url, setUrl] = useState(post.url);
  const [views, setViews] = useState(post.views === "" || post.views == null ? "" : String(post.views));
  const [cats, setCats] = useState(post.cats || []);

  return (
    <Modal T={T} onClose={onClose}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>링크 정보 수정</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, marginBottom: 5 }}>링크</div>
          <input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, marginBottom: 5 }}>조회수 (만 단위 · 비워도 됨)</div>
          <input style={{ ...inputStyle, width: 140 }} value={views} inputMode="decimal"
            onChange={(e) => setViews(e.target.value.replace(/[^0-9.]/g, ""))} />
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, marginBottom: 6 }}>카테고리</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {categories.map((c) => {
              const on = cats.includes(c.id);
              return (
                <button key={c.id}
                  onClick={() => setCats((v) => on ? v.filter((x) => x !== c.id) : [...v, c.id])}
                  style={{ ...btn(on), padding: "6px 11px", fontSize: 12.5, borderRadius: 999 }}>
                  {on && <Check size={12} />} {c.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button onClick={onClose} style={btn(false)}>취소</button>
        <button onClick={() => {
          const clean = extractUrls(url)[0] || url.trim();
          if (!clean) { notify("링크를 입력해 주세요"); return; }
          onSave({ url: clean, views: views.trim() === "" ? "" : Number(views), cats });
        }} style={btn(true)}><Check size={14} /> 저장</button>
      </div>
    </Modal>
  );
}

/* ───────────────────────── 카테고리 모달 ───────────────────────── */

function CatModal({ T, btn, inputStyle, categories, onClose, onAdd, onRename, onDelete }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");

  return (
    <Modal T={T} onClose={onClose}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>카테고리 관리</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}
          placeholder="새 카테고리 이름" onKeyDown={(e) => { if (e.key === "Enter") { onAdd(name); setName(""); } }} />
        <button onClick={() => { onAdd(name); setName(""); }} style={btn(true)}><Plus size={14} /> 추가</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {categories.map((c) => (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: T.panel2, borderRadius: 10, padding: "8px 11px",
          }}>
            {editing === c.id ? (
              <>
                <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                  style={{ ...inputStyle, padding: "6px 9px", fontSize: 13 }}
                  onKeyDown={(e) => { if (e.key === "Enter") { onRename(c.id, editVal); setEditing(null); } }} />
                <button onClick={() => { onRename(c.id, editVal); setEditing(null); }} style={{ ...btn(true), padding: "6px 9px", fontSize: 12 }}><Check size={12} /></button>
                <button onClick={() => setEditing(null)} style={{ ...btn(false), padding: "6px 9px", fontSize: 12 }}><X size={12} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                <button onClick={() => { setEditing(c.id); setEditVal(c.name); }} title="이름 수정"
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, display: "flex", padding: 3 }}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => onDelete(c.id)} title="삭제"
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex", padding: 3 }}>
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ───────────────────────── 삭제 확인 모달 ───────────────────────── */

function ConfirmModal({ T, btn, req, onClose }) {
  return (
    <Modal T={T} onClose={onClose}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingRight: 20 }}>
        <AlertTriangle size={20} style={{ color: T.danger, flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line", fontWeight: 600 }}>
          {req.message}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button onClick={onClose} style={btn(false)}>취소</button>
        <button onClick={() => { req.action(); onClose(); }}
          style={{ ...btn(false), background: T.danger, borderColor: T.danger, color: "#fff" }}>
          <Trash2 size={14} /> 삭제
        </button>
      </div>
    </Modal>
  );
}

/* ───────────────────────── 엑셀 일괄 등록 모달 ───────────────────────── */

function BulkImportModal({ T, btn, inputStyle, onClose, onImport, notify }) {
  const [rows, setRows] = useState(null); // [{url, views, catNames[]}]
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef(null);

  const parseFile = async (file) => {
    if (!file) return;
    setParsing(true); setRows(null); setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const out = [];
      for (const r of raw) {
        const cells = (Array.isArray(r) ? r : []).map((c) => String(c ?? "").trim());
        const url = extractUrls(cells.join(" "))[0];
        if (!url) continue; // 헤더행·빈행 자동 건너뜀
        let views = "";
        const catNames = [];
        for (const c of cells) {
          if (!c || /https?:\/\//.test(c)) continue;
          if (views === "" && /^\d+(\.\d+)?$/.test(c)) { views = c; continue; }
          catNames.push(...c.split(/[,、/|·+]+/));
        }
        out.push({ url, views, catNames: catNames.map((s) => s.trim()).filter(Boolean) });
      }
      if (!out.length) {
        notify("파일에서 링크를 찾지 못했어요");
        setRows(null);
      } else {
        setRows(out);
      }
    } catch (e) {
      console.error(e);
      notify("파일을 읽지 못했어요. .xlsx / .csv 파일인지 확인해 주세요");
      setRows(null);
    } finally {
      setParsing(false);
    }
  };

  return (
    <Modal T={T} onClose={onClose} wide>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
        <FileSpreadsheet size={17} style={{ color: T.accent }} /> 엑셀 일괄 등록
      </div>

      <div style={{
        background: T.panel2, borderRadius: 10, padding: "11px 13px",
        fontSize: 12.5, color: T.sub, lineHeight: 1.7, marginBottom: 12,
      }}>
        <b style={{ color: T.text }}>파일 형식 (.xlsx / .csv)</b><br />
        · <b style={{ color: T.text }}>A열</b> 링크 (공유 문구째 있어도 링크만 추출)<br />
        · <b style={{ color: T.text }}>B열</b> 조회수 — 만 단위 숫자, 비워도 됨<br />
        · <b style={{ color: T.text }}>C열</b> 카테고리 — 쉼표로 여러 개 (예: 주방·레시피, 기타), 없는 이름은 자동 생성<br />
        열 순서가 달라도 자동으로 인식하고, 제목 행은 건너뛰어요.
      </div>

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
        onChange={(e) => { parseFile(e.target.files?.[0]); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => fileRef.current?.click()} style={btn(false)} disabled={parsing}>
          {parsing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileSpreadsheet size={14} />}
          {parsing ? "읽는 중…" : "파일 선택"}
        </button>
        {fileName && <span style={{ fontSize: 12.5, color: T.sub }}>{fileName}</span>}
      </div>

      {rows && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 8px" }}>
            미리보기 — {rows.length}개 링크
          </div>
          <div style={{
            maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
            border: `1px solid ${T.border}`, borderRadius: 10, padding: 8,
          }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, background: T.panel2, borderRadius: 8, padding: "7px 10px" }}>
                <span style={{ fontWeight: 800, color: T.faint, width: 20, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.accent }}>
                  {r.url}
                </span>
                {r.views !== "" && (
                  <span style={{ flexShrink: 0, fontWeight: 700 }}>{formatViews(r.views)}</span>
                )}
                {r.catNames.length > 0 && (
                  <span style={{ flexShrink: 0, color: T.sub }}>{r.catNames.join(", ")}</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={onClose} style={btn(false)}>취소</button>
            <button onClick={() => onImport(rows)} style={btn(true)}>
              <Plus size={14} /> {rows.length}개 등록
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ───────────────────────── 키워드 번역기 ───────────────────────── */

function TranslatorPage({ T, btn, inputStyle, isMobile }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // [{zh,ko}]
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1200);
  };

  const translate = async () => {
    const input = q.trim();
    if (!input || loading) return;
    setLoading(true); setError(null); setResults(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content:
              `다음 한국어 단어/문장을 더우인(抖音)·샤오홍슈(小红书) 검색과 해시태그에 실제로 많이 쓰이는 자연스러운 간체 중국어 키워드로 번역해줘.\n` +
              `입력: "${input}"\n\n` +
              `반드시 아래 JSON 형식으로만 답해. 마크다운 코드블록, 설명, 다른 텍스트는 절대 쓰지 마.\n` +
              `{"results":[{"zh":"중국어 키워드","ko":"한국어 뜻/뉘앙스"}]}\n` +
              `결과는 1~4개. 중국 플랫폼에서 검색량이 많을 법한 표현을 우선으로.`,
          }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((i) => i.type === "text").map((i) => i.text).join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed?.results?.length) throw new Error("결과 없음");
      setResults(parsed.results);
    } catch (e) {
      console.error(e);
      setError("번역에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const chip = (zh, ko, key) => {
    const on = copied === key;
    return (
      <button key={key} onClick={() => copy(zh, key)} title={`${ko} · 탭하면 중국어만 복사돼요`}
        style={{
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
          border: `1px solid ${on ? T.accent : T.border}`,
          background: on ? T.accent : T.panel,
          color: on ? T.accentText : T.text,
          borderRadius: 10, padding: "7px 11px", cursor: "pointer", textAlign: "left",
          transition: "background .12s, border-color .12s",
        }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1.2 }}>
          {on && <Check size={12} />}{on ? "복사됨!" : zh}
        </span>
        <span style={{ fontSize: 11, color: on ? T.accentText : T.sub, opacity: on ? 0.9 : 1, lineHeight: 1.2 }}>{ko}</span>
      </button>
    );
  };

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: isMobile ? 14 : 20, paddingBottom: 60 }}>
      {/* 번역기 카드 */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <Languages size={16} style={{ color: T.accent }} /> 한국어 → 중국어 키워드 번역
        </div>
        <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 10, lineHeight: 1.5 }}>
          한국어 단어나 문장을 넣으면 더우인·샤오홍슈에서 검색하기 좋은 중국어 키워드로 바꿔줘요.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={inputStyle} value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") translate(); }}
            placeholder="예) 냉장고 정리, 신발장 냄새 제거, 설거지 꿀템"
          />
          <button onClick={translate} disabled={loading} style={{ ...btn(true), opacity: loading ? 0.6 : 1 }}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Languages size={14} />}
            {loading ? "번역 중…" : "번역"}
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {error && (
          <div style={{ marginTop: 10, fontSize: 13, color: T.danger }}>{error}</div>
        )}
        {results && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
            {results.map((r, i) => {
              const key = "res-" + i;
              const on = copied === key;
              return (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: T.panel2, borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{r.zh}</div>
                    {r.ko && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{r.ko}</div>}
                  </div>
                  <button onClick={() => copy(r.zh, key)}
                    style={{ ...btn(on), padding: "6px 11px", fontSize: 12 }}>
                    {on ? <Check size={12} /> : <Copy size={12} />} {on ? "복사됨" : "복사"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 키워드 라이브러리 */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>키워드 라이브러리</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 6 }}>키워드를 탭하면 중국어만 복사돼요.</div>
        {KEYWORD_GROUPS.map((g) => (
          <div key={g.title} style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>{g.title}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {g.items.map(([zh, ko], i) => chip(zh, ko, g.title + "-" + i))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

/* ───────────────────────── 공용 모달 ───────────────────────── */

function Modal({ T, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 60, background: T.overlay,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "6vh 14px 14px", overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: wide ? 620 : 460,
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16,
        boxShadow: T.shadow, padding: 18, position: "relative", color: T.text,
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 12, right: 12, background: "none", border: "none",
          cursor: "pointer", color: T.sub, display: "flex", padding: 4,
        }}><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}
