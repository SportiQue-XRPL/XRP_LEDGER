"""
동의 관리 컨트랙트 (Consent Manager Contract)
W3C Verifiable Credentials 2.0 기반 건강 데이터 동의 관리
"""

import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey


@dataclass
class ConsentScope:
    """동의 범위 정의"""
    data_types: List[str]  # FHIR 리소스 타입들 (Observation, MedicationStatement 등)
    collection_period: str  # 수집 기간 (예: "3months", "1year")
    usage_purpose: str  # 사용 목적
    third_party_sharing: bool  # 제3자 제공 여부
    retention_period: str  # 보유 기간


@dataclass
class ConsentTerms:
    """동의 조건"""
    recipient: str  # 데이터 수신자 (연구기관 등)
    scope: ConsentScope
    compensation: float  # 보상 금액 (XRP)
    valid_until: datetime  # 동의 만료일
    withdrawal_right: bool = True  # 철회권
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()


@dataclass
class VerifiableCredential:
    """W3C VC 2.0 기반 동의서"""
    context: List[str]
    id: str
    type: List[str]
    issuer: str  # 플랫폼 DID
    issuance_date: datetime
    expiration_date: datetime
    credential_subject: Dict[str, Any]
    proof: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """VC를 딕셔너리로 변환"""
        return {
            "@context": self.context,
            "id": self.id,
            "type": self.type,
            "issuer": self.issuer,
            "issuanceDate": self.issuance_date.isoformat() + "Z",
            "expirationDate": self.expiration_date.isoformat() + "Z",
            "credentialSubject": self.credential_subject,
            "proof": self.proof
        }


