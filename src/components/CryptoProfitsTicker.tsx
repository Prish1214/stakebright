import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface ProfitEntry {
  id: number;
  user: string;
  amount: number;
  crypto: string;
  time: string;
}

const cryptos = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE'];
const userPrefixes = ['User', 'Trader', 'Investor', 'Crypto'];

const generateRandomProfit = (id: number): ProfitEntry => {
  const amount = (Math.random() * 500 + 10).toFixed(2);
  const crypto = cryptos[Math.floor(Math.random() * cryptos.length)];
  const prefix = userPrefixes[Math.floor(Math.random() * userPrefixes.length)];
  const userNum = Math.floor(Math.random() * 9000 + 1000);
  const minutes = Math.floor(Math.random() * 59 + 1);
  
  return {
    id,
    user: `${prefix}***${userNum}`,
    amount: parseFloat(amount),
    crypto,
    time: `${minutes}m ago`
  };
};

const CryptoProfitsTicker = () => {
  const [profits, setProfits] = useState<ProfitEntry[]>([]);

  useEffect(() => {
    // Generate initial profits
    const initialProfits = Array.from({ length: 20 }, (_, i) => generateRandomProfit(i));
    setProfits(initialProfits);

    // Add new profit every 3 seconds
    const interval = setInterval(() => {
      setProfits(prev => {
        const newProfit = generateRandomProfit(Date.now());
        return [newProfit, ...prev.slice(0, 19)];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-40 overflow-hidden">
      <div className="flex items-center">
        <div className="bg-primary px-4 py-2 flex items-center gap-2 shrink-0 z-10">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
          <span className="text-sm font-semibold text-primary-foreground whitespace-nowrap">Live Profits</span>
        </div>
        
        <div className="overflow-hidden flex-1">
          <div className="animate-marquee flex gap-8 py-2 px-4">
            {profits.map((profit) => (
              <div 
                key={profit.id} 
                className="flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <span className="text-muted-foreground">{profit.user}</span>
                <span className="text-success font-semibold">+${profit.amount}</span>
                <span className="text-crypto-gold font-medium">{profit.crypto}</span>
                <span className="text-muted-foreground text-xs">{profit.time}</span>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {profits.map((profit) => (
              <div 
                key={`dup-${profit.id}`} 
                className="flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <span className="text-muted-foreground">{profit.user}</span>
                <span className="text-success font-semibold">+${profit.amount}</span>
                <span className="text-crypto-gold font-medium">{profit.crypto}</span>
                <span className="text-muted-foreground text-xs">{profit.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoProfitsTicker;
