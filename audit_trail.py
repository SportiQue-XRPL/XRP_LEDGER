"""
감사추적 컨트랙트 (Audit Trail Contract)
XRPL 기반 건강 데이터 거래 감사 및 추적
"""

import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum


class AuditEventType(Enum):
    """감사 이벤트 타입"""
    CONSENT_CREATED = "consent_created"
    CONSENT_WITHDRAWN = "consent_withdrawn"
    DATA_REQUESTED = "data_requested"
    ESCROW_CREATED = "escrow_created"
    ESCROW_LOCKED = "escrow_locked"
    DATA_DELIVERED = "data_delivered"
    PAYMENT_COMPLETED = "payment_completed"
    ACCESS_GRANTED = "access_granted"
    ACCESS_REVOKED = "access_revoked"
    COMPLIANCE_CHECK = "compliance_check"


@dataclass
class AuditEvent:
    """감사 이벤트"""
    event_id: str
    event_type: AuditEventType
    timestamp: datetime
    actor: str  # 행위자 (DID 또는 XRPL 주소)
    subject: str  # 대상 (환자 DID)
    resource_id: str  # 관련 리소스 ID (동의서 ID, 에스크로 ID 등)
    xrpl_tx_hash: Optional[str] = None  # 관련 XRPL 트랜잭션 해시
    metadata: Optional[Dict[str, Any]] = None
    compliance_status: Optional[str] = None


@dataclass
class DataAccessLog:
    """데이터 접근 로그"""
    access_id: str
    consent_id: str
    accessor: str  # 접근자 (연구기관 등)
    data_subject: str  # 데이터 주체 (환자)
    data_types: List[str]  # 접근한 데이터 타입들
    access_time: datetime
    access_purpose: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass
class ComplianceReport:
    """규정 준수 보고서"""
    report_id: str
    period_start: datetime
    period_end: datetime
    total_consents: int
    active_consents: int
    withdrawn_consents: int
    data_transfers: int
    compliance_violations: List[Dict[str, Any]]
    generated_at: datetime


