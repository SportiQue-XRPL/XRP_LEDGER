"""
XRPL 에스크로 지불 컨트랙트 (Escrow Payment Contract)
조건부 자동 정산 및 데이터 전달 보장
"""

import json
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


class EscrowStatus(Enum):
    """에스크로 상태"""
    CREATED = "created"
    LOCKED = "locked"
    FULFILLED = "fulfilled"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


@dataclass
class DataDeliveryCondition:
    """데이터 전달 조건"""
    fhir_bundle_hash: str  # FHIR Bundle SHA-256 해시
    preimage: str  # PREIMAGE-SHA-256 조건용 비밀값
    preimage_hash: str  # 비밀값의 해시
    delivery_deadline: datetime  # 데이터 전달 마감일


@dataclass
class EscrowContract:
    """에스크로 계약"""
    escrow_id: str
    payer: str  # 연구기관 XRPL 주소
    payee: str  # 환자 XRPL 주소
    amount: float  # XRP 금액
    consent_id: str  # 관련 동의서 ID
    data_condition: DataDeliveryCondition
    created_at: datetime
    expires_at: datetime
    status: EscrowStatus = EscrowStatus.CREATED
    xrpl_sequence: Optional[int] = None  # XRPL 트랜잭션 시퀀스
    fulfillment_tx: Optional[str] = None  # 이행 트랜잭션 해시


