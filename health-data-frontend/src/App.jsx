import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { Wallet, Database, ShoppingCart, Clock, Plus, Eye, DollarSign } from 'lucide-react'
import './App.css'

const API_BASE_URL = 'http://localhost:5000/api'

function App() {
  const [healthData, setHealthData] = useState([])
  const [transactions, setTransactions] = useState([])
  const [currentWallet, setCurrentWallet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 건강데이터 목록 조회
  const fetchHealthData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health-data`)
      const data = await response.json()
      if (response.ok) {
        setHealthData(data.health_data)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to fetch health data')
    }
  }

  // 거래 내역 조회
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions`)
      const data = await response.json()
      if (response.ok) {
        setTransactions(data.transactions)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to fetch transactions')
    }
  }

  useEffect(() => {
    fetchHealthData()
    fetchTransactions()
  }, [])

  // 새 지갑 생성
  const createWallet = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/wallet/create`, {
        method: 'POST'
      })
      const data = await response.json()
      if (response.ok) {
        setCurrentWallet(data.wallet)
        setSuccess('Wallet created successfully!')
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to create wallet')
    }
    setLoading(false)
  }

  // 지갑 잔액 조회
  const getWalletBalance = async (address) => {
    try {
      const response = await fetch(`${API_BASE_URL}/wallet/${address}/balance`)
      const data = await response.json()
      if (response.ok) {
        return data.balance
      }
      return 0
    } catch (err) {
      return 0
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            XRPL 건강데이터 관리 시스템
          </h1>
          <p className="text-gray-600">
            블록체인 기반 건강데이터 소유권, 대여, 판매 플랫폼
          </p>
        </div>

        {/* 알림 */}
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* 지갑 정보 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              XRPL 지갑
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentWallet ? (
              <div className="space-y-2">
                <div>
                  <Label>주소</Label>
                  <Input value={currentWallet.address} readOnly />
                </div>
                <div>
                  <Label>시드 (안전하게 보관하세요)</Label>
                  <Input type="password" value={currentWallet.seed} readOnly />
                </div>
                <WalletBalance address={currentWallet.address} />
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">지갑이 없습니다. 새 지갑을 생성하세요.</p>
                <Button onClick={createWallet} disabled={loading}>
                  {loading ? '생성 중...' : '새 지갑 생성'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 메인 탭 */}
        <Tabs defaultValue="marketplace" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="marketplace">마켓플레이스</TabsTrigger>
            <TabsTrigger value="my-data">내 데이터</TabsTrigger>
            <TabsTrigger value="create">데이터 등록</TabsTrigger>
            <TabsTrigger value="transactions">거래 내역</TabsTrigger>
          </TabsList>

          {/* 마켓플레이스 */}
          <TabsContent value="marketplace">
            <HealthDataMarketplace 
              healthData={healthData} 
              currentWallet={currentWallet}
              onSuccess={(msg) => setSuccess(msg)}
              onError={(msg) => setError(msg)}
              onRefresh={fetchHealthData}
            />
          </TabsContent>

          {/* 내 데이터 */}
          <TabsContent value="my-data">
            <MyHealthData 
              healthData={healthData.filter(item => 
                currentWallet && item.owner_address === currentWallet.address
              )}
              currentWallet={currentWallet}
              onSuccess={(msg) => setSuccess(msg)}
              onError={(msg) => setError(msg)}
              onRefresh={fetchHealthData}
            />
          </TabsContent>

          {/* 데이터 등록 */}
          <TabsContent value="create">
            <CreateHealthData 
              currentWallet={currentWallet}
              onSuccess={(msg) => {
                setSuccess(msg)
                fetchHealthData()
              }}
              onError={(msg) => setError(msg)}
            />
          </TabsContent>

          {/* 거래 내역 */}
          <TabsContent value="transactions">
            <TransactionHistory 
              transactions={transactions.filter(tx => 
                currentWallet && (
                  tx.buyer_address === currentWallet.address || 
                  tx.seller_address === currentWallet.address
                )
              )}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// 지갑 잔액 컴포넌트
function WalletBalance({ address }) {
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/wallet/${address}/balance`)
        const data = await response.json()
        if (response.ok) {
          setBalance(data.balance)
        }
      } catch (err) {
        console.error('Failed to fetch balance:', err)
      }
      setLoading(false)
    }

    if (address) {
      fetchBalance()
    }
  }, [address])

  return (
    <div>
      <Label>잔액</Label>
      <div className="text-2xl font-bold text-green-600">
        {loading ? '로딩 중...' : `${balance.toFixed(6)} XRP`}
      </div>
    </div>
  )
}