class ConsentManager:
    """동의 관리 핵심 클래스"""
    
    def __init__(self, platform_did: str, private_key: RSAPrivateKey):
        self.platform_did = platform_did
        self.private_key = private_key
        self.public_key = private_key.public_key()
        self.active_consents: Dict[str, VerifiableCredential] = {}
        self.consent_history: List[Dict[str, Any]] = []
    
    def create_consent_vc(self, 
                         patient_did: str, 
                         consent_terms: ConsentTerms) -> VerifiableCredential:
        """동의서 VC 생성"""
        
        # VC ID 생성
        vc_id = f"urn:uuid:{self._generate_uuid()}"
        
        # Credential Subject 구성 (PIPA 필수 고지사항 포함)
        credential_subject = {
            "id": patient_did,
            "consentGiven": True,
            "consentTerms": {
                "recipient": consent_terms.recipient,
                "purpose": consent_terms.scope.usage_purpose,
                "dataTypes": consent_terms.scope.data_types,
                "collectionPeriod": consent_terms.scope.collection_period,
                "retentionPeriod": consent_terms.scope.retention_period,
                "thirdPartySharing": consent_terms.scope.third_party_sharing,
                "compensation": {
                    "amount": consent_terms.compensation,
                    "currency": "XRP"
                },
                "withdrawalRight": consent_terms.withdrawal_right,
                "pipaCompliance": {
                    "recipientNotified": True,
                    "purposeSpecified": True,
                    "dataTypesListed": True,
                    "retentionPeriodSpecified": True,
                    "consequencesOfRefusal": "데이터 제공 불가로 인한 연구 참여 제한"
                }
            },
            "consentDate": consent_terms.created_at.isoformat() + "Z",
            "validUntil": consent_terms.valid_until.isoformat() + "Z"
        }
        
        # VC 생성
        vc = VerifiableCredential(
            context=[
                "https://www.w3.org/2018/credentials/v1",
                "https://www.w3.org/2018/credentials/examples/v1",
                "https://sportique.health/contexts/consent/v1"
            ],
            id=vc_id,
            type=["VerifiableCredential", "HealthDataConsentCredential"],
            issuer=self.platform_did,
            issuance_date=datetime.utcnow(),
            expiration_date=consent_terms.valid_until,
            credential_subject=credential_subject
        )
        
        # 디지털 서명 추가
        vc.proof = self._create_proof(vc)
        
        # 활성 동의 목록에 추가
        self.active_consents[vc_id] = vc
        
        # 히스토리 기록
        self._log_consent_action("CREATED", vc_id, patient_did, consent_terms.recipient)
        
        return vc
    
    def withdraw_consent(self, vc_id: str, patient_did: str) -> bool:
        """동의 철회"""
        if vc_id not in self.active_consents:
            return False
        
        vc = self.active_consents[vc_id]
        
        # 환자 DID 확인
        if vc.credential_subject["id"] != patient_did:
            return False
        
        # 동의 상태 업데이트
        vc.credential_subject["consentGiven"] = False
        vc.credential_subject["withdrawalDate"] = datetime.utcnow().isoformat() + "Z"
        
        # 활성 목록에서 제거
        del self.active_consents[vc_id]
        
        # 히스토리 기록
        self._log_consent_action("WITHDRAWN", vc_id, patient_did, 
                                vc.credential_subject["consentTerms"]["recipient"])
        
        return True
    
    def verify_consent(self, vc_id: str, recipient: str) -> bool:
        """동의 유효성 검증"""
        if vc_id not in self.active_consents:
            return False
        
        vc = self.active_consents[vc_id]
        
        # 만료일 확인
        if datetime.utcnow() > vc.expiration_date:
            return False
        
        # 수신자 확인
        if vc.credential_subject["consentTerms"]["recipient"] != recipient:
            return False
        
        # 동의 상태 확인
        if not vc.credential_subject["consentGiven"]:
            return False
        
        # 디지털 서명 검증
        return self._verify_proof(vc)
    
    def get_consent_metadata_for_xrpl(self, vc_id: str) -> Dict[str, str]:
        """XRPL 트랜잭션 메모용 메타데이터 생성"""
        if vc_id not in self.active_consents:
            return {}
        
        vc = self.active_consents[vc_id]
        vc_hash = self._calculate_vc_hash(vc)
        
        return {
            "ConsentID": vc_id,
            "ConsentHash": vc_hash,
            "ConsentVersion": "2.0",
            "DataTypes": ",".join(vc.credential_subject["consentTerms"]["dataTypes"]),
            "Purpose": vc.credential_subject["consentTerms"]["purpose"][:50]  # XRPL 메모 길이 제한
        }
    
    def _create_proof(self, vc: VerifiableCredential) -> Dict[str, Any]:
        """VC 디지털 서명 생성"""
        # VC 내용을 JSON으로 직렬화
        vc_dict = vc.to_dict()
        vc_json = json.dumps(vc_dict, sort_keys=True, separators=(',', ':'))
        
        # SHA-256 해시 생성
        message_hash = hashlib.sha256(vc_json.encode()).digest()
        
        # RSA 서명 생성 (실제 구현에서는 더 안전한 방식 사용)
        signature = self.private_key.sign(
            message_hash,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        return {
            "type": "RsaSignature2018",
            "created": datetime.utcnow().isoformat() + "Z",
            "verificationMethod": f"{self.platform_did}#key-1",
            "proofPurpose": "assertionMethod",
            "signatureValue": signature.hex()
        }
    
    def _verify_proof(self, vc: VerifiableCredential) -> bool:
        """VC 디지털 서명 검증"""
        try:
            # 서명 제거한 VC로 해시 재생성
            vc_dict = vc.to_dict()
            del vc_dict["proof"]
            vc_json = json.dumps(vc_dict, sort_keys=True, separators=(',', ':'))
            message_hash = hashlib.sha256(vc_json.encode()).digest()
            
            # 서명 검증
            signature = bytes.fromhex(vc.proof["signatureValue"])
            self.public_key.verify(
                signature,
                message_hash,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            return False
    
    def _calculate_vc_hash(self, vc: VerifiableCredential) -> str:
        """VC 해시 계산"""
        vc_json = json.dumps(vc.to_dict(), sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(vc_json.encode()).hexdigest()
    
    def _generate_uuid(self) -> str:
        """UUID 생성"""
        import uuid
        return str(uuid.uuid4())
    
    def _log_consent_action(self, action: str, vc_id: str, patient_did: str, recipient: str):
        """동의 액션 로깅"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": action,
            "consentId": vc_id,
            "patientDid": patient_did,
            "recipient": recipient
        }
        self.consent_history.append(log_entry)


# 사용 예제
if __name__ == "__main__":
    # RSA 키 쌍 생성 (실제 환경에서는 안전하게 관리)
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )
    
    # 동의 관리자 초기화
    platform_did = "did:xrpl:sportique-platform-001"
    consent_manager = ConsentManager(platform_did, private_key)
    
    # 동의 조건 설정
    consent_scope = ConsentScope(
        data_types=["Observation", "MedicationStatement", "Condition"],
        collection_period="3months",
        usage_purpose="심방세동 연구를 위한 심박수 패턴 분석",
        third_party_sharing=False,
        retention_period="5years"
    )
    
    consent_terms = ConsentTerms(
        recipient="did:xrpl:seoul-national-hospital-cardiology",
        scope=consent_scope,
        compensation=50.0,  # 50 XRP
        valid_until=datetime.utcnow() + timedelta(days=365)
    )
    
    # 동의서 VC 생성
    patient_did = "did:xrpl:patient-kim-001"
    consent_vc = consent_manager.create_consent_vc(patient_did, consent_terms)
    
    print("=== 생성된 동의서 VC ===")
    print(json.dumps(consent_vc.to_dict(), indent=2, ensure_ascii=False))
    
    print("\n=== XRPL 메모용 메타데이터 ===")
    metadata = consent_manager.get_consent_metadata_for_xrpl(consent_vc.id)
    print(json.dumps(metadata, indent=2, ensure_ascii=False))
    
    # 동의 검증
    is_valid = consent_manager.verify_consent(
        consent_vc.id, 
        "did:xrpl:seoul-national-hospital-cardiology"
    )
    print(f"\n동의 유효성: {is_valid}")
