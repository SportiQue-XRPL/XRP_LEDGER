from flask import Blueprint, request, jsonify
from src.models.health_data import db, HealthData, DataTransaction, AccessPermission
from src.services.xrpl_service import XRPLService
from datetime import datetime, timedelta
import hashlib
import json

health_data_bp = Blueprint('health_data', __name__)
xrpl_service = XRPLService(testnet=True)  # 테스트넷 사용

@health_data_bp.route('/health-data', methods=['POST'])
def create_health_data():
    """건강데이터 생성 및 NFT 민팅"""
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['owner_address', 'data_type', 'title', 'wallet_seed']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # XRPL 주소 유효성 검증
        if not xrpl_service.validate_address(data['owner_address']):
            return jsonify({'error': 'Invalid XRPL address'}), 400
        
        # 지갑 복원
        try:
            wallet = xrpl_service.get_wallet_from_seed(data['wallet_seed'])
            if wallet.address != data['owner_address']:
                return jsonify({'error': 'Wallet seed does not match owner address'}), 400
        except Exception as e:
            return jsonify({'error': 'Invalid wallet seed'}), 400
        
        # 파일 해시 생성 (실제로는 업로드된 파일의 해시를 사용)
        file_content = data.get('file_content', '')
        file_hash = hashlib.sha256(file_content.encode()).hexdigest()
        
        # 건강데이터 객체 생성
        health_data = HealthData(
            owner_address=data['owner_address'],
            data_type=data['data_type'],
            title=data['title'],
            description=data.get('description', ''),
            file_hash=file_hash,
            quality_score=data.get('quality_score', 0.0),
            price=data.get('price', 0.0),
            is_for_sale=data.get('is_for_sale', False),
            is_for_rent=data.get('is_for_rent', False)
        )
        
        # NFT 민팅
        nft_info = {
            'title': health_data.title,
            'description': health_data.description,
            'data_type': health_data.data_type,
            'file_hash': file_hash,
            'quality_score': health_data.quality_score,
            'created_at': datetime.utcnow().isoformat()
        }
        
        nft_token_id = xrpl_service.mint_health_data_nft(wallet, nft_info)
        
        if not nft_token_id:
            return jsonify({'error': 'Failed to mint NFT'}), 500
        
        health_data.nft_token_id = nft_token_id
        
        # 데이터베이스에 저장
        db.session.add(health_data)
        db.session.commit()
        
        return jsonify({
            'message': 'Health data created successfully',
            'health_data': health_data.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/health-data', methods=['GET'])
def get_health_data_list():
    """건강데이터 목록 조회"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        data_type = request.args.get('data_type')
        owner_address = request.args.get('owner_address')
        for_sale = request.args.get('for_sale', type=bool)
        for_rent = request.args.get('for_rent', type=bool)
        
        query = HealthData.query
        
        # 필터 적용
        if data_type:
            query = query.filter(HealthData.data_type == data_type)
        if owner_address:
            query = query.filter(HealthData.owner_address == owner_address)
        if for_sale is not None:
            query = query.filter(HealthData.is_for_sale == for_sale)
        if for_rent is not None:
            query = query.filter(HealthData.is_for_rent == for_rent)
        
        # 페이지네이션
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        health_data_list = [item.to_dict() for item in pagination.items]
        
        return jsonify({
            'health_data': health_data_list,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/health-data/<int:data_id>', methods=['GET'])
def get_health_data_detail(data_id):
    """건강데이터 상세 조회"""
    try:
        health_data = HealthData.query.get_or_404(data_id)
        return jsonify({'health_data': health_data.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/health-data/<int:data_id>/purchase', methods=['POST'])
def purchase_health_data():
    """건강데이터 구매"""
    try:
        data = request.get_json()
        data_id = request.view_args['data_id']
        
        # 필수 필드 검증
        required_fields = ['buyer_address', 'buyer_wallet_seed']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # 건강데이터 조회
        health_data = HealthData.query.get_or_404(data_id)
        
        if not health_data.is_for_sale:
            return jsonify({'error': 'This health data is not for sale'}), 400
        
        # 구매자 지갑 복원
        try:
            buyer_wallet = xrpl_service.get_wallet_from_seed(data['buyer_wallet_seed'])
            if buyer_wallet.address != data['buyer_address']:
                return jsonify({'error': 'Wallet seed does not match buyer address'}), 400
        except Exception as e:
            return jsonify({'error': 'Invalid buyer wallet seed'}), 400
        
        # 잔액 확인
        buyer_balance = xrpl_service.get_account_balance(buyer_wallet.address)
        if buyer_balance < health_data.price:
            return jsonify({'error': 'Insufficient balance'}), 400
        
        # 결제 전송
        tx_hash = xrpl_service.send_payment(
            buyer_wallet, 
            health_data.owner_address, 
            health_data.price
        )
        
        if not tx_hash:
            return jsonify({'error': 'Payment failed'}), 500
        
        # 거래 기록 생성
        transaction = DataTransaction(
            health_data_id=health_data.id,
            transaction_type='sale',
            buyer_address=buyer_wallet.address,
            seller_address=health_data.owner_address,
            amount=health_data.price,
            xrpl_tx_hash=tx_hash,
            status='completed'
        )
        
        # 소유권 이전
        health_data.owner_address = buyer_wallet.address
        health_data.is_for_sale = False
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            'message': 'Purchase completed successfully',
            'transaction': transaction.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/health-data/<int:data_id>/rent', methods=['POST'])
def rent_health_data():
    """건강데이터 대여"""
    try:
        data = request.get_json()
        data_id = request.view_args['data_id']
        
        # 필수 필드 검증
        required_fields = ['renter_address', 'renter_wallet_seed', 'rent_days', 'rent_amount']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # 건강데이터 조회
        health_data = HealthData.query.get_or_404(data_id)
        
        if not health_data.is_for_rent:
            return jsonify({'error': 'This health data is not for rent'}), 400
        
        # 대여자 지갑 복원
        try:
            renter_wallet = xrpl_service.get_wallet_from_seed(data['renter_wallet_seed'])
            if renter_wallet.address != data['renter_address']:
                return jsonify({'error': 'Wallet seed does not match renter address'}), 400
        except Exception as e:
            return jsonify({'error': 'Invalid renter wallet seed'}), 400
        
        # 잔액 확인
        renter_balance = xrpl_service.get_account_balance(renter_wallet.address)
        rent_amount = float(data['rent_amount'])
        if renter_balance < rent_amount:
            return jsonify({'error': 'Insufficient balance'}), 400
        
        # 대여료 결제
        tx_hash = xrpl_service.send_payment(
            renter_wallet, 
            health_data.owner_address, 
            rent_amount
        )
        
        if not tx_hash:
            return jsonify({'error': 'Payment failed'}), 500
        
        # 대여 기간 계산
        rent_start = datetime.utcnow()
        rent_end = rent_start + timedelta(days=int(data['rent_days']))
        
        # 거래 기록 생성
        transaction = DataTransaction(
            health_data_id=health_data.id,
            transaction_type='rent',
            buyer_address=renter_wallet.address,
            seller_address=health_data.owner_address,
            amount=rent_amount,
            xrpl_tx_hash=tx_hash,
            status='completed',
            rent_start_date=rent_start,
            rent_end_date=rent_end
        )
        
        # 접근 권한 생성
        permission = AccessPermission(
            health_data_id=health_data.id,
            granted_to_address=renter_wallet.address,
            permission_type='read',
            granted_by_address=health_data.owner_address,
            expires_at=rent_end
        )
        
        db.session.add(transaction)
        db.session.add(permission)
        db.session.commit()
        
        return jsonify({
            'message': 'Rental completed successfully',
            'transaction': transaction.to_dict(),
            'permission': permission.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/wallet/create', methods=['POST'])
def create_wallet():
    """새 XRPL 지갑 생성"""
    try:
        wallet_info = xrpl_service.create_wallet()
        return jsonify({
            'message': 'Wallet created successfully',
            'wallet': wallet_info
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/wallet/<address>/balance', methods=['GET'])
def get_wallet_balance(address):
    """지갑 잔액 조회"""
    try:
        if not xrpl_service.validate_address(address):
            return jsonify({'error': 'Invalid XRPL address'}), 400
        
        balance = xrpl_service.get_account_balance(address)
        return jsonify({
            'address': address,
            'balance': balance
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/wallet/<address>/nfts', methods=['GET'])
def get_wallet_nfts(address):
    """지갑의 NFT 목록 조회"""
    try:
        if not xrpl_service.validate_address(address):
            return jsonify({'error': 'Invalid XRPL address'}), 400
        
        nfts = xrpl_service.get_account_nfts(address)
        return jsonify({
            'address': address,
            'nfts': nfts
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@health_data_bp.route('/transactions', methods=['GET'])
def get_transactions():
    """거래 내역 조회"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        address = request.args.get('address')
        transaction_type = request.args.get('type')
        
        query = DataTransaction.query
        
        # 필터 적용
        if address:
            query = query.filter(
                (DataTransaction.buyer_address == address) | 
                (DataTransaction.seller_address == address)
            )
        if transaction_type:
            query = query.filter(DataTransaction.transaction_type == transaction_type)
        
        # 최신 순으로 정렬
        query = query.order_by(DataTransaction.created_at.desc())
        
        # 페이지네이션
        pagination = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        transactions = [item.to_dict() for item in pagination.items]
        
        return jsonify({
            'transactions': transactions,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

