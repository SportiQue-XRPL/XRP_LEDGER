import xrpl
import json

#fastapi
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal, Dict, Any

#XRP Packages
from xrpl_service import XRPLService
from xrpl.clients import JsonRpcClient
from xrpl.wallet import generate_faucet_wallet, Wallet
from xrpl.models.transactions import Payment
from xrpl.utils import xrp_to_drops
from xrpl.transaction import submit_and_wait
from xrpl.models.requests.account_info import AccountInfo
from xrpl.core import addresscodec
from xrpl.models.transactions import EscrowCreate, EscrowFinish, EscrowCancel, AccountSet, TrustSet
from xrpl.models.requests import AccountObjects, AccountTx, GatewayBalances, AccountNFTs, NFTBuyOffers, NFTSellOffers, Tx
from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.models.transactions import EscrowCreate, EscrowFinish
from xrpl.models.requests import AccountObjects, AccountTx
from xrpl.models.requests import AccountNFTs
from xrpl.models.requests import NFTSellOffers
from xrpl.models.requests import NFTBuyOffers
from xrpl.models.transactions import NFTokenAcceptOffer
#############################################
## Handlers #################################
#############################################

# sb seed: snk7pMfHPZoUpwMQuFApo3XTLRJhn
# op seed: spmiHeaCDMFX56SNZVsCbi34WEE52

app = FastAPI(title="XRPL Health Data API")

JSON_RPC_URL = "https://s.devnet.rippletest.net:51234/"
"""
https://s.altnet.rippletest.net:51234/ can be to connect to XRP Ledger
http://localhost:5005/ is your own server; prviate
https://s2.ripple.com:51234/ is the same above; public
"""
client = JsonRpcClient(JSON_RPC_URL)
xrpl_service = XRPLService(testnet=True)  # testnet

class HealthData(BaseModel):
    owner_address: str
    data_type: str
    title: str
    wallet_seed: str

class WalletSeedRequest(BaseModel):
    seed: str = ""

class LedgerQueryRequest(BaseModel):
    account: str

class PaymentRequest(BaseModel):
    seed: str
    amount_xrp: float
    destination: str

class TrustLineRequest(BaseModel):
    seed: str
    issuer: str
    currency: str
    amount: str

class SendCurrencyRequest(BaseModel):
    seed: str
    destination: str
    currency: str
    amount: float

class BalanceRequest(BaseModel):
    sb_account_seed: str
    op_account_seed: str

class ConfigureAccountRequest(BaseModel):
    seed: str
    default_setting: bool

class EscrowCreateRequest(BaseModel):
    seed: str
    amount_drops: int
    destination: str
    finish_after_seconds: int
    cancel_after_seconds: int

class EscrowFinishRequest(BaseModel):
    seed: str
    owner: str
    offer_sequence: int

class EscrowCancelRequest(BaseModel):
    seed: str
    owner: str
    offer_sequence: int

class EscrowsQueryRequest(BaseModel):
    account: str

class TransactionQueryRequest(BaseModel):
    account: str
    ledger_index: int

class SendCheckRequest(BaseModel):
    seed: str
    amount: str
    destination: str
    currency: str = "XRP"
    issuer: str = ""

class CashCheckRequest(BaseModel):
    seed: str
    amount: str
    check_id: str
    currency: str = "XRP"
    issuer: str = ""

class CancelCheckRequest(BaseModel):
    seed: str
    check_id: str

class ChecksQueryRequest(BaseModel):
    account: str

class MintTokenRequest(BaseModel):
    seed: str
    uri: str
    flags: int
    transfer_fee: int
    taxon: int

class GetTokensRequest(BaseModel):
    account: str

class BurnTokenRequest(BaseModel):
    seed: str
    nftoken_id: str

class CreateSellOfferRequest(BaseModel):
    seed: str
    amount: str
    nftoken_id: str
    expiration: str = ""
    destination: str = ""

class AcceptSellOfferRequest(BaseModel):
    seed: str
    offer_index: str

class CreateBuyOfferRequest(BaseModel):
    seed: str
    amount: str
    nft_id: str
    owner: str
    expiration: str = ""
    destination: str = ""

class AcceptBuyOfferRequest(BaseModel):
    seed: str
    offer_index: str

class GetOffersRequest(BaseModel):
    nft_id: str