// 마켓플레이스 컴포넌트
function HealthDataMarketplace({ healthData, currentWallet, onSuccess, onError, onRefresh }) {
  const marketplaceData = healthData.filter(item => item.is_for_sale || item.is_for_rent)

  const handlePurchase = async (dataId, price) => {
    if (!currentWallet) {
      onError('지갑이 필요합니다')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/health-data/${dataId}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          buyer_address: currentWallet.address,
          buyer_wallet_seed: currentWallet.seed
        })
      })

      const data = await response.json()
      if (response.ok) {
        onSuccess('구매가 완료되었습니다!')
        onRefresh()
      } else {
        onError(data.error)
      }
    } catch (err) {
      onError('구매 중 오류가 발생했습니다')
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {marketplaceData.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{item.title}</span>
              <Badge variant={item.data_type === '혈액검사' ? 'default' : 'secondary'}>
                {item.data_type}
              </Badge>
            </CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>품질 점수:</span>
                <span className="font-semibold">{item.quality_score}/10</span>
              </div>
              <div className="flex justify-between">
                <span>가격:</span>
                <span className="font-semibold text-green-600">{item.price} XRP</span>
              </div>
              <div className="flex gap-2 mt-4">
                {item.is_for_sale && (
                  <Button 
                    onClick={() => handlePurchase(item.id, item.price)}
                    className="flex-1"
                    size="sm"
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    구매
                  </Button>
                )}
                {item.is_for_rent && (
                  <Button variant="outline" className="flex-1" size="sm">
                    <Clock className="h-4 w-4 mr-1" />
                    대여
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {marketplaceData.length === 0 && (
        <div className="col-span-full text-center py-8 text-gray-500">
          판매 중인 건강데이터가 없습니다.
        </div>
      )}
    </div>
  )
}

// 내 데이터 컴포넌트
function MyHealthData({ healthData, currentWallet, onSuccess, onError, onRefresh }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {healthData.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{item.title}</span>
              <Badge variant={item.data_type === '혈액검사' ? 'default' : 'secondary'}>
                {item.data_type}
              </Badge>
            </CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>품질 점수:</span>
                <span className="font-semibold">{item.quality_score}/10</span>
              </div>
              <div className="flex justify-between">
                <span>NFT ID:</span>
                <span className="text-xs font-mono">{item.nft_token_id?.slice(0, 10)}...</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Badge variant={item.is_for_sale ? 'default' : 'outline'}>
                  {item.is_for_sale ? '판매 중' : '비매품'}
                </Badge>
                <Badge variant={item.is_for_rent ? 'default' : 'outline'}>
                  {item.is_for_rent ? '대여 가능' : '대여 불가'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {healthData.length === 0 && (
        <div className="col-span-full text-center py-8 text-gray-500">
          등록된 건강데이터가 없습니다.
        </div>
      )}
    </div>
  )
}

// 데이터 등록 컴포넌트
function CreateHealthData({ currentWallet, onSuccess, onError }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    data_type: '',
    file_content: '',
    quality_score: 5,
    price: 0,
    is_for_sale: false,
    is_for_rent: false
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!currentWallet) {
      onError('지갑이 필요합니다')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/health-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          owner_address: currentWallet.address,
          wallet_seed: currentWallet.seed
        })
      })

      const data = await response.json()
      if (response.ok) {
        onSuccess('건강데이터가 성공적으로 등록되었습니다!')
        setFormData({
          title: '',
          description: '',
          data_type: '',
          file_content: '',
          quality_score: 5,
          price: 0,
          is_for_sale: false,
          is_for_rent: false
        })
      } else {
        onError(data.error)
      }
    } catch (err) {
      onError('데이터 등록 중 오류가 발생했습니다')
    }
    setLoading(false)
  }

  if (!currentWallet) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">건강데이터를 등록하려면 먼저 지갑을 생성하세요.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 건강데이터 등록</CardTitle>
        <CardDescription>
          건강데이터를 NFT로 토큰화하여 등록합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="data_type">데이터 유형</Label>
            <Select 
              value={formData.data_type} 
              onValueChange={(value) => setFormData({...formData, data_type: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="데이터 유형 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="혈액검사">혈액검사</SelectItem>
                <SelectItem value="의료영상">의료영상</SelectItem>
                <SelectItem value="처방전">처방전</SelectItem>
                <SelectItem value="진료기록">진료기록</SelectItem>
                <SelectItem value="건강검진">건강검진</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="file_content">파일 내용 (시뮬레이션)</Label>
            <Textarea
              id="file_content"
              value={formData.file_content}
              onChange={(e) => setFormData({...formData, file_content: e.target.value})}
              placeholder="실제 구현에서는 파일 업로드 기능이 들어갑니다"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="quality_score">품질 점수 (1-10)</Label>
            <Input
              id="quality_score"
              type="number"
              min="1"
              max="10"
              value={formData.quality_score}
              onChange={(e) => setFormData({...formData, quality_score: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <Label htmlFor="price">가격 (XRP)</Label>
            <Input
              id="price"
              type="number"
              step="0.000001"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_for_sale}
                onChange={(e) => setFormData({...formData, is_for_sale: e.target.checked})}
              />
              <span>판매 허용</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_for_rent}
                onChange={(e) => setFormData({...formData, is_for_rent: e.target.checked})}
              />
              <span>대여 허용</span>
            </label>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '등록 중...' : '건강데이터 등록'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// 거래 내역 컴포넌트
function TransactionHistory({ transactions }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>거래 내역</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div key={tx.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Badge variant={tx.transaction_type === 'sale' ? 'default' : 'secondary'}>
                    {tx.transaction_type === 'sale' ? '판매' : '대여'}
                  </Badge>
                  <span className="ml-2 font-semibold">{tx.amount} XRP</span>
                </div>
                <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                  {tx.status}
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                <p>구매자: {tx.buyer_address.slice(0, 10)}...</p>
                <p>판매자: {tx.seller_address.slice(0, 10)}...</p>
                <p>일시: {new Date(tx.created_at).toLocaleString()}</p>
                {tx.xrpl_tx_hash && (
                  <p>TX Hash: {tx.xrpl_tx_hash.slice(0, 20)}...</p>
                )}
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              거래 내역이 없습니다.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default App

