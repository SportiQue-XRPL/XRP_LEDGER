from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class HealthData(db.Model):
    __tablename__ = 'health_data'
    
    id = db.Column(db.Integer, primary_key=True)
    owner_address = db.Column(db.String(100), nullable=False)  # XRPL 지갑 주소
    data_type = db.Column(db.String(50), nullable=False)  # 혈액검사, 의료영상, 처방전 등
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    file_hash = db.Column(db.String(100))  # IPFS 해시
    nft_token_id = db.Column(db.String(100))  # XRPL NFT 토큰 ID
    quality_score = db.Column(db.Float, default=0.0)  # 데이터 품질 점수
    price = db.Column(db.Float, default=0.0)  # XRP 단위 가격
    is_for_sale = db.Column(db.Boolean, default=False)
    is_for_rent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'owner_address': self.owner_address,
            'data_type': self.data_type,
            'title': self.title,
            'description': self.description,
            'file_hash': self.file_hash,
            'nft_token_id': self.nft_token_id,
            'quality_score': self.quality_score,
            'price': self.price,
            'is_for_sale': self.is_for_sale,
            'is_for_rent': self.is_for_rent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DataTransaction(db.Model):
    __tablename__ = 'data_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    health_data_id = db.Column(db.Integer, db.ForeignKey('health_data.id'), nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False)  # sale, rent
    buyer_address = db.Column(db.String(100), nullable=False)
    seller_address = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)  # XRP 단위
    xrpl_tx_hash = db.Column(db.String(100))  # XRPL 트랜잭션 해시
    status = db.Column(db.String(20), default='pending')  # pending, completed, failed
    rent_start_date = db.Column(db.DateTime)  # 대여 시작일 (대여의 경우)
    rent_end_date = db.Column(db.DateTime)    # 대여 종료일 (대여의 경우)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    health_data = db.relationship('HealthData', backref=db.backref('transactions', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'health_data_id': self.health_data_id,
            'transaction_type': self.transaction_type,
            'buyer_address': self.buyer_address,
            'seller_address': self.seller_address,
            'amount': self.amount,
            'xrpl_tx_hash': self.xrpl_tx_hash,
            'status': self.status,
            'rent_start_date': self.rent_start_date.isoformat() if self.rent_start_date else None,
            'rent_end_date': self.rent_end_date.isoformat() if self.rent_end_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class AccessPermission(db.Model):
    __tablename__ = 'access_permissions'
    
    id = db.Column(db.Integer, primary_key=True)
    health_data_id = db.Column(db.Integer, db.ForeignKey('health_data.id'), nullable=False)
    granted_to_address = db.Column(db.String(100), nullable=False)
    permission_type = db.Column(db.String(20), nullable=False)  # read, analyze, download
    granted_by_address = db.Column(db.String(100), nullable=False)
    expires_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    health_data = db.relationship('HealthData', backref=db.backref('permissions', lazy=True))
    
    def to_dict(self):
        return {
            'id': self.id,
            'health_data_id': self.health_data_id,
            'granted_to_address': self.granted_to_address,
            'permission_type': self.permission_type,
            'granted_by_address': self.granted_by_address,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