class AuditTrailManager:
    """감사추적 관리자"""
    
    def __init__(self, platform_did: str):
        self.platform_did = platform_did
        self.audit_events: List[AuditEvent] = []
        self.access_logs: List[DataAccessLog] = []
        self.xrpl_transactions: Dict[str, Dict[str, Any]] = {}
        
    def record_audit_event(self, 
                          event_type: AuditEventType,
                          actor: str,
                          subject: str,
                          resource_id: str,
                          xrpl_tx_hash: Optional[str] = None,
                          metadata: Optional[Dict[str, Any]] = None) -> str:
        """감사 이벤트 기록"""
        
        event_id = f"audit_{self._generate_id()}"
        
        audit_event = AuditEvent(
            event_id=event_id,
            event_type=event_type,
            timestamp=datetime.utcnow(),
            actor=actor,
            subject=subject,
            resource_id=resource_id,
            xrpl_tx_hash=xrpl_tx_hash,
            metadata=metadata or {}
        )
        
        # 규정 준수 상태 확인
        audit_event.compliance_status = self._check_compliance(audit_event)
        
        self.audit_events.append(audit_event)
        
        return event_id
    
    def record_data_access(self,
                          consent_id: str,
                          accessor: str,
                          data_subject: str,
                          data_types: List[str],
                          access_purpose: str,
                          ip_address: Optional[str] = None,
                          user_agent: Optional[str] = None) -> str:
        """데이터 접근 로그 기록"""
        
        access_id = f"access_{self._generate_id()}"
        
        access_log = DataAccessLog(
            access_id=access_id,
            consent_id=consent_id,
            accessor=accessor,
            data_subject=data_subject,
            data_types=data_types,
            access_time=datetime.utcnow(),
            access_purpose=access_purpose,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        self.access_logs.append(access_log)
        
        # 접근 이벤트도 감사 로그에 기록
        self.record_audit_event(
            event_type=AuditEventType.ACCESS_GRANTED,
            actor=accessor,
            subject=data_subject,
            resource_id=consent_id,
            metadata={
                "accessId": access_id,
                "dataTypes": data_types,
                "purpose": access_purpose
            }
        )
        
        return access_id
    
    def record_xrpl_transaction(self, 
                               tx_hash: str, 
                               tx_data: Dict[str, Any],
                               related_event_id: Optional[str] = None):
        """XRPL 트랜잭션 기록"""
        
        self.xrpl_transactions[tx_hash] = {
            "txHash": tx_hash,
            "txData": tx_data,
            "recordedAt": datetime.utcnow().isoformat() + "Z",
            "relatedEventId": related_event_id
        }
        
        # 트랜잭션 메모에서 감사 정보 추출
        self._extract_audit_info_from_memo(tx_hash, tx_data)
    
    def get_audit_trail(self, 
                       subject: Optional[str] = None,
                       resource_id: Optional[str] = None,
                       start_date: Optional[datetime] = None,
                       end_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """감사 추적 조회"""
        
        filtered_events = self.audit_events.copy()
        
        # 필터링
        if subject:
            filtered_events = [e for e in filtered_events if e.subject == subject]
        
        if resource_id:
            filtered_events = [e for e in filtered_events if e.resource_id == resource_id]
        
        if start_date:
            filtered_events = [e for e in filtered_events if e.timestamp >= start_date]
        
        if end_date:
            filtered_events = [e for e in filtered_events if e.timestamp <= end_date]
        
        # 시간순 정렬
        filtered_events.sort(key=lambda x: x.timestamp)
        
        return [self._event_to_dict(event) for event in filtered_events]
    
    def get_data_access_history(self, 
                               data_subject: str,
                               days: int = 30) -> List[Dict[str, Any]]:
        """데이터 접근 이력 조회"""
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        filtered_logs = [
            log for log in self.access_logs 
            if log.data_subject == data_subject and log.access_time >= cutoff_date
        ]
        
        # 시간순 정렬
        filtered_logs.sort(key=lambda x: x.access_time, reverse=True)
        
        return [asdict(log) for log in filtered_logs]
    
    def generate_compliance_report(self, 
                                  start_date: datetime,
                                  end_date: datetime) -> ComplianceReport:
        """규정 준수 보고서 생성"""
        
        report_id = f"compliance_{self._generate_id()}"
        
        # 기간 내 이벤트 필터링
        period_events = [
            e for e in self.audit_events 
            if start_date <= e.timestamp <= end_date
        ]
        
        # 통계 계산
        consent_created = len([e for e in period_events if e.event_type == AuditEventType.CONSENT_CREATED])
        consent_withdrawn = len([e for e in period_events if e.event_type == AuditEventType.CONSENT_WITHDRAWN])
        data_transfers = len([e for e in period_events if e.event_type == AuditEventType.DATA_DELIVERED])
        
        # 규정 위반 사항 확인
        violations = [
            {
                "eventId": e.event_id,
                "type": "COMPLIANCE_VIOLATION",
                "description": f"Non-compliant {e.event_type.value}",
                "timestamp": e.timestamp.isoformat() + "Z"
            }
            for e in period_events 
            if e.compliance_status == "NON_COMPLIANT"
        ]
        
        report = ComplianceReport(
            report_id=report_id,
            period_start=start_date,
            period_end=end_date,
            total_consents=consent_created,
            active_consents=consent_created - consent_withdrawn,
            withdrawn_consents=consent_withdrawn,
            data_transfers=data_transfers,
            compliance_violations=violations,
            generated_at=datetime.utcnow()
        )
        
        return report
    
    def verify_data_integrity(self, resource_id: str) -> Dict[str, Any]:
        """데이터 무결성 검증"""
        
        # 관련 이벤트들 조회
        related_events = [e for e in self.audit_events if e.resource_id == resource_id]
        
        if not related_events:
            return {"valid": False, "reason": "No audit trail found"}
        
        # 시간순 정렬
        related_events.sort(key=lambda x: x.timestamp)
        
        # 이벤트 체인 검증
        integrity_checks = []
        
        for i, event in enumerate(related_events):
            check = {
                "eventId": event.event_id,
                "timestamp": event.timestamp.isoformat() + "Z",
                "valid": True,
                "issues": []
            }
            
            # XRPL 트랜잭션 연결 확인
            if event.xrpl_tx_hash and event.xrpl_tx_hash not in self.xrpl_transactions:
                check["valid"] = False
                check["issues"].append("Missing XRPL transaction")
            
            # 이벤트 순서 확인
            if i > 0:
                prev_event = related_events[i-1]
                if event.timestamp < prev_event.timestamp:
                    check["valid"] = False
                    check["issues"].append("Invalid timestamp order")
            
            integrity_checks.append(check)
        
        overall_valid = all(check["valid"] for check in integrity_checks)
        
        return {
            "resourceId": resource_id,
            "valid": overall_valid,
            "eventCount": len(related_events),
            "checks": integrity_checks,
            "verifiedAt": datetime.utcnow().isoformat() + "Z"
        }
    
    def export_audit_data(self, 
                         format: str = "json",
                         include_xrpl_data: bool = True) -> str:
        """감사 데이터 내보내기"""
        
        export_data = {
            "platformDid": self.platform_did,
            "exportedAt": datetime.utcnow().isoformat() + "Z",
            "auditEvents": [self._event_to_dict(e) for e in self.audit_events],
            "accessLogs": [asdict(log) for log in self.access_logs]
        }
        
        if include_xrpl_data:
            export_data["xrplTransactions"] = self.xrpl_transactions
        
        if format.lower() == "json":
            return json.dumps(export_data, indent=2, ensure_ascii=False, default=str)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _check_compliance(self, event: AuditEvent) -> str:
        """규정 준수 상태 확인"""
        
        # PIPA 규정 준수 확인
        if event.event_type == AuditEventType.CONSENT_CREATED:
            required_fields = ["purpose", "dataTypes", "retentionPeriod", "recipient"]
            if event.metadata and all(field in event.metadata for field in required_fields):
                return "COMPLIANT"
            else:
                return "NON_COMPLIANT"
        
        # 데이터 접근 시 동의 확인
        elif event.event_type == AuditEventType.ACCESS_GRANTED:
            # 실제 구현에서는 동의 상태를 확인해야 함
            return "COMPLIANT"
        
        return "COMPLIANT"
    
    def _extract_audit_info_from_memo(self, tx_hash: str, tx_data: Dict[str, Any]):
        """XRPL 트랜잭션 메모에서 감사 정보 추출"""
        
        if "Memos" not in tx_data:
            return
        
        for memo in tx_data["Memos"]:
            if "Memo" in memo:
                memo_data = memo["Memo"]
                if "MemoData" in memo_data:
                    try:
                        # 16진수 디코딩
                        decoded_data = bytes.fromhex(memo_data["MemoData"]).decode('utf-8')
                        memo_json = json.loads(decoded_data)
                        
                        # 감사 이벤트 자동 생성
                        if "ConsentID" in memo_json:
                            self.record_audit_event(
                                event_type=AuditEventType.DATA_DELIVERED,
                                actor=tx_data.get("Account", "unknown"),
                                subject="extracted_from_memo",
                                resource_id=memo_json["ConsentID"],
                                xrpl_tx_hash=tx_hash,
                                metadata=memo_json
                            )
                    except Exception:
                        # 메모 파싱 실패는 무시
                        pass
    
    def _event_to_dict(self, event: AuditEvent) -> Dict[str, Any]:
        """감사 이벤트를 딕셔너리로 변환"""
        return {
            "eventId": event.event_id,
            "eventType": event.event_type.value,
            "timestamp": event.timestamp.isoformat() + "Z",
            "actor": event.actor,
            "subject": event.subject,
            "resourceId": event.resource_id,
            "xrplTxHash": event.xrpl_tx_hash,
            "metadata": event.metadata,
            "complianceStatus": event.compliance_status
        }
    
    def _generate_id(self) -> str:
        """고유 ID 생성"""
        import secrets
        return secrets.token_hex(16)


# 사용 예제
if __name__ == "__main__":
    # 감사추적 관리자 초기화
    audit_manager = AuditTrailManager("did:xrpl:sportique-platform-001")
    
    # 동의 생성 이벤트 기록
    consent_event_id = audit_manager.record_audit_event(
        event_type=AuditEventType.CONSENT_CREATED,
        actor="did:xrpl:patient-kim-001",
        subject="did:xrpl:patient-kim-001",
        resource_id="urn:uuid:consent-123",
        metadata={
            "purpose": "심방세동 연구",
            "dataTypes": ["Observation", "MedicationStatement"],
            "retentionPeriod": "5years",
            "recipient": "did:xrpl:seoul-national-hospital"
        }
    )
    
    # 에스크로 생성 이벤트 기록
    escrow_event_id = audit_manager.record_audit_event(
        event_type=AuditEventType.ESCROW_CREATED,
        actor="did:xrpl:seoul-national-hospital",
        subject="did:xrpl:patient-kim-001",
        resource_id="escrow_abc123",
        xrpl_tx_hash="E3FE6EA3D48F0C2B63448B89B73A7F9E8E1A2B3C4D5E6F7890ABCDEF12345678",
        metadata={
            "amount": 50.0,
            "currency": "XRP"
        }
    )
    
    # 데이터 접근 로그 기록
    access_id = audit_manager.record_data_access(
        consent_id="urn:uuid:consent-123",
        accessor="did:xrpl:seoul-national-hospital",
        data_subject="did:xrpl:patient-kim-001",
        data_types=["Observation", "MedicationStatement"],
        access_purpose="심방세동 연구를 위한 데이터 분석",
        ip_address="203.0.113.1"
    )
    
    print("=== 감사 추적 조회 ===")
    audit_trail = audit_manager.get_audit_trail(subject="did:xrpl:patient-kim-001")
    print(json.dumps(audit_trail, indent=2, ensure_ascii=False))
    
    print("\n=== 데이터 접근 이력 ===")
    access_history = audit_manager.get_data_access_history("did:xrpl:patient-kim-001")
    print(json.dumps(access_history, indent=2, ensure_ascii=False))
    
    print("\n=== 규정 준수 보고서 ===")
    start_date = datetime.utcnow() - timedelta(days=30)
    end_date = datetime.utcnow()
    compliance_report = audit_manager.generate_compliance_report(start_date, end_date)
    print(json.dumps(asdict(compliance_report), indent=2, ensure_ascii=False, default=str))
    
    print("\n=== 데이터 무결성 검증 ===")
    integrity_check = audit_manager.verify_data_integrity("urn:uuid:consent-123")
    print(json.dumps(integrity_check, indent=2, ensure_ascii=False))
