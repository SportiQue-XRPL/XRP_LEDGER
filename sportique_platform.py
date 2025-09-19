"""
SportiQue 통합 플랫폼 컨트랙트 (Integrated Platform Contract)
동의, 지불, 감사추적, FHIR 데이터 관리를 통합한 메인 플랫폼
"""

import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

# 개별 컨트랙트 임포트
from consent_manager import ConsentManager, ConsentScope, ConsentTerms, VerifiableCredential
from escrow_payment import XRPLEscrowManager, EscrowContract, EscrowStatus
from audit_trail import AuditTrailManager, AuditEventType
from fhir_manager import FHIRDataManager

# 추가 의존성
from cryptography.hazmat.primitives.asymmetric import rsa


class OfferStatus(Enum):
    """오퍼 상태"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COMPLETED = "completed"
    EXPIRED = "expired"


@dataclass
class DataOffer:
    """데이터 제공 오퍼"""
    offer_id: str
    requester: str  # 연구기관 DID
    requester_name: str
    data_types: List[str]  # FHIR 리소스 타입들
    purpose: str
    compensation: float  # XRP 금액
    collection_period: str
    retention_period: str
    third_party_sharing: bool
    valid_until: datetime
    created_at: datetime
    status: OfferStatus = OfferStatus.PENDING
    target_criteria: Optional[Dict[str, Any]] = None  # 대상 환자 조건


@dataclass
class DataTransaction:
    """데이터 거래"""
    transaction_id: str
    offer_id: str
    patient_did: str
    consent_id: str
    escrow_id: str
    bundle_id: str
    bundle_hash: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None


class SportiQuePlatform:
    """SportiQue 통합 플랫폼"""
    
    def __init__(self, platform_did: str, testnet: bool = True):
        self.platform_did = platform_did
        self.testnet = testnet
        
        # RSA 키 쌍 생성 (실제 환경에서는 안전하게 관리)
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        
        # 개별 관리자들 초기화
        self.consent_manager = ConsentManager(platform_did, self.private_key)
        self.escrow_manager = XRPLEscrowManager(testnet)
        self.audit_manager = AuditTrailManager(platform_did)
        self.fhir_manager = FHIRDataManager(platform_did)
        
        # 플랫폼 데이터
        self.offers: Dict[str, DataOffer] = {}
        self.transactions: Dict[str, DataTransaction] = {}
        self.user_profiles: Dict[str, Dict[str, Any]] = {}
    
    def create_data_offer(self,
                         requester_did: str,
                         requester_name: str,
                         data_types: List[str],
                         purpose: str,
                         compensation: float,
                         collection_period: str = "3months",
                         retention_period: str = "5years",
                         third_party_sharing: bool = False,
                         valid_days: int = 30,
                         target_criteria: Optional[Dict[str, Any]] = None) -> str:
        """데이터 제공 오퍼 생성"""
        
        offer_id = f"offer_{self._generate_id()}"
        
        offer = DataOffer(
            offer_id=offer_id,
            requester=requester_did,
            requester_name=requester_name,
            data_types=data_types,
            purpose=purpose,
            compensation=compensation,
            collection_period=collection_period,
            retention_period=retention_period,
            third_party_sharing=third_party_sharing,
            valid_until=datetime.utcnow() + timedelta(days=valid_days),
            created_at=datetime.utcnow(),
            target_criteria=target_criteria
        )
        
        self.offers[offer_id] = offer
        
        # 감사 이벤트 기록
        self.audit_manager.record_audit_event(
            event_type=AuditEventType.DATA_REQUESTED,
            actor=requester_did,
            subject="platform",
            resource_id=offer_id,
            metadata={
                "dataTypes": data_types,
                "purpose": purpose,
                "compensation": compensation
            }
        )
        
        return offer_id
    
    def accept_offer(self,
                    offer_id: str,
                    patient_did: str,
                    patient_xrpl_address: str,
                    requester_xrpl_address: str) -> Dict[str, str]:
        """오퍼 수락 및 전체 프로세스 시작"""
        
        if offer_id not in self.offers:
            raise ValueError("Offer not found")
        
        offer = self.offers[offer_id]
        
        if offer.status != OfferStatus.PENDING:
            raise ValueError("Offer is not available")
        
        if datetime.utcnow() > offer.valid_until:
            offer.status = OfferStatus.EXPIRED
            raise ValueError("Offer has expired")
        
        # 1. 동의서 생성
        consent_scope = ConsentScope(
            data_types=offer.data_types,
            collection_period=offer.collection_period,
            usage_purpose=offer.purpose,
            third_party_sharing=offer.third_party_sharing,
            retention_period=offer.retention_period
        )
        
        consent_terms = ConsentTerms(
            recipient=offer.requester,
            scope=consent_scope,
            compensation=offer.compensation,
            valid_until=offer.valid_until
        )
        
        consent_vc = self.consent_manager.create_consent_vc(patient_did, consent_terms)
        
        # 2. FHIR Bundle 생성
        bundle_id, bundle_hash = self.fhir_manager.create_sample_heart_rate_bundle(
            patient_id=patient_did.split(":")[-1],  # DID에서 ID 추출
            consent_id=consent_vc.id,
            days=7
        )
        
        # 3. 에스크로 생성
        escrow_contract, xrpl_tx = self.escrow_manager.create_escrow_offer(
            payer_address=requester_xrpl_address,
            payee_address=patient_xrpl_address,
            amount=offer.compensation,
            consent_id=consent_vc.id,
            fhir_bundle_hash=bundle_hash,
            delivery_hours=72
        )
        
        # 4. 거래 기록 생성
        transaction_id = f"tx_{self._generate_id()}"
        transaction = DataTransaction(
            transaction_id=transaction_id,
            offer_id=offer_id,
            patient_did=patient_did,
            consent_id=consent_vc.id,
            escrow_id=escrow_contract.escrow_id,
            bundle_id=bundle_id,
            bundle_hash=bundle_hash,
            status="CONSENT_GIVEN",
            created_at=datetime.utcnow()
        )
        
        self.transactions[transaction_id] = transaction
        offer.status = OfferStatus.ACCEPTED
        
        # 5. 감사 이벤트 기록
        self.audit_manager.record_audit_event(
            event_type=AuditEventType.CONSENT_CREATED,
            actor=patient_did,
            subject=patient_did,
            resource_id=consent_vc.id,
            metadata={
                "offerId": offer_id,
                "transactionId": transaction_id,
                "escrowId": escrow_contract.escrow_id
            }
        )
        
        return {
            "transactionId": transaction_id,
            "consentId": consent_vc.id,
            "escrowId": escrow_contract.escrow_id,
            "bundleId": bundle_id,
            "bundleHash": bundle_hash,
            "xrplTransaction": json.dumps(xrpl_tx)
        }
    
    def complete_data_delivery(self,
                              transaction_id: str,
                              xrpl_sequence: int) -> Dict[str, Any]:
        """데이터 전달 완료 및 자동 정산"""
        
        if transaction_id not in self.transactions:
            raise ValueError("Transaction not found")
        
        transaction = self.transactions[transaction_id]
        
        # 1. 에스크로 잠금 확인
        self.escrow_manager.lock_escrow_funds(transaction.escrow_id, xrpl_sequence)
        
        # 2. 데이터 전달 (실제로는 암호화된 데이터 키 제공)
        escrow_contract = self.escrow_manager.active_escrows[transaction.escrow_id]
        
        # 3. 에스크로 이행
        success, finish_tx = self.escrow_manager.fulfill_escrow(
            transaction.escrow_id,
            transaction.bundle_hash,
            escrow_contract.data_condition.preimage
        )
        
        if not success:
            raise ValueError("Failed to fulfill escrow")
        
        # 4. 거래 상태 업데이트
        transaction.status = "COMPLETED"
        transaction.completed_at = datetime.utcnow()
        
        # 5. 감사 이벤트 기록
        self.audit_manager.record_audit_event(
            event_type=AuditEventType.DATA_DELIVERED,
            actor=self.platform_did,
            subject=transaction.patient_did,
            resource_id=transaction.consent_id,
            metadata={
                "transactionId": transaction_id,
                "bundleHash": transaction.bundle_hash,
                "escrowId": transaction.escrow_id
            }
        )
        
        self.audit_manager.record_audit_event(
            event_type=AuditEventType.PAYMENT_COMPLETED,
            actor=self.platform_did,
            subject=transaction.patient_did,
            resource_id=transaction.escrow_id,
            metadata={
                "amount": escrow_contract.amount,
                "currency": "XRP"
            }
        )
        
        return {
            "success": True,
            "transactionId": transaction_id,
            "status": transaction.status,
            "completedAt": transaction.completed_at.isoformat() + "Z",
            "xrplFinishTransaction": finish_tx
        }
    
    def get_available_offers(self, 
                           patient_criteria: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """사용 가능한 오퍼 목록 조회"""
        
        available_offers = []
        current_time = datetime.utcnow()
        
        for offer in self.offers.values():
            if offer.status == OfferStatus.PENDING and offer.valid_until > current_time:
                # 환자 조건 매칭 (간단한 예시)
                if patient_criteria and offer.target_criteria:
                    if not self._match_criteria(patient_criteria, offer.target_criteria):
                        continue
                
                offer_dict = asdict(offer)
                offer_dict['created_at'] = offer.created_at.isoformat() + "Z"
                offer_dict['valid_until'] = offer.valid_until.isoformat() + "Z"
                available_offers.append(offer_dict)
        
        return available_offers
    
    def get_transaction_status(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """거래 상태 조회"""
        
        if transaction_id not in self.transactions:
            return None
        
        transaction = self.transactions[transaction_id]
        
        # 에스크로 상태 조회
        escrow_status = self.escrow_manager.get_escrow_status(transaction.escrow_id)
        
        # 동의 상태 확인
        offer = self.offers[transaction.offer_id]
        consent_valid = self.consent_manager.verify_consent(
            transaction.consent_id, 
            offer.requester
        )
        
        result = {
            "transactionId": transaction.transaction_id,
            "offerId": transaction.offer_id,
            "patientDid": transaction.patient_did,
            "status": transaction.status,
            "createdAt": transaction.created_at.isoformat() + "Z",
            "completedAt": transaction.completed_at.isoformat() + "Z" if transaction.completed_at else None,
            "consentValid": consent_valid,
            "escrowStatus": escrow_status
        }
        
        return result
    
    def get_patient_dashboard(self, patient_did: str) -> Dict[str, Any]:
        """환자 대시보드 데이터"""
        
        # 환자의 거래 내역
        patient_transactions = [
            tx for tx in self.transactions.values() 
            if tx.patient_did == patient_did
        ]
        
        # 활성 동의서들
        active_consents = []
        for consent_id, consent_vc in self.consent_manager.active_consents.items():
            if consent_vc.credential_subject["id"] == patient_did:
                active_consents.append({
                    "consentId": consent_id,
                    "recipient": consent_vc.credential_subject["consentTerms"]["recipient"],
                    "purpose": consent_vc.credential_subject["consentTerms"]["purpose"],
                    "validUntil": consent_vc.credential_subject["validUntil"],
                    "compensation": consent_vc.credential_subject["consentTerms"]["compensation"]
                })
        
        # 데이터 접근 이력
        access_history = self.audit_manager.get_data_access_history(patient_did, days=30)
        
        # 수익 통계
        total_earnings = sum(
            tx.escrow_id in self.escrow_manager.active_escrows and 
            self.escrow_manager.active_escrows[tx.escrow_id].status == EscrowStatus.FULFILLED
            and self.escrow_manager.active_escrows[tx.escrow_id].amount or 0
            for tx in patient_transactions
        )
        
        return {
            "patientDid": patient_did,
            "activeConsents": len(active_consents),
            "totalTransactions": len(patient_transactions),
            "totalEarnings": total_earnings,
            "recentTransactions": [asdict(tx) for tx in patient_transactions[-5:]],
            "activeConsentDetails": active_consents,
            "recentAccess": access_history[:10]
        }
    
    def withdraw_consent(self, consent_id: str, patient_did: str) -> bool:
        """동의 철회"""
        
        success = self.consent_manager.withdraw_consent(consent_id, patient_did)
        
        if success:
            # 관련 거래들 찾기
            related_transactions = [
                tx for tx in self.transactions.values() 
                if tx.consent_id == consent_id
            ]
            
            # 진행 중인 에스크로 취소
            for tx in related_transactions:
                if tx.status not in ["COMPLETED", "CANCELLED"]:
                    # 에스크로 취소 시도
                    cancel_success, cancel_tx = self.escrow_manager.cancel_escrow(tx.escrow_id)
                    if cancel_success:
                        tx.status = "CANCELLED"
            
            # 감사 이벤트 기록
            self.audit_manager.record_audit_event(
                event_type=AuditEventType.CONSENT_WITHDRAWN,
                actor=patient_did,
                subject=patient_did,
                resource_id=consent_id
            )
        
        return success
    
    def _match_criteria(self, patient_criteria: Dict[str, Any], target_criteria: Dict[str, Any]) -> bool:
        """환자 조건 매칭 (간단한 구현)"""
        
        for key, target_value in target_criteria.items():
            if key not in patient_criteria:
                return False
            
            patient_value = patient_criteria[key]
            
            # 나이 범위 확인
            if key == "age":
                if isinstance(target_value, dict):
                    min_age = target_value.get("min", 0)
                    max_age = target_value.get("max", 150)
                    if not (min_age <= patient_value <= max_age):
                        return False
            
            # 조건 포함 확인
            elif key == "conditions":
                if not any(condition in patient_value for condition in target_value):
                    return False
            
            # 정확한 매칭
            else:
                if patient_value != target_value:
                    return False
        
        return True
    
    def _generate_id(self) -> str:
        """고유 ID 생성"""
        import secrets
        return secrets.token_hex(16)


# 사용 예제 및 데모 시나리오
if __name__ == "__main__":
    print("=== SportiQue 플랫폼 데모 시나리오 ===\n")
    
    # 플랫폼 초기화
    platform = SportiQuePlatform("did:xrpl:sportique-platform-001", testnet=True)
    
    # 1. 연구기관이 데이터 오퍼 생성
    print("1. 연구기관이 심방세동 연구를 위한 데이터 오퍼 생성")
    offer_id = platform.create_data_offer(
        requester_did="did:xrpl:seoul-national-hospital-cardiology",
        requester_name="서울대학교병원 심장내과",
        data_types=["Observation", "Condition", "Device"],
        purpose="심방세동 환자의 심박수 패턴 분석 연구",
        compensation=50.0,
        collection_period="3months",
        retention_period="5years",
        third_party_sharing=False,
        valid_days=30,
        target_criteria={
            "age": {"min": 40, "max": 80},
            "conditions": ["49436004"]  # 심방세동 SNOMED 코드
        }
    )
    print(f"생성된 오퍼 ID: {offer_id}\n")
    
    # 2. 환자가 사용 가능한 오퍼 조회
    print("2. 환자가 사용 가능한 오퍼 조회")
    patient_criteria = {
        "age": 55,
        "conditions": ["49436004"],
        "gender": "male"
    }
    available_offers = platform.get_available_offers(patient_criteria)
    print(f"매칭되는 오퍼 수: {len(available_offers)}\n")
    
    # 3. 환자가 오퍼 수락
    print("3. 환자가 오퍼 수락 및 동의")
    patient_did = "did:xrpl:patient-kim-001"
    patient_address = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
    requester_address = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
    
    acceptance_result = platform.accept_offer(
        offer_id=offer_id,
        patient_did=patient_did,
        patient_xrpl_address=patient_address,
        requester_xrpl_address=requester_address
    )
    
    transaction_id = acceptance_result["transactionId"]
    print(f"거래 ID: {transaction_id}")
    print(f"동의서 ID: {acceptance_result['consentId']}")
    print(f"에스크로 ID: {acceptance_result['escrowId']}")
    print(f"FHIR Bundle Hash: {acceptance_result['bundleHash']}\n")
    
    # 4. 데이터 전달 완료 및 자동 정산
    print("4. 데이터 전달 완료 및 자동 정산")
    completion_result = platform.complete_data_delivery(
        transaction_id=transaction_id,
        xrpl_sequence=12345  # 실제 XRPL 트랜잭션 시퀀스
    )
    print(f"정산 완료: {completion_result['success']}")
    print(f"완료 시간: {completion_result['completedAt']}\n")
    
    # 5. 환자 대시보드 조회
    print("5. 환자 대시보드")
    dashboard = platform.get_patient_dashboard(patient_did)
    print(f"활성 동의서: {dashboard['activeConsents']}개")
    print(f"총 거래: {dashboard['totalTransactions']}건")
    print(f"총 수익: {dashboard['totalEarnings']} XRP\n")
    
    # 6. 감사 추적 조회
    print("6. 감사 추적 조회")
    audit_trail = platform.audit_manager.get_audit_trail(subject=patient_did)
    print(f"감사 이벤트 수: {len(audit_trail)}")
    for event in audit_trail[-3:]:  # 최근 3개 이벤트
        print(f"- {event['eventType']}: {event['timestamp']}")
    
    print("\n=== 데모 시나리오 완료 ===")
    print("SportiQue는 건강데이터를 '동의 가능한 자산'으로 바꿉니다.")
    print("동의는 VC로, 데이터는 FHIR로, 돈은 XRPL 에스크로로.")
    print("연구기관은 즉시 확보, 환자는 즉시 정산, 모든 건은 온체인 감사.")
