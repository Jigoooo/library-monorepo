# Library Monorepo

재사용 가능한 TypeScript 패키지를 관리하는 pnpm workspace입니다. 현재 핵심 패키지는 Axios 기반 `@jigoooo/api-client`입니다.

## @jigoooo/api-client

- access token 주입과 401 refresh/retry 흐름
- 동시 refresh 요청 queue 제어
- request/response/error hook
- camelCase ↔ snake_case 변환
- ESM·CommonJS·TypeScript declaration 출력

```bash
pnpm add @jigoooo/api-client axios qs
```

자세한 API와 사용 예시는 [`packages/api-client/README.md`](packages/api-client/README.md)를 확인하세요.

## 개발

준비물: Node.js 18 이상, pnpm 10

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

## 구조

```text
packages/api-client/   publishable Axios client
pnpm-workspace.yaml    workspace boundary
tsconfig.base.json     shared TypeScript contract
vitest.config.ts       test configuration
```

각 package는 독립 version과 npm publish contract를 가집니다. 현재 저장소는 API client 한 개에 집중한 소규모 monorepo입니다.

License: MIT.
