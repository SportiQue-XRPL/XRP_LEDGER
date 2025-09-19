"""
FHIR 데이터 관리 컨트랙트 (FHIR Data Manager Contract)
건강 데이터 표준화 및 Bundle 생성/관리
"""

import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import uuid


class FHIRResourceType(Enum):
    """FHIR 리소스 타입"""
    PATIENT = "Patient"
    OBSERVATION = "Observation"
    MEDICATION_STATEMENT = "MedicationStatement"
    CONDITION = "Condition"
    DIAGNOSTIC_REPORT = "DiagnosticReport"
    DEVICE = "Device"
    PROCEDURE = "Procedure"


@dataclass
class FHIRResource:
    """FHIR 리소스 기본 구조"""
    resource_type: str
    id: str
    meta: Optional[Dict[str, Any]] = None
    text: Optional[Dict[str, Any]] = None
    contained: Optional[List[Dict[str, Any]]] = None
    extension: Optional[List[Dict[str, Any]]] = None
    modifier_extension: Optional[List[Dict[str, Any]]] = None


@dataclass
class FHIRBundle:
    """FHIR Bundle 구조"""
    id: str
    meta: Optional[Dict[str, Any]]
    type: str  # "collection", "searchset", "history", "transaction", etc.
    timestamp: datetime
    total: Optional[int]
    entry: List[Dict[str, Any]]
    signature: Optional[Dict[str, Any]] = None


