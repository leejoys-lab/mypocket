# 숏폼 스크랩 보드

## 로컬 실행
```bash
npm install
npm run dev
```

## GitHub + Vercel 배포

1. GitHub에 새 저장소 생성 후 이 폴더 전체를 push
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin <너의 저장소 URL>
   git push -u origin main
   ```
2. https://vercel.com 에서 "Add New Project" → 방금 만든 저장소 선택
3. Framework Preset: **Vite** 로 자동 인식됨 (안 되면 수동 선택)
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy 클릭 → 완료

## 닉네임 로그인 + 기기 간 동기화 (필수 설정)

이제 앱을 열면 먼저 **닉네임 입력 화면**이 나옵니다. 같은 닉네임으로 로그인하면
휴대폰에서 입력한 데이터를 PC에서도, PC에서 입력한 데이터를 휴대폰에서도 그대로 볼 수 있어요.

데이터는 브라우저(localStorage)에도 캐시되지만, **진짜 저장소는 Vercel에 연결하는 Redis(Upstash) 데이터베이스**입니다.
아래 설정을 하지 않으면 로그인 화면은 뜨지만 "오프라인 (이 기기에만 저장됨)" 상태로만 동작해요 (즉 이 브라우저에서만 저장되고, 다른 기기와는 동기화되지 않습니다).

### 설정 방법 (5분, 신용카드/별도 회원가입 불필요)

1. 이 저장소를 GitHub에 올리고 Vercel에 배포합니다 (아래 "GitHub + Vercel 배포" 참고).
2. 배포된 Vercel 프로젝트 대시보드로 이동 → 상단 **Storage** 탭 클릭
3. **Create Database** (또는 "Marketplace Database Providers") → **Upstash** 선택 → 상품 중 **Redis** 선택
4. 이름/리전 등은 기본값 그대로 두고 생성 (무료 플랜: 256MB, 월 50만 커맨드 — 이 앱 용도로는 충분)
5. 생성 후 나오는 화면에서 **Connect to Project**를 눌러 방금 만든 이 프로젝트를 선택 → 연결
   - 이 과정에서 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 환경변수가 프로젝트에 자동으로 추가됩니다. 코드를 직접 고칠 필요는 없어요.
6. Vercel 프로젝트를 다시 배포(Redeploy)하면 완료입니다.

이후부터는 어떤 닉네임으로 로그인하든 데이터가 서버(Upstash Redis)에 저장되고,
다른 기기에서 같은 닉네임으로 로그인하면 그 데이터를 그대로 불러옵니다.

**주의:** 비밀번호는 없습니다. 같은 닉네임을 아는 사람은 데이터를 보거나 덮어쓸 수 있으니,
남들이 추측하기 어려운 닉네임을 사용해주세요.

## 변경 사항 (Claude 아티팩트 전용 코드 제거)

- `window.storage` → `localStorage`(오프라인 캐시) + Vercel 서버리스 함수(`api/scrap.js`) 통한 Upstash Redis 저장으로 교체했습니다.
  - 로컬 캐시만 쓰던 이전 버전과 달리, 이제 닉네임 기준으로 서버에도 저장되어 기기 간 동기화가 됩니다.
  - 이미지도 함께 저장되므로, 스크랩이 아주 많아지면(수백 개 이상) 요청 용량 제한(10MB)에 걸릴 수 있어요. 이 경우 이미지를 정리해주세요.
- "키워드 번역기" 기능은 비활성화했습니다. (Anthropic API 키 없이는 호출이 안 되고, 브라우저에 키를 직접 넣으면 노출되기 때문에 Vercel 서버리스 함수로 감싸야 합니다. 필요하면 다음에 추가해드릴게요.)