class XRPLEscrowManager:
    """XRPL 에스크로 관리자"""
    
    def __init__(self, testnet: bool = True):
        self.testnet = testnet
        self.active_escrows: Dict[str, EscrowContract] = {}
        self.escrow_history: List[Dict[str, Any]] = []
        
        # XRPL 네트워크 설정
        if testnet:
            self.network_url = "wss://s.altnet.rippletest.net:51233"
            self.explorer_url = "https://testnet.xrpl.org"
        else:
            self.network_url = "wss://xrplcluster.com"
            self.explorer_url = "https://xrpl.org"
    
    def create_escrow_offer(self, 
                           payer_address: str,
                           payee_address: str,
                           amount: float,
                           consent_id: str,
                           fhir_bundle_hash: str,
                           delivery_hours: int = 72) -> Tuple[EscrowContract, Dict[str, Any]]:
        """에스크로 오퍼 생성"""
        
        # 고유 에스크로 ID 생성
        escrow_id = f"escrow_{self._generate_id()}"
        
        # PREIMAGE 조건 생성
        preimage = self._generate_preimage()
        preimage_hash = hashlib.sha256(preimage.encode()).hexdigest().upper()
        
        # 데이터 전달 조건 설정
        delivery_deadline = datetime.utcnow() + timedelta(hours=delivery_hours)
        data_condition = DataDeliveryCondition(
            fhir_bundle_hash=fhir_bundle_hash,
            preimage=preimage,
            preimage_hash=preimage_hash,
            delivery_deadline=delivery_deadline
        )
        
        # 에스크로 계약 생성
        escrow_contract = EscrowContract(
            escrow_id=escrow_id,
            payer=payer_address,
            payee=payee_address,
            amount=amount,
            consent_id=consent_id,
            data_condition=data_condition,
            created_at=datetime.utcnow(),
            expires_at=delivery_deadline + timedelta(hours=24)  # 추가 24시간 여유
        )
        
        # XRPL EscrowCreate 트랜잭션 구성
        xrpl_transaction = self._build_escrow_create_transaction(escrow_contract)
        
        # 활성 에스크로에 추가
        self.active_escrows[escrow_id] = escrow_contract
        
        # 히스토리 기록
        self._log_escrow_action("CREATED", escrow_id, payer_address, payee_address, amount)
        
        return escrow_contract, xrpl_transaction
    
    def lock_escrow_funds(self, escrow_id: str, xrpl_sequence: int) -> bool:
        """에스크로 자금 잠금 (XRPL 트랜잭션 제출 후 호출)"""
        if escrow_id not in self.active_escrows:
            return False
        
        escrow = self.active_escrows[escrow_id]
        escrow.status = EscrowStatus.LOCKED
        escrow.xrpl_sequence = xrpl_sequence
        
        self._log_escrow_action("LOCKED", escrow_id, escrow.payer, escrow.payee, escrow.amount)
        return True
    
    def fulfill_escrow(self, 
                      escrow_id: str, 
                      fhir_bundle_hash: str,
                      preimage: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """에스크로 이행 (데이터 전달 완료 시)"""
        if escrow_id not in self.active_escrows:
            return False, None
        
        escrow = self.active_escrows[escrow_id]
        
        # 상태 확인
        if escrow.status != EscrowStatus.LOCKED:
            return False, None
        
        # 만료 확인
        if datetime.utcnow() > escrow.expires_at:
            escrow.status = EscrowStatus.EXPIRED
            return False, None
        
        # FHIR Bundle 해시 검증
        if fhir_bundle_hash != escrow.data_condition.fhir_bundle_hash:
            return False, None
        
        # PREIMAGE 검증
        provided_hash = hashlib.sha256(preimage.encode()).hexdigest().upper()
        if provided_hash != escrow.data_condition.preimage_hash:
            return False, None
        
        # XRPL EscrowFinish 트랜잭션 구성
        finish_transaction = self._build_escrow_finish_transaction(escrow, preimage)
        
        # 상태 업데이트
        escrow.status = EscrowStatus.FULFILLED
        
        self._log_escrow_action("FULFILLED", escrow_id, escrow.payer, escrow.payee, escrow.amount)
        
        return True, finish_transaction
    
    def cancel_escrow(self, escrow_id: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """에스크로 취소 (만료 시 자동 환불)"""
        if escrow_id not in self.active_escrows:
            return False, None
        
        escrow = self.active_escrows[escrow_id]
        
        # 만료 확인
        if datetime.utcnow() <= escrow.expires_at:
            return False, None
        
        # XRPL EscrowCancel 트랜잭션 구성
        cancel_transaction = self._build_escrow_cancel_transaction(escrow)
        
        # 상태 업데이트
        escrow.status = EscrowStatus.EXPIRED
        
        self._log_escrow_action("CANCELLED", escrow_id, escrow.payer, escrow.payee, escrow.amount)
        
        return True, cancel_transaction
    
    def get_escrow_status(self, escrow_id: str) -> Optional[Dict[str, Any]]:
        """에스크로 상태 조회"""
        if escrow_id not in self.active_escrows:
            return None
        
        escrow = self.active_escrows[escrow_id]
        
        return {
            "escrowId": escrow.escrow_id,
            "status": escrow.status.value,
            "payer": escrow.payer,
            "payee": escrow.payee,
            "amount": escrow.amount,
            "consentId": escrow.consent_id,
            "createdAt": escrow.created_at.isoformat() + "Z",
            "expiresAt": escrow.expires_at.isoformat() + "Z",
            "dataDeliveryDeadline": escrow.data_condition.delivery_deadline.isoformat() + "Z",
            "xrplSequence": escrow.xrpl_sequence,
            "fulfillmentTx": escrow.fulfillment_tx
        }
    
    def get_xrpl_memo_data(self, escrow_id: str) -> Dict[str, str]:
        """XRPL 트랜잭션 메모용 데이터 생성"""
        if escrow_id not in self.active_escrows:
            return {}
        
        escrow = self.active_escrows[escrow_id]
        
        return {
            "EscrowID": escrow.escrow_id,
            "ConsentID": escrow.consent_id,
            "DataHash": escrow.data_condition.fhir_bundle_hash[:32],  # 메모 길이 제한
            "Amount": str(escrow.amount),
            "Purpose": "HealthDataPayment"
        }
    
    def _build_escrow_create_transaction(self, escrow: EscrowContract) -> Dict[str, Any]:
        """XRPL EscrowCreate 트랜잭션 구성"""
        
        # XRP를 drops로 변환 (1 XRP = 1,000,000 drops)
        amount_drops = str(int(escrow.amount * 1_000_000))
        
        # 만료 시간을 Ripple Epoch로 변환
        ripple_epoch_offset = 946684800  # 2000-01-01 00:00:00 UTC
        finish_after = int(escrow.expires_at.timestamp()) - ripple_epoch_offset
        
        transaction = {
            "TransactionType": "EscrowCreate",
            "Account": escrow.payer,
            "Destination": escrow.payee,
            "Amount": amount_drops,
            "FinishAfter": finish_after,
            "Condition": escrow.data_condition.preimage_hash,
            "Memos": [
                {
                    "Memo": {
                        "MemoType": self._hex_encode("SportiQueEscrow"),
                        "MemoData": self._hex_encode(json.dumps(self.get_xrpl_memo_data(escrow.escrow_id)))
                    }
                }
            ]
        }
        
        return transaction
    
    def _build_escrow_finish_transaction(self, escrow: EscrowContract, preimage: str) -> Dict[str, Any]:
        """XRPL EscrowFinish 트랜잭션 구성"""
        
        transaction = {
            "TransactionType": "EscrowFinish",
            "Account": escrow.payee,  # 수취인이 완료 트랜잭션 제출
            "Owner": escrow.payer,
            "OfferSequence": escrow.xrpl_sequence,
            "Fulfillment": preimage.upper(),
            "Memos": [
                {
                    "Memo": {
                        "MemoType": self._hex_encode("SportiQueComplete"),
                        "MemoData": self._hex_encode(json.dumps({
                            "EscrowID": escrow.escrow_id,
                            "ConsentID": escrow.consent_id,
                            "CompletedAt": datetime.utcnow().isoformat() + "Z"
                        }))
                    }
                }
            ]
        }
        
        return transaction
    
    def _build_escrow_cancel_transaction(self, escrow: EscrowContract) -> Dict[str, Any]:
        """XRPL EscrowCancel 트랜잭션 구성"""
        
        transaction = {
            "TransactionType": "EscrowCancel",
            "Account": escrow.payer,  # 지불자가 취소 트랜잭션 제출
            "Owner": escrow.payer,
            "OfferSequence": escrow.xrpl_sequence,
            "Memos": [
                {
                    "Memo": {
                        "MemoType": self._hex_encode("SportiQueCancel"),
                        "MemoData": self._hex_encode(json.dumps({
                            "EscrowID": escrow.escrow_id,
                            "CancelledAt": datetime.utcnow().isoformat() + "Z",
                            "Reason": "Expired"
                        }))
                    }
                }
            ]
        }
        
        return transaction
    
    def _generate_preimage(self) -> str:
        """PREIMAGE-SHA-256 조건용 비밀값 생성"""
        return secrets.token_hex(32)
    
    def _generate_id(self) -> str:
        """고유 ID 생성"""
        return secrets.token_hex(16)
    
    def _hex_encode(self, text: str) -> str:
        """텍스트를 16진수로 인코딩"""
        return text.encode('utf-8').hex().upper()
    
    def _log_escrow_action(self, action: str, escrow_id: str, payer: str, payee: str, amount: float):
        """에스크로 액션 로깅"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": action,
            "escrowId": escrow_id,
            "payer": payer,
            "payee": payee,
            "amount": amount
        }
        self.escrow_history.append(log_entry)


# 사용 예제
if __name__ == "__main__":
    # 에스크로 관리자 초기화 (테스트넷)
    escrow_manager = XRPLEscrowManager(testnet=True)
    
    # 테스트 주소들
    research_institute = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"  # 연구기관
    patient = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"  # 환자
    
    # FHIR Bundle 해시 (실제로는 데이터에서 생성)
    fhir_bundle_hash = hashlib.sha256(b"sample_fhir_bundle_data").hexdigest()
    
    # 에스크로 오퍼 생성
    escrow_contract, xrpl_tx = escrow_manager.create_escrow_offer(
        payer_address=research_institute,
        payee_address=patient,
        amount=50.0,  # 50 XRP
        consent_id="urn:uuid:consent-123",
        fhir_bundle_hash=fhir_bundle_hash,
        delivery_hours=72
    )
    
    print("=== 생성된 에스크로 계약 ===")
    print(json.dumps(asdict(escrow_contract), indent=2, ensure_ascii=False, default=str))
    
    print("\n=== XRPL EscrowCreate 트랜잭션 ===")
    print(json.dumps(xrpl_tx, indent=2, ensure_ascii=False))
    
    # 에스크로 잠금 시뮬레이션
    escrow_manager.lock_escrow_funds(escrow_contract.escrow_id, 12345)
    
    # 에스크로 이행 시뮬레이션
    success, finish_tx = escrow_manager.fulfill_escrow(
        escrow_contract.escrow_id,
        fhir_bundle_hash,
        escrow_contract.data_condition.preimage
    )
    
    if success:
        print("\n=== XRPL EscrowFinish 트랜잭션 ===")
        print(json.dumps(finish_tx, indent=2, ensure_ascii=False))
    
    # 에스크로 상태 확인
    status = escrow_manager.get_escrow_status(escrow_contract.escrow_id)
    print("\n=== 에스크로 상태 ===")
    print(json.dumps(status, indent=2, ensure_ascii=False))