class FHIRDataManager:
    """FHIR 데이터 관리자"""
    
    def __init__(self, organization_id: str):
        self.organization_id = organization_id
        self.bundles: Dict[str, FHIRBundle] = {}
        self.resources: Dict[str, FHIRResource] = {}
    
    def create_patient_resource(self, 
                               patient_id: str,
                               name: str,
                               birth_date: str,
                               gender: str,
                               phone: Optional[str] = None,
                               email: Optional[str] = None) -> Dict[str, Any]:
        """환자 리소스 생성"""
        
        patient_resource = {
            "resourceType": "Patient",
            "id": patient_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z",
                "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
            },
            "text": {
                "status": "generated",
                "div": f"<div xmlns=\"http://www.w3.org/1999/xhtml\">Patient: {name}</div>"
            },
            "name": [
                {
                    "use": "official",
                    "text": name,
                    "family": name.split()[-1] if " " in name else name,
                    "given": name.split()[:-1] if " " in name else []
                }
            ],
            "birthDate": birth_date,
            "gender": gender.lower()
        }
        
        # 연락처 정보 추가
        telecom = []
        if phone:
            telecom.append({
                "system": "phone",
                "value": phone,
                "use": "mobile"
            })
        if email:
            telecom.append({
                "system": "email",
                "value": email,
                "use": "home"
            })
        
        if telecom:
            patient_resource["telecom"] = telecom
        
        return patient_resource
    
    def create_observation_resource(self,
                                   observation_id: str,
                                   patient_id: str,
                                   code: str,
                                   display: str,
                                   value: Union[float, str],
                                   unit: Optional[str] = None,
                                   effective_datetime: Optional[datetime] = None,
                                   device_id: Optional[str] = None) -> Dict[str, Any]:
        """관찰 데이터 리소스 생성 (웨어러블 데이터 등)"""
        
        if effective_datetime is None:
            effective_datetime = datetime.utcnow()
        
        observation = {
            "resourceType": "Observation",
            "id": observation_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z",
                "profile": ["http://hl7.org/fhir/StructureDefinition/Observation"]
            },
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "vital-signs",
                            "display": "Vital Signs"
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": code,
                        "display": display
                    }
                ]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": effective_datetime.isoformat() + "Z"
        }
        
        # 값 설정
        if isinstance(value, (int, float)):
            observation["valueQuantity"] = {
                "value": value,
                "unit": unit or "",
                "system": "http://unitsofmeasure.org",
                "code": unit or ""
            }
        else:
            observation["valueString"] = str(value)
        
        # 디바이스 정보 추가
        if device_id:
            observation["device"] = {
                "reference": f"Device/{device_id}"
            }
        
        return observation
    
    def create_medication_statement(self,
                                   statement_id: str,
                                   patient_id: str,
                                   medication_code: str,
                                   medication_display: str,
                                   dosage: str,
                                   effective_period_start: datetime,
                                   effective_period_end: Optional[datetime] = None) -> Dict[str, Any]:
        """복용약물 리소스 생성"""
        
        medication_statement = {
            "resourceType": "MedicationStatement",
            "id": statement_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z"
            },
            "status": "active",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": medication_code,
                        "display": medication_display
                    }
                ]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectivePeriod": {
                "start": effective_period_start.isoformat() + "Z"
            },
            "dosage": [
                {
                    "text": dosage,
                    "timing": {
                        "repeat": {
                            "frequency": 1,
                            "period": 1,
                            "periodUnit": "d"
                        }
                    }
                }
            ]
        }
        
        if effective_period_end:
            medication_statement["effectivePeriod"]["end"] = effective_period_end.isoformat() + "Z"
        
        return medication_statement
    
    def create_condition_resource(self,
                                 condition_id: str,
                                 patient_id: str,
                                 condition_code: str,
                                 condition_display: str,
                                 clinical_status: str = "active",
                                 onset_datetime: Optional[datetime] = None) -> Dict[str, Any]:
        """질환 리소스 생성"""
        
        condition = {
            "resourceType": "Condition",
            "id": condition_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z"
            },
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": clinical_status
                    }
                ]
            },
            "verificationStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                        "code": "confirmed"
                    }
                ]
            },
            "code": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": condition_code,
                        "display": condition_display
                    }
                ]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            }
        }
        
        if onset_datetime:
            condition["onsetDateTime"] = onset_datetime.isoformat() + "Z"
        
        return condition
    
    def create_device_resource(self,
                              device_id: str,
                              device_name: str,
                              manufacturer: str,
                              model: str,
                              version: Optional[str] = None) -> Dict[str, Any]:
        """디바이스 리소스 생성 (웨어러블 기기 등)"""
        
        device = {
            "resourceType": "Device",
            "id": device_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z"
            },
            "status": "active",
            "deviceName": [
                {
                    "name": device_name,
                    "type": "user-friendly-name"
                }
            ],
            "manufacturer": manufacturer,
            "modelNumber": model
        }
        
        if version:
            device["version"] = [
                {
                    "type": {
                        "text": "software"
                    },
                    "value": version
                }
            ]
        
        return device
    
    def create_bundle(self,
                     bundle_id: str,
                     bundle_type: str,
                     resources: List[Dict[str, Any]],
                     patient_id: str,
                     consent_id: str) -> FHIRBundle:
        """FHIR Bundle 생성"""
        
        # Bundle 엔트리 생성
        entries = []
        for resource in resources:
            entry = {
                "fullUrl": f"urn:uuid:{resource['id']}",
                "resource": resource
            }
            entries.append(entry)
        
        # Bundle 메타데이터
        bundle_meta = {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "profile": ["http://hl7.org/fhir/StructureDefinition/Bundle"],
            "tag": [
                {
                    "system": "https://sportique.health/tags",
                    "code": "health-data-bundle",
                    "display": "Health Data Bundle"
                }
            ],
            "extension": [
                {
                    "url": "https://sportique.health/extensions/consent-reference",
                    "valueString": consent_id
                },
                {
                    "url": "https://sportique.health/extensions/data-subject",
                    "valueString": patient_id
                }
            ]
        }
        
        bundle = FHIRBundle(
            id=bundle_id,
            meta=bundle_meta,
            type=bundle_type,
            timestamp=datetime.utcnow(),
            total=len(entries),
            entry=entries
        )
        
        self.bundles[bundle_id] = bundle
        return bundle
    
    def bundle_to_dict(self, bundle: FHIRBundle) -> Dict[str, Any]:
        """Bundle을 딕셔너리로 변환"""
        return {
            "resourceType": "Bundle",
            "id": bundle.id,
            "meta": bundle.meta,
            "type": bundle.type,
            "timestamp": bundle.timestamp.isoformat() + "Z",
            "total": bundle.total,
            "entry": bundle.entry
        }
    
    def calculate_bundle_hash(self, bundle_id: str) -> str:
        """Bundle SHA-256 해시 계산"""
        if bundle_id not in self.bundles:
            raise ValueError(f"Bundle {bundle_id} not found")
        
        bundle = self.bundles[bundle_id]
        bundle_dict = self.bundle_to_dict(bundle)
        bundle_json = json.dumps(bundle_dict, sort_keys=True, separators=(',', ':'))
        
        return hashlib.sha256(bundle_json.encode()).hexdigest()
    
    def create_sample_heart_rate_bundle(self, 
                                       patient_id: str,
                                       consent_id: str,
                                       days: int = 7) -> Tuple[str, str]:
        """샘플 심박수 데이터 Bundle 생성"""
        
        bundle_id = f"bundle_{str(uuid.uuid4())}"
        
        # 환자 리소스
        patient = self.create_patient_resource(
            patient_id=patient_id,
            name="김환자",
            birth_date="1980-05-15",
            gender="male",
            phone="010-1234-5678"
        )
        
        # 웨어러블 디바이스
        device = self.create_device_resource(
            device_id="device_apple_watch_001",
            device_name="Apple Watch Series 8",
            manufacturer="Apple Inc.",
            model="A2773",
            version="watchOS 9.0"
        )
        
        # 심박수 관찰 데이터들 (7일간)
        observations = []
        base_time = datetime.utcnow() - timedelta(days=days)
        
        for day in range(days):
            for hour in range(0, 24, 2):  # 2시간마다
                obs_time = base_time + timedelta(days=day, hours=hour)
                heart_rate = 65 + (day * 2) + (hour % 10)  # 샘플 심박수
                
                observation = self.create_observation_resource(
                    observation_id=f"obs_hr_{day}_{hour}",
                    patient_id=patient_id,
                    code="8867-4",
                    display="Heart rate",
                    value=heart_rate,
                    unit="beats/min",
                    effective_datetime=obs_time,
                    device_id="device_apple_watch_001"
                )
                observations.append(observation)
        
        # 심방세동 조건 (있다면)
        condition = self.create_condition_resource(
            condition_id="condition_afib_001",
            patient_id=patient_id,
            condition_code="49436004",
            condition_display="Atrial fibrillation",
            clinical_status="active",
            onset_datetime=datetime.utcnow() - timedelta(days=30)
        )
        
        # 모든 리소스 결합
        all_resources = [patient, device, condition] + observations
        
        # Bundle 생성
        bundle = self.create_bundle(
            bundle_id=bundle_id,
            bundle_type="collection",
            resources=all_resources,
            patient_id=patient_id,
            consent_id=consent_id
        )
        
        # Bundle 해시 계산
        bundle_hash = self.calculate_bundle_hash(bundle_id)
        
        return bundle_id, bundle_hash
    
    def export_bundle_json(self, bundle_id: str) -> str:
        """Bundle을 JSON으로 내보내기"""
        if bundle_id not in self.bundles:
            raise ValueError(f"Bundle {bundle_id} not found")
        
        bundle = self.bundles[bundle_id]
        bundle_dict = self.bundle_to_dict(bundle)
        
        return json.dumps(bundle_dict, indent=2, ensure_ascii=False)
    
    def validate_bundle_structure(self, bundle_id: str) -> Dict[str, Any]:
        """Bundle 구조 유효성 검사"""
        if bundle_id not in self.bundles:
            return {"valid": False, "errors": ["Bundle not found"]}
        
        bundle = self.bundles[bundle_id]
        errors = []
        warnings = []
        
        # 필수 필드 확인
        if not bundle.id:
            errors.append("Bundle ID is required")
        
        if not bundle.type:
            errors.append("Bundle type is required")
        
        if not bundle.entry:
            warnings.append("Bundle has no entries")
        
        # 엔트리 검증
        for i, entry in enumerate(bundle.entry):
            if "resource" not in entry:
                errors.append(f"Entry {i} missing resource")
            elif "resourceType" not in entry["resource"]:
                errors.append(f"Entry {i} resource missing resourceType")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "entryCount": len(bundle.entry) if bundle.entry else 0
        }


