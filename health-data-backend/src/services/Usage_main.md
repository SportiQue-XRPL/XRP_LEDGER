## XRPL Health Data API 사용 가이드 (services/main.py)

### 개요
- FastAPI 기반 XRPL 유틸(지갑, 송금, 원장/계정, TrustLine, IOU, 잔액, 계정 설정, 에스크로, 체크, NFT) API 모음
- 네트워크: Devnet(`https://s.devnet.rippletest.net:51234/`)

### 실행 방법
1) 의존성 설치
```bash
cd xrpl_health_data_system_final/health-data-backend
pip install -r requirements.txt
```
2) 서버 실행
```bash
cd src
uvicorn services.main:app --reload --host 0.0.0.0 --port 8000
```
3) API 문서
- Swagger: http://localhost:8000/docs
- OpenAPI: http://localhost:8000/openapi.json

### 보안 주의
- seed 전달 엔드포인트는 개발/테스트 전용. 운영 환경에서는 지갑 시드/프라이빗키를 서버로 보내지 마세요.

---

## 엔드포인트 상세 (요청/응답 예시 포함)

### 1) 지갑
- POST `/create/wallet`
  - 설명: Devnet Faucet으로 새 지갑 생성
  - 응답 예시
```json
{
  "classic_address": "r................................",
  "seed": "sn................................"
}
```

- POST `/wallet/from-seed`
  - 설명: 시드로 지갑 복구
  - 요청 바디
```json
{ "seed": "sn................................" }
```
  - 응답 예시: 위와 동일

### 2) XRP 전송
- POST `/transaction/payment`
  - 설명: XRP 전송
  - 요청 바디
```json
{ "seed": "sn...", "amount_xrp": 22, "destination": "r..." }
```
  - 응답 예시(요약)
```json
{ "engine_result": "tesSUCCESS", "tx_json": { "hash": "..." } }
```

### 3) 원장/계정
- POST `/query/ledger`
  - 요청 바디
```json
{ "account": "r..." }
```
  - 응답: XRPL Account 정보(원장 기준)

- POST `/account/info`
  - 요청 바디
```json
{ "account": "r..." }
```
  - 응답: `account_data` 필드 포함 객체

### 4) TrustLine
- POST `/trustline/create`
  - 요청 바디
```json
{ "seed": "sn...", "issuer": "r...", "currency": "USD", "amount": 1000 }
```
  - 응답: 제출 결과(result)

### 5) 발행통화(IOU) 전송
- POST `/currency/send`
  - 요청 바디
```json
{ "seed": "sn...", "destination": "r...", "currency": "USD", "amount": 10 }
```
  - 응답: 제출 결과(result)

### 6) 잔액 조회(GatewayBalances)
- POST `/balance/get`
  - 요청 바디
```json
{ "sb_account_seed": "sn...", "op_account_seed": "sn..." }
```
  - 응답: balances/obligations 등

### 7) 계정 설정(AccountSet)
- POST `/account/configure`
  - 요청 바디
```json
{ "seed": "sn...", "default_setting": true }
```
  - 설명: `ASF_DEFAULT_RIPPLE` 플래그 on/off

### 8) 에스크로(Escrow)
- POST `/escrow/create`
  - 요청 바디
```json
{
  "seed": "sn...",
  "amount_drops": 1000000,
  "destination": "r...",
  "finish_after_seconds": 3600,
  "cancel_after_seconds": 7200
}
```

- POST `/escrow/finish`
  - 요청 바디
```json
{ "seed": "sn...", "owner": "r...", "offer_sequence": 123 }
```

- POST `/escrow/cancel`
  - 요청 바디
```json
{ "seed": "sn...", "owner": "r...", "offer_sequence": 123 }
```

- POST `/escrow/list`
  - 요청 바디
```json
{ "account": "r..." }
```

### 9) 체크(Checks)
- POST `/checks/create`
  - 요청 바디(XRP)
```json
{ "seed": "sn...", "amount": "1000000", "destination": "r..." }
```
  - 요청 바디(IOU)
```json
{ "seed": "sn...", "amount": "10", "destination": "r...", "currency": "USD", "issuer": "r..." }
```

- POST `/checks/cash`
  - 요청 바디
```json
{ "seed": "sn...", "amount": "1000000", "check_id": "...", "currency": "XRP" }
```

- POST `/checks/cancel`
  - 요청 바디
```json
{ "seed": "sn...", "check_id": "..." }
```

- POST `/checks/list`
  - 요청 바디
```json
{ "account": "r..." }
```

### 10) NFT
- POST `/nft/mint`
  - 요청 바디
```json
{ "seed": "sn...", "uri": "https://...", "flags": 8, "transfer_fee": 0, "taxon": 0 }
```

- POST `/nft/list`
  - 요청 바디
```json
{ "account": "r..." }
```

- POST `/nft/burn`
  - 요청 바디
```json
{ "seed": "sn...", "nftoken_id": "..." }
```

- POST `/nft/sell-offer/create`
  - 요청 바디
```json
{ "seed": "sn...", "amount": "1", "nftoken_id": "...", "expiration": "3600", "destination": "" }
```

- POST `/nft/sell-offer/accept`
  - 요청 바디
```json
{ "seed": "sn...", "offer_index": "..." }
```

- POST `/nft/buy-offer/create`
  - 요청 바디
```json
{ "seed": "sn...", "amount": "1", "nft_id": "...", "owner": "r...", "expiration": "", "destination": "" }
```

- POST `/nft/buy-offer/accept`
  - 요청 바디
```json
{ "seed": "sn...", "offer_index": "..." }
```

- POST `/nft/offers`
  - 요청 바디
```json
{ "nft_id": "..." }
```

- POST `/nft/offer/cancel`
  - 요청 바디
```json
{ "seed": "sn...", "nftoken_offer_ids": "..." }
```

---

## cURL 예시 모음
- 지갑 생성
```bash
curl -X POST http://localhost:8000/create/wallet
```

- XRP 전송
```bash
curl -X POST http://localhost:8000/transaction/payment \
  -H "Content-Type: application/json" \
  -d '{"seed":"sn...","amount_xrp":22,"destination":"r..."}'
```

- NFT 민팅
```bash
curl -X POST http://localhost:8000/nft/mint \
  -H "Content-Type: application/json" \
  -d '{"seed":"sn...","uri":"https://example.com/metadata.json","flags":8,"transfer_fee":0,"taxon":0}'
```

---

## 문제 해결 팁
- 데코레이터 경로는 f-string이 아닌 "/path/{param}" 형태여야 합니다.
- Devnet 지연으로 확정 대기 시간이 길 수 있습니다.
- 주소/시드 형식 확인: 주소 `r...`, 시드 `sn...`.
