# 사주팔자 보기 (React + Vite)

React 기반으로 간단한 사주 입력/리포트 페이지를 제공하는 프로젝트입니다.
현재 로직은 **학습/엔터테인먼트용**으로 단순화돼 있으며, 실제 명리학 사주풀이와는 다릅니다.

## 실행 방법

```bash
cd d:\GitHub\saju_palja
npm install
npm run dev:api
npm run dev
```

브라우저에서 Vite가 알려주는 주소(기본 `http://localhost:5173`)로 접속하면
사주 입력 폼이 뜨고, 정보를 입력 후 **“사주 리포트 보기”** 버튼을 누르면
오른쪽 카드에 간단한 해석이 표시됩니다.

## Vertex AI 연결

`gemini_service_account.json`은 브라우저에서 직접 쓰면 안 됩니다. 이 프로젝트는 Node API 서버가 서비스 계정으로 Vertex AI에 접근하고, 프런트는 `/api/vertex/generate`만 호출하도록 구성했습니다.

기본값:

- 서비스 계정 파일: 프로젝트 루트의 `gemini_service_account.json`
- 프로젝트 ID: 서비스 계정의 `project_id`
- 리전: `global`
- 모델: `gemini-2.5-flash`

필요하면 환경변수로 덮어쓸 수 있습니다.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./gemini_service_account.json
export VERTEX_PROJECT_ID=gen-lang-client-0443184070
export VERTEX_LOCATION=global
export VERTEX_MODEL=gemini-2.5-flash
```

API 서버 실행:

```bash
npm run dev:api
```

프런트에서 사용:

```ts
import { generateWithVertex } from './src/vertex-client'

const data = await generateWithVertex({
  prompt: '사주 해석을 3문장으로 요약해줘.',
})

console.log(data.text)
```

직접 호출 예시:

```bash
curl -X POST http://127.0.0.1:8787/api/vertex/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"간단히 인사해줘."}'
```

## 주요 파일

- `src/saju-app.tsx` : React 컴포넌트 (폼 + 결과 화면)
- `src/main.tsx` : React 렌더링 엔트리
- `src/style.css` : 전체 페이지 스타일 (다크 톤 UI)

## 향후 확장 아이디어

- 연·월·일·시 기둥(천간/지지) 정식 계산 로직 추가
- 오행(목·화·토·금·수) 비율 계산 및 시각화
- 연운/세운/대운 등 운세 흐름 탭 분리
- 결과를 PDF / 이미지로 저장하는 기능
