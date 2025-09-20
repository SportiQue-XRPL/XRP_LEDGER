import xrpl
from xrpl.clients import JsonRpcClient
from xrpl.wallet import Wallet, generate_faucet_wallet
from xrpl.models.transactions import NFTokenMint, Payment, NFTokenCreateOffer, NFTokenAcceptOffer
from xrpl.models.requests import AccountNFTs, AccountInfo
from xrpl.utils import drops_to_xrp, xrp_to_drops


import json
from typing import Optional, Dict, Any
import tkinter as tk

"""
Add modules in origin XRPL project
"""
class XRPLService:
    def __init__(self, testnet: bool = True):
        """
        XRPL 서비스 초기화
        
        Args:
            testnet: True면 테스트넷, False면 메인넷 사용
        """
        self.testnet_url = "https://s.devnet.rippletest.net:51234/"
        if testnet:
            # mod1이 사용하는 네트워크(testnet/devnet)와 동일한 URL 사용
            self.client = JsonRpcClient(self.testnet_url)
            self.network_id = 21338  # Testnet network ID
        else:
            self.client = JsonRpcClient("https://xrplcluster.com/")
            self.network_id = 0  # Mainnet network ID
        self._ui = None
    
    def __net_url__(self):
        return self.testnet_url
    
    
    @staticmethod
    def get_account(self, seed):
        """get_account"""
        client = xrpl.clients.JsonRpcClient(self.testnet_url)
        if (seed == ''):
            new_wallet = xrpl.wallet.generate_faucet_wallet(client)
        else:
            new_wallet = xrpl.wallet.Wallet.from_seed(seed)
        return new_wallet

    @staticmethod
    def get_account_info(self, accountId):
        """get_account_info"""
        client = xrpl.clients.JsonRpcClient(self.testnet_url)
        acct_info = xrpl.models.requests.account_info.AccountInfo(
            account=accountId,
            ledger_index="validated"
        )
        response = client.request(acct_info)
        return response.result['account_data']

    @staticmethod
    def send_xrp(self, seed, amount, destination):
        sending_wallet = xrpl.wallet.Wallet.from_seed(seed)
        client = xrpl.clients.JsonRpcClient(self.testnet_url)
        payment = xrpl.models.transactions.Payment(
            account=sending_wallet.address,
            amount=xrpl.utils.xrp_to_drops(int(amount)),
            destination=destination,
        )
        try:	
            response = xrpl.transaction.submit_and_wait(payment, client, sending_wallet)	
        except xrpl.transaction.XRPLReliableSubmissionException as e:	
            response = f"Submit failed: {e}"

        return response
    
    def create_trust_line(self, seed, issuer, currency, amount):
        """create_trust_line"""
    # Get the client
        receiving_wallet = Wallet.from_seed(seed)
        client = JsonRpcClient(self.testnet_url)
    # Define the trust line transaction
        trustline_tx=xrpl.models.transactions.TrustSet(
            account=receiving_wallet.address,
            limit_amount=xrpl.models.amounts.IssuedCurrencyAmount(
                currency=currency,
                issuer=issuer,
                value=int(amount)
            )
        )

        response =  xrpl.transaction.submit_and_wait(trustline_tx,
            client, receiving_wallet)
        return response.result

    #################
    # send_currency #
    #################

    def send_currency(self, seed, destination, currency, amount):
        """send_currency"""
    # Get the client
        sending_wallet=Wallet.from_seed(seed)
        client=JsonRpcClient(self.testnet_url)
    # Define the payment transaction.
        send_currency_tx=xrpl.models.transactions.Payment(
            account=sending_wallet.address,
            amount=xrpl.models.amounts.IssuedCurrencyAmount(
                currency=currency,
                value=int(amount),
                issuer=sending_wallet.address
            ),
            destination=destination
        )
        response=xrpl.transaction.submit_and_wait(send_currency_tx, client, sending_wallet)
        return response.result

    ###############
    # get_balance #
    ###############

    def get_balance(self, sb_account_seed, op_account_seed):
        """get_balance"""
        wallet = Wallet.from_seed(sb_account_seed)
        opWallet = Wallet.from_seed(op_account_seed)
        client=JsonRpcClient(self.testnet_url)
        balance=xrpl.models.requests.GatewayBalances(
            account=wallet.address,
            ledger_index="validated"
        )
        response = client.request(balance)
        return response.result
        
    #####################
    # configure_account #
    #####################

    def configure_account(self, seed, default_setting):
        """configure_account"""
    # Get the client
        wallet=Wallet.from_seed(seed)
        client=JsonRpcClient(self.testnet_url)
    # Create transaction
        if (default_setting):
            setting_tx=xrpl.models.transactions.AccountSet(
                account=wallet.classic_address,
                set_flag=xrpl.models.transactions.AccountSetAsfFlag.ASF_DEFAULT_RIPPLE
            )
        else:
            setting_tx=xrpl.models.transactions.AccountSet(
                account=wallet.classic_address,
                clear_flag=xrpl.models.transactions.AccountSetAsfFlag.ASF_DEFAULT_RIPPLE
            )
        response=xrpl.transaction.submit_and_wait(setting_tx,client,wallet)
        return response.result    

        
    

