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

## 변경 사항 (Claude 아티팩트 전용 코드 제거)

- `window.storage` → `localStorage` 로 교체했습니다. 데이터는 **이 브라우저/이 기기에만** 저장됩니다.
  - 브라우저 데이터를 지우면(캐시 삭제 등) 저장된 스크랩도 사라져요.
  - 저장 용량은 대략 5~10MB 정도로 제한적입니다. 이미지를 많이 등록하면 한도에 걸릴 수 있어요.
  - 여러 기기에서 동기화하려면 Supabase, Firebase 같은 실제 백엔드 연동이 필요합니다.
- "키워드 번역기" 기능은 비활성화했습니다. (Anthropic API 키 없이는 호출이 안 되고, 브라우저에 키를 직접 넣으면 노출되기 때문에 Vercel 서버리스 함수로 감싸야 합니다. 필요하면 다음에 추가해드릴게요.)
