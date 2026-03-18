# 📦 Library Monorepo

TypeScript 기반 npm 라이브러리 모노레포입니다. `pnpm` 워크스페이스로 관리되며, 향후 다양한 유틸리티 라이브러리들이 추가될 예정입니다.

## 🏗️ 프로젝트 구조

```
library-monorepo/
├── packages/
│   ├── api-client/          # API 클라이언트 라이브러리 (현재)
│   └── [추가 라이브러리 예정]
├── tsconfig.base.json       # 공유 TypeScript 설정
├── pnpm-workspace.yaml      # 워크스페이스 구성
├── vitest.config.ts         # 테스트 설정
├── eslint.config.js         # 린트 설정
├── .prettierrc              # 포매터 설정
└── package.json             # 루트 패키지 설정
```

## 📚 현재 패키지

### [@jigoooo/api-client](./packages/api-client/)

Axios 기반의 완전한 API 클라이언트 라이브러리입니다.

**주요 기능:**

- 🔐 JWT 토큰 자동 갱신
- 🔄 요청/응답 인터셉팅
- 🔀 camelCase/snake_case 자동 변환
- ⚡ 재시도 로직 및 대기열 관리
- 🪝 커스텀 훅 (onRequest, onResponse, onError)

**사용 예시:**

```bash
npm install @jigoooo/api-client axios qs
pnpm add @jigoooo/api-client axios qs
```

자세한 사용법은 [@jigoooo/api-client README](./packages/api-client/README.md)를 참고하세요.

## 🚀 빠른 시작

### 필수 요구사항

- Node.js 18+
- pnpm 10.x+

### 설치

```bash
# pnpm 설치
npm install -g pnpm

# 의존성 설치
pnpm install
```

### 개발

```bash
# 개발 모드 실행 (자동 감지)
pnpm dev

# 특정 패키지만 개발 모드
pnpm --filter @jigoooo/api-client dev
```

### 빌드

```bash
# 모든 패키지 빌드
pnpm build

# 특정 패키지만 빌드
pnpm --filter @jigoooo/api-client build
```

### 테스트

```bash
# 모든 테스트 실행
pnpm test

# 감시 모드 (자동 재실행)
pnpm test:watch

# 커버리지 리포트
pnpm test:coverage
```

### 코드 품질

```bash
# 린트 검사
pnpm lint

# 자동 수정
pnpm lint:fix

# 포매팅
pnpm format

# 린트 + 포매팅 순차 실행
pnpm check
```

## 📖 패키지 개발 가이드

### 새 패키지 생성

모노레포에 새로운 라이브러리를 추가하려면:

1. **`packages/` 디렉토리에 새 폴더 생성**

   ```bash
   mkdir packages/your-library
   ```

2. **`package.json` 작성**

   ```json
   {
     "name": "@jigoooo/your-library",
     "version": "0.0.1",
     "type": "module",
     "main": "./dist/index.cjs",
     "module": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
         "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
       }
     },
     "files": ["dist"],
     "scripts": {
       "build": "tsup",
       "dev": "tsup --watch",
       "test": "vitest run",
       "test:watch": "vitest"
     }
   }
   ```

3. **TypeScript 설정**
   `tsconfig.json` 생성:

   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "./dist"
     },
     "include": ["src"]
   }
   ```

4. **소스 코드 작성**
   - `src/index.ts` — 진입점
   - `src/__tests__/` — 테스트 파일

5. **빌드 설정**
   `tsup.config.ts` 생성:

   ```typescript
   import { defineConfig } from 'tsup';

   export default defineConfig({
     entry: ['src/index.ts'],
     format: ['esm', 'cjs'],
     dts: true,
     shims: true,
   });
   ```

### 패키지 간 의존성

다른 패키지를 의존성으로 추가하려면:

```bash
pnpm --filter @jigoooo/new-package add @jigoooo/api-client
```

`pnpm` 워크스페이스는 자동으로 심볼릭 링크로 처리합니다.

## 📦 배포

### npm 배포

각 패키지는 독립적으로 npm에 배포됩니다.

```bash
# 특정 패키지 배포 (dry-run)
pnpm --filter @jigoooo/api-client publish:dry

# 실제 배포 (package.json의 prepublishOnly가 자동으로 build 실행)
cd packages/api-client && npm publish
```

**전제 조건:**

- npm 계정과 2FA 설정
- `packages/[package-name]/.npmrc` 파일 (토큰 설정)

### 버전 관리

모노레포의 각 패키지는 독립적인 버전을 유지합니다. 현재는 단일 패키지 구조이므로 수동으로 관리합니다:

```bash
# 1. 패키지의 package.json version 필드 수정
# packages/api-client/package.json: "version": "0.3.0"

# 2. git 태그로 릴리스 추적
# 현재 관행 (단일 패키지): v<version>
git tag v0.3.0

# 또는 향후 다중 패키지 시 (권장):
# git tag @jigoooo/api-client@0.3.0

# 3. 원격에 push
git push origin <tag-name>
```

**전략 선택:**

- **현재** (api-client만): `v<version>` 형식 사용 (예: `v0.3.0`)
- **향후** (다중 패키지): `@<scope>/<package>@<version>` 형식으로 변경 권장

**참고**: 패키지가 증가할 경우 `changesets`나 `lerna` 도입을 고려하세요.

## 🧪 테스트 구조

### 테스트 작성

각 패키지의 `src/__tests__/` 디렉토리에 테스트 파일을 작성합니다:

```typescript
// src/__tests__/example.test.ts
import { describe, it, expect } from 'vitest';

describe('module', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

### 테스트 실행

```bash
# 모든 테스트
pnpm test

# 감시 모드
pnpm test:watch

# 특정 패키지만
pnpm --filter @jigoooo/api-client test

# 커버리지 확인
pnpm test:coverage
```

## 🔧 설정 파일

### `tsconfig.base.json`

모든 패키지가 상속하는 공유 TypeScript 설정:

- ES2022 타겟
- ESNext 모듈
- 번들러 기반 모듈 해석 (bundler)
- strict 모드 활성화

### `vitest.config.ts`

전체 모노레포의 테스트 설정:

- Vitest 러너
- 자동 모듈 감지

### `eslint.config.js` / `.prettierrc`

코드 품질 관리:

- TypeScript 린트
- Prettier 포매팅

## 📝 커밋 컨벤션

```
type(scope): description

type: feat, fix, docs, style, refactor, test, chore, perf
scope: 패키지명 또는 모듈명
description: 한글 설명
```

**예시:**

```
feat(api-client): JWT 토큰 자동 갱신 기능 추가
fix(api-client): camelCase 변환 버그 수정
docs: 모노레포 README 추가
```

## 🛠️ 지원하는 Node.js 버전

- Node.js 18.x+
- Node.js 20.x+
- Node.js 22.x+

## 📜 라이선스

MIT

## 🤝 기여 가이드

1. 새 브랜치 생성 (`git checkout -b feature/your-feature`)
2. 코드 작성 및 테스트 추가
3. `pnpm check`로 린트/포매팅 확인
4. PR 생성

## 🔗 관련 리소스

- [pnpm 문서](https://pnpm.io/)
- [TypeScript 설정](./tsconfig.base.json)
- [@jigoooo/api-client 상세 가이드](./packages/api-client/README.md)

---

**라이브러리 모노레포**는 향후 다양한 유틸리티 라이브러리들이 추가될 예정입니다. 새로운 라이브러리는 위의 "새 패키지 생성" 가이드를 따라 추가하면 됩니다.