# 사용 예제
if __name__ == "__main__":
    # FHIR 데이터 관리자 초기화
    fhir_manager = FHIRDataManager("sportique-platform")
    
    # 샘플 심박수 Bundle 생성
    patient_id = "patient_kim_001"
    consent_id = "urn:uuid:consent-123"
    
    bundle_id, bundle_hash = fhir_manager.create_sample_heart_rate_bundle(
        patient_id=patient_id,
        consent_id=consent_id,
        days=7
    )
    
    print(f"=== 생성된 FHIR Bundle ===")
    print(f"Bundle ID: {bundle_id}")
    print(f"Bundle Hash: {bundle_hash}")
    
    # Bundle 구조 검증
    validation = fhir_manager.validate_bundle_structure(bundle_id)
    print(f"\n=== Bundle 유효성 검사 ===")
    print(json.dumps(validation, indent=2, ensure_ascii=False))
    
    # Bundle JSON 내보내기 (일부만 출력)
    bundle_json = fhir_manager.export_bundle_json(bundle_id)
    bundle_dict = json.loads(bundle_json)
    
    print(f"\n=== FHIR Bundle 구조 (요약) ===")
    summary = {
        "resourceType": bundle_dict["resourceType"],
        "id": bundle_dict["id"],
        "type": bundle_dict["type"],
        "total": bundle_dict["total"],
        "timestamp": bundle_dict["timestamp"],
        "entryTypes": [entry["resource"]["resourceType"] for entry in bundle_dict["entry"]]
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    
    # 전체 Bundle을 파일로 저장
    with open(f"/home/ubuntu/{bundle_id}.json", "w", encoding="utf-8") as f:
        f.write(bundle_json)
    
    print(f"\n전체 Bundle이 {bundle_id}.json 파일로 저장되었습니다.")