class CancelOfferRequest(BaseModel):
    seed: str
    nftoken_offer_ids: str

class FinalizeTransferRequest(BaseModel):
    health_data_id: int
    buyer_address: str
    xrpl_tx_hash: str
    mode: Literal["payment", "nft"]
    expected_amount_xrp: Optional[float] = None
    expected_nft_token_id: Optional[str] = None

class SetMinterRequest(BaseModel):
    seed: str
    minter: str

class MintOtherRequest(BaseModel):
    seed: str
    uri: str
    flags: int
    transfer_fee: int
    taxon: int
    issuer: str

@app.post("/create/wallet")
def create_wallet():
    test_wallet = generate_faucet_wallet(client, debug=True)
    return {"classic_address": test_wallet.address, "seed": test_wallet.seed}

@app.post("/wallet/from-seed")
def wallet_from_seed(req: WalletSeedRequest):
    wallet = XRPLService.get_account(req.seed)
    return {"classic_address": wallet.address, "seed": wallet.seed}

@app.post("/transaction/payment")
def submit_payment(req: PaymentRequest):
    try:
        response = XRPLService.send_xrp(req.seed, req.amount_xrp, req.destination)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/minter/set")
def set_minter(req: SetMinterRequest):
    try:
        granter_wallet = Wallet.from_seed(req.seed)
        set_minter_tx = xrpl.models.transactions.AccountSet(
            account=granter_wallet.address,
            nftoken_minter=req.minter,
            set_flag=AccountSet.AccountSetAsfFlag.ASF_AUTHORIZED_NFTOKEN_MINTER,
        )
        response = xrpl.transaction.submit_and_wait(set_minter_tx, client, granter_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/mint/other")
def mint_other(req: MintOtherRequest):
    try:
        minter_wallet = Wallet.from_seed(req.seed)
        mint_other_tx = xrpl.models.transactions.NFTokenMint(
            account=minter_wallet.address,
            uri=xrpl.utils.str_to_hex(req.uri),
            flags=int(req.flags),
            transfer_fee=int(req.transfer_fee),
            nftoken_taxon=int(req.taxon),
            issuer=req.issuer,
        )
        response = xrpl.transaction.submit_and_wait(mint_other_tx, client, minter_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if hasattr(response, "result"):
        return response.result
    raise HTTPException(status_code=400, detail=str(response))

@app.post("/query/ledger")
def Ledger_query(req: LedgerQueryRequest):
    acct_info = AccountInfo(
        account=req.account,
        ledger_index="validated",
        strict=True,
    )
    response = client.request(acct_info)
    return response.result

@app.post("/account/info")
def account_info(req: LedgerQueryRequest):
    try:
        info = XRPLService.get_account_info(req.account)
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def _ripple_time_after(seconds: int) -> int:
    base = datetime.now()
    ripple_time = xrpl.utils.datetime_to_ripple_time(base)
    return ripple_time + int(seconds)

@app.post("/trustline/create")
def create_trustline(req: TrustLineRequest):
    try:
        receiving_wallet = Wallet.from_seed(req.seed)
        trustline_tx = TrustSet(
            account=receiving_wallet.address,
            limit_amount=IssuedCurrencyAmount(
                currency=req.currency,
                issuer=req.issuer,
                value=str(int(req.amount))
            )
        )
        response = xrpl.transaction.submit_and_wait(trustline_tx, client, receiving_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/currency/send")
def send_currency(req: SendCurrencyRequest):
    try:
        sending_wallet = Wallet.from_seed(req.seed)
        send_currency_tx = Payment(
            account=sending_wallet.address,
            amount=IssuedCurrencyAmount(
                currency=req.currency,
                value=str(int(req.amount)),
                issuer=sending_wallet.address
            ),
            destination=req.destination
        )
        response = xrpl.transaction.submit_and_wait(send_currency_tx, client, sending_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/balance/get")
def get_balance(req: BalanceRequest):
    try:
        wallet = Wallet.from_seed(req.sb_account_seed)
        query = GatewayBalances(account=wallet.address, ledger_index="validated")
        response = client.request(query)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/account/configure")
def configure_account(req: ConfigureAccountRequest):
    try:
        wallet = Wallet.from_seed(req.seed)
        if req.default_setting:
            setting_tx = AccountSet(
                account=wallet.classic_address,
                set_flag=AccountSet.AccountSetAsfFlag.ASF_DEFAULT_RIPPLE
            )
        else:
            setting_tx = AccountSet(
                account=wallet.classic_address,
                clear_flag=AccountSet.AccountSetAsfFlag.ASF_DEFAULT_RIPPLE
            )
        response = xrpl.transaction.submit_and_wait(setting_tx, client, wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/escrow/create")
def create_time_escrow(req: EscrowCreateRequest):
    try:
        wallet = Wallet.from_seed(req.seed)
        escrow_tx = EscrowCreate(
            account=wallet.address,
            amount=str(int(req.amount_drops)),
            destination=req.destination,
            finish_after=_ripple_time_after(req.finish_after_seconds),
            cancel_after=_ripple_time_after(req.cancel_after_seconds)
        )
        response = xrpl.transaction.submit_and_wait(escrow_tx, client, wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/escrow/finish")
def finish_time_escrow(req: EscrowFinishRequest):
    try:
        wallet = Wallet.from_seed(req.seed)
        finish_tx = EscrowFinish(
            account=wallet.address,
            owner=req.owner,
            offer_sequence=int(req.offer_sequence)
        )
        response = xrpl.transaction.submit_and_wait(finish_tx, client, wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/escrow/cancel")
def cancel_time_escrow(req: EscrowCancelRequest):
    try:
        wallet = Wallet.from_seed(req.seed)
        cancel_tx = EscrowCancel(
            account=wallet.address,
            owner=req.owner,
            offer_sequence=int(req.offer_sequence)
        )
        response = xrpl.transaction.submit_and_wait(cancel_tx, client, wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/escrow/list")
def get_escrows(req: EscrowsQueryRequest):
    try:
        acct_escrows = AccountObjects(account=req.account, ledger_index="validated", type="escrow")
        response = client.request(acct_escrows)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/transaction/get")
def get_transaction(req: TransactionQueryRequest):
    try:
        tx_info = AccountTx(account=req.account, ledger_index=int(req.ledger_index))
        response = client.request(tx_info)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/checks/create")
def create_check(req: SendCheckRequest):
    try:
        wallet = Wallet.from_seed(req.seed)
        amount_value = req.amount
        if req.currency != "XRP":
            amount_value = {"value": req.amount, "currency": req.currency, "issuer": req.issuer}
        check_tx = xrpl.models.transactions.CheckCreate(
            account=wallet.address,
            send_max=amount_value,
            destination=req.destination
        )
        response = xrpl.transaction.submit_and_wait(check_tx, client, wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/checks/cash")
def cash_check(req: CashCheckRequest):
    try:
        wallet = Wallet.from_seed(req.seed)
        amount_value = req.amount
        if req.currency != "XRP":
            amount_value = {"value": req.amount, "currency": req.currency, "issuer": req.issuer}
        finish_tx = xrpl.models.transactions.CheckCash(
            account=wallet.address,
            amount=amount_value,
            check_id=req.check_id
        )
        response = xrpl.transaction.submit_and_wait(finish_tx, client, wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/checks/cancel")
def cancel_check(req: CancelCheckRequest):
    try:
        wallet = Wallet.from_seed(req.seed)
        cancel_tx = xrpl.models.transactions.CheckCancel(
            account=wallet.address,
            check_id=req.check_id
        )
        response = xrpl.transaction.submit_and_wait(cancel_tx, client, wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/checks/list")
def get_checks(req: ChecksQueryRequest):
    try:
        acct_checks = AccountObjects(account=req.account, ledger_index="validated", type="check")
        response = client.request(acct_checks)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/mint")
def mint_token(req: MintTokenRequest):
    try:
        minter_wallet = Wallet.from_seed(req.seed)
        mint_tx = xrpl.models.transactions.NFTokenMint(
            account=minter_wallet.address,
            uri=xrpl.utils.str_to_hex(req.uri),
            flags=int(req.flags),
            transfer_fee=int(req.transfer_fee),
            nftoken_taxon=int(req.taxon)
        )
        response = xrpl.transaction.submit_and_wait(mint_tx, client, minter_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/list")
def get_tokens(req: GetTokensRequest):
    try:
        acct_nfts = AccountNFTs(account=req.account)
        response = client.request(acct_nfts)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/burn")
def burn_token(req: BurnTokenRequest):
    try:
        owner_wallet = Wallet.from_seed(req.seed)
        burn_tx = xrpl.models.transactions.NFTokenBurn(
            account=owner_wallet.address,
            nftoken_id=req.nftoken_id
        )
        response = xrpl.transaction.submit_and_wait(burn_tx, client, owner_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/sell-offer/create")
def create_sell_offer(req: CreateSellOfferRequest):
    try:
        owner_wallet = Wallet.from_seed(req.seed)
        expiration_date = None
        if req.expiration != "":
            expiration_date = xrpl.utils.datetime_to_ripple_time(datetime.now()) + int(req.expiration)
        sell_offer_tx = xrpl.models.transactions.NFTokenCreateOffer(
            account=owner_wallet.address,
            nftoken_id=req.nftoken_id,
            amount=req.amount,
            destination=req.destination if req.destination != "" else None,
            expiration=expiration_date,
            flags=1
        )
        response = xrpl.transaction.submit_and_wait(sell_offer_tx, client, owner_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/sell-offer/accept")
def accept_sell_offer(req: AcceptSellOfferRequest):
    try:
        buyer_wallet = Wallet.from_seed(req.seed)
        accept_offer_tx = xrpl.models.transactions.NFTokenAcceptOffer(
            account=buyer_wallet.classic_address,
            nftoken_sell_offer=req.offer_index
        )
        response = xrpl.transaction.submit_and_wait(accept_offer_tx, client, buyer_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/buy-offer/create")
def create_buy_offer(req: CreateBuyOfferRequest):
    try:
        buyer_wallet = Wallet.from_seed(req.seed)
        expiration_date = None
        if req.expiration != "":
            expiration_date = xrpl.utils.datetime_to_ripple_time(datetime.now()) + int(req.expiration)
        buy_offer_tx = xrpl.models.transactions.NFTokenCreateOffer(
            account=buyer_wallet.address,
            nftoken_id=req.nft_id,
            amount=req.amount,
            owner=req.owner,
            expiration=expiration_date,
            destination=req.destination if req.destination != "" else None,
            flags=0
        )
        response = xrpl.transaction.submit_and_wait(buy_offer_tx, client, buyer_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/buy-offer/accept")
def accept_buy_offer(req: AcceptBuyOfferRequest):
    try:
        buyer_wallet = Wallet.from_seed(req.seed)
        accept_offer_tx = xrpl.models.transactions.NFTokenAcceptOffer(
            account=buyer_wallet.address,
            nftoken_buy_offer=req.offer_index
        )
        response = xrpl.transaction.submit_and_wait(accept_offer_tx, client, buyer_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/offers")
def get_offers(req: GetOffersRequest):
    try:
        buy_offers_req = NFTBuyOffers(nft_id=req.nft_id)
        buy_resp = client.request(buy_offers_req)
        sell_offers_req = NFTSellOffers(nft_id=req.nft_id)
        sell_resp = client.request(sell_offers_req)
        return {"buy_offers": buy_resp.result, "sell_offers": sell_resp.result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/nft/offer/cancel")
def cancel_offer(req: CancelOfferRequest):
    try:
        owner_wallet = Wallet.from_seed(req.seed)
        token_ids = [req.nftoken_offer_ids]
        cancel_offer_tx = xrpl.models.transactions.NFTokenCancelOffer(
            account=owner_wallet.classic_address,
            nftoken_offers=token_ids
        )
        response = xrpl.transaction.submit_and_wait(cancel_offer_tx, client, owner_wallet)
        return response.result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def verify_onchain_tx(
    client: JsonRpcClient,
    tx_hash: str,
    mode: Literal["payment", "nft"],
    expected_destination: Optional[str] = None,
    expected_amount_xrp: Optional[float] = None,
    expected_nft_token_id: Optional[str] = None,
) -> Dict[str, Any]:
    req = Tx(transaction=tx_hash, binary=False)
    tx_resp = client.request(req)
    result = tx_resp.result
    validated = bool(result.get("validated"))
    tx = result.get("tx", {}) if "tx" in result else result
    tx_type = tx.get("TransactionType")

    checks: Dict[str, Any] = {"validated": validated, "type": tx_type}

    if mode == "payment":
        checks["is_payment"] = (tx_type == "Payment")
        if expected_destination is not None:
            checks["destination_match"] = (tx.get("Destination") == expected_destination)
        if expected_amount_xrp is not None:
            try:
                expected_drops = xrp_to_drops(expected_amount_xrp)
            except Exception:
                expected_drops = None
            checks["amount_match"] = (tx.get("Amount") == expected_drops)
    elif mode == "nft":
        checks["is_nft_accept"] = (tx_type == "NFTokenAcceptOffer")
        # Best-effort: 토큰 ID는 메타의 AffectedNodes에서 확인이 필요할 수 있음
        if expected_nft_token_id is not None:
            meta = result.get("meta", {})
            affected = meta.get("AffectedNodes", []) if isinstance(meta, dict) else []
            found = False
            for node in affected:
                node_obj = list(node.values())[0]
                fields = node_obj.get("FinalFields") or node_obj.get("PreviousFields") or {}
                if isinstance(fields, dict) and fields.get("NFTokenID") == expected_nft_token_id:
                    found = True
                    break
            checks["nft_id_match"] = found

    return {
        "hash": tx_hash,
        "validated": validated,
        "transaction_type": tx_type,
        "checks": checks,
        "raw": result,
    }

@app.post("/offchain/finalize-transfer")
def finalize_transfer(req: FinalizeTransferRequest):
    verification = verify_onchain_tx(
        client=client,
        tx_hash=req.xrpl_tx_hash,
        mode=req.mode,
        expected_destination=req.buyer_address if req.mode == "payment" else None,
        expected_amount_xrp=req.expected_amount_xrp,
        expected_nft_token_id=req.expected_nft_token_id,
    )

    if not verification.get("validated"):
        raise HTTPException(status_code=400, detail="Transaction not validated on-ledger")

    checks = verification.get("checks", {})
    if req.mode == "payment":
        if not checks.get("is_payment"):
            raise HTTPException(status_code=400, detail="Not a Payment transaction")
        if req.expected_amount_xrp is not None and not checks.get("amount_match", False):
            raise HTTPException(status_code=400, detail="Payment amount mismatch")
        if req.buyer_address and not checks.get("destination_match", False):
            raise HTTPException(status_code=400, detail="Payment destination mismatch")
    else:
        if not checks.get("is_nft_accept"):
            raise HTTPException(status_code=400, detail="Not an NFTokenAcceptOffer transaction")
        if req.expected_nft_token_id is not None and not checks.get("nft_id_match", False):
            raise HTTPException(status_code=400, detail="NFT token id mismatch (best-effort)")

    # TODO: 오프체인 DB 업데이트 연동 (별도 서비스/라우트 호출 또는 직접 DB 연결)
    return {
        "verified": True,
        "health_data_id": req.health_data_id,
        "new_owner": req.buyer_address,
        "onchain": verification,
        "offchain": {"updated": False, "note": "Integrate DB update here."},
    }

def set_minter(self, seed, minter):
    """set_minter"""
    granter_wallet=Wallet.from_seed(seed)
    client=JsonRpcClient(self.testnet_url)

    set_minter_tx=xrpl.models.transactions.AccountSet(
        account=granter_wallet.address,
        nftoken_minter=minter,
        set_flag=xrpl.models.transactions.AccountSetAsfFlag.ASF_AUTHORIZED_NFTOKEN_MINTER
    )     
# Submit the transaction and report the results
    reply=""
    try:
        response=xrpl.transaction.submit_and_wait(set_minter_tx,client,
            granter_wallet)
        reply=response.result
    except xrpl.transaction.XRPLReliableSubmissionException as e:
        reply=f"Submit failed: {e}"
    return reply

def mint_other(self, seed, uri, flags, transfer_fee, taxon, issuer):
    """mint_other"""
    minter_wallet=Wallet.from_seed(seed)
    client=JsonRpcClient(self.testnet_url)
    mint_other_tx=xrpl.models.transactions.NFTokenMint(
        account=minter_wallet.address,
        uri=xrpl.utils.str_to_hex(uri),
        flags=int(flags),
        transfer_fee=int(transfer_fee),
        nftoken_taxon=int(taxon),
        issuer=issuer
    )
# Submit the transaction and report the results
    reply=""
    try:
        response=xrpl.transaction.submit_and_wait(mint_other_tx,client,
            minter_wallet)
        reply=response.result
    except xrpl.transaction.XRPLReliableSubmissionException as e:
        reply=f"Submit failed: {e}"
    return reply

