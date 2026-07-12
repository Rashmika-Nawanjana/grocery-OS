import React, { useState } from 'react';
import { Compass, RefreshCcw, Check, Sparkles, TrendingUp, Info } from 'lucide-react';
import { StorePrice, WeatherCondition } from '../types';

interface SupermarketGridProps {
  prices: StorePrice[];
  setPrices: (prices: StorePrice[]) => void;
  weather: WeatherCondition;
}

export default function SupermarketGrid({ prices, setPrices, weather }: SupermarketGridProps) {
  const [scraping, setScraping] = useState(false);
  const [scrapeStep, setScrapeStep] = useState('');
  const [scrapedSuccessfully, setScrapedSuccessfully] = useState(false);

  // Apply monsoon price premium (+30% to tomatoes)
  const isMonsoon = weather.condition === 'monsoon';

  // Supermarket scraper simulation
  const triggerScraper = () => {
    if (scraping) return;
    setScraping(true);
    setScrapedSuccessfully(false);

    const steps = [
      'Establishing WebSocket connection to Keells Colombo 7 endpoint...',
      'Injecting script parameters & parsing HTML elements...',
      'Keells download complete. Commencing Cargills Battaramulla parsing...',
      'Applying Sri Lankan Pola Wholesale Daily Commodity markup data...',
      'Compiling price grids into final unified plango catalog matrix...'
    ];

    let currentStep = 0;
    setScrapeStep(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setScrapeStep(steps[currentStep]);
      } else {
        clearInterval(interval);
        setScraping(false);
        setScrapeStep('');
        setScrapedSuccessfully(true);

        // Inject subtle random price shifts (e.g. within -15 LKR to +15 LKR) to show real-time synchronization
        const shifted = prices.map((item) => {
          const shiftValue = Math.floor(Math.random() * 21) - 10; // -10 to +10 LKR
          return {
            ...item,
            keellsPrice: Math.max(20, item.keellsPrice + shiftValue),
            cargillsPrice: Math.max(20, item.cargillsPrice + shiftValue),
            polaPrice: Math.max(15, item.polaPrice + shiftValue),
          };
        });
        setPrices(shifted);

        setTimeout(() => setScrapedSuccessfully(false), 3000);
      }
    }, 1000);
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">Supermarket Scraping Index</p>
          <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">Agent 1: Price Catalog Grid</h2>
          <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
            Agent 1 scrapes Keells, Cargills Food City and local Pola daily database. Tap "Sync Fresh Catalog Data" to execute the distributed scraping cron job.
          </p>
        </div>

        {/* Sync Trigger button */}
        <button
          onClick={triggerScraper}
          disabled={scraping}
          className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-2 flex-shrink-0 ${
            scraping
              ? 'bg-[#DCFCE7] text-[#14532D] border border-[#BBF7D0]'
              : 'bg-[#16A34A] hover:bg-[#14532D] text-white shadow-xs'
          }`}
        >
          <RefreshCcw className={`h-4 w-4 ${scraping ? 'animate-spin' : ''}`} />
          {scraping ? 'Scraping live feeds...' : 'Sync Catalog Data'}
        </button>
      </div>

      {/* Terminal Scraper Logs displayed during execution */}
      {scraping && (
        <div className="bg-[#14532D] border border-[#BBF7D0] rounded-[24px] p-5 font-mono text-xs text-[#DCFCE7] space-y-2 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A] animate-pulse"></span>
            <span className="text-[#BBF7D0] font-bold">PLAN_GRO_SCRAPER STATUS: INTERNAL_CRON_TRIGGERED</span>
          </div>
          <p className="text-white font-semibold">➔ {scrapeStep}</p>
        </div>
      )}

      {scrapedSuccessfully && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] p-4 rounded-xl text-[#14532D] text-xs flex items-center gap-2 animate-bounce">
          <Check className="h-4.5 w-4.5 text-[#16A34A]" />
          <span>Synchronized pricing matrix successfully! Surcharged rates with live Pola changes.</span>
        </div>
      )}

      {/* Monsoon inflation advisory */}
      {isMonsoon && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-950 text-xs flex items-start gap-3">
          <Info className="h-4.5 w-4.5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold uppercase tracking-wider text-[10px]">Active Monsoon Crop Inflation Advisory</p>
            <p className="mt-0.5 text-stone-705 leading-relaxed font-sans">
              Monsoon monsoon floods disrupt vegetable harvesting in the Nuwara Eliya region. Tomatoes prices reflect a +30% climate premium added dynamically by our quantity planner.
            </p>
          </div>
        </div>
      )}

      {/* Core pricing table */}
      <div className="bg-white border border-[#BBF7D0] rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FBFBFA] border-b border-[#BBF7D0] text-[10px] font-mono uppercase tracking-widest text-[#15803D] font-bold">
                <th className="p-4 pl-6 font-semibold">Grocery Item</th>
                <th className="p-4 font-semibold text-right">Keells Price (LKR)</th>
                <th className="p-4 font-semibold text-right">Cargills Price (LKR)</th>
                <th className="p-4 font-semibold text-right font-sans">Local Pola Database (LKR)</th>
                <th className="p-4 pr-6 font-semibold text-center">Price Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#BBF7D0]/50">
              {prices.map((item, idx) => {
                // Apply tomato inflation rate if monsoon is on.
                const isTomato = item.itemName.toLowerCase().includes('tomato');
                const pMultiplier = isTomato && isMonsoon ? 1.3 : 1.0;

                const keellsRate = Math.round(item.keellsPrice * pMultiplier);
                const cargillsRate = Math.round(item.cargillsPrice * pMultiplier);
                const polaRate = Math.round(item.polaPrice * pMultiplier);

                // Detect cheapest
                const minPrice = Math.min(keellsRate, cargillsRate, polaRate);

                return (
                  <tr key={idx} className="hover:bg-[#F0FDF4]/30 transition-colors">
                    {/* Item */}
                    <td className="p-4 pl-6 font-semibold text-[#2D332D] border-r border-[#F0FDF4]">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{item.itemName}</span>
                        <span className="text-[10px] text-[#15803D] font-mono font-bold">({item.unit})</span>
                        {isTomato && isMonsoon && (
                          <span className="text-[9px] bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-mono border border-red-200">
                            +30% Monsoon Spurge
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Keells price */}
                    <td className={`p-4 text-right border-r border-[#F0FDF4] font-mono ${keellsRate === minPrice ? 'bg-[#F0FDF4] text-[#14532D] font-bold' : 'text-[#2D332D]'}`}>
                      LKR {keellsRate}
                      {keellsRate === minPrice && <span className="text-[9px] block text-[#16A34A] font-bold font-sans">Cheapest ✓</span>}
                    </td>

                    {/* Cargills price */}
                    <td className={`p-4 text-right border-r border-[#F0FDF4] font-mono ${cargillsRate === minPrice ? 'bg-[#F0FDF4] text-[#14532D] font-bold' : 'text-[#2D332D]'}`}>
                      LKR {cargillsRate}
                      {cargillsRate === minPrice && <span className="text-[9px] block text-[#16A34A] font-bold font-sans">Cheapest ✓</span>}
                    </td>

                    {/* Pola database price */}
                    <td className={`p-4 text-right border-r border-[#F0FDF4] font-mono ${polaRate === minPrice ? 'bg-[#F0FDF4] text-[#14532D] font-bold' : 'text-[#2D332D]'}`}>
                      LKR {polaRate}
                      {polaRate === minPrice && <span className="text-[9px] block text-[#16A34A] font-bold font-sans">Cheapest ✓</span>}
                    </td>

                    {/* Savings visual indicator */}
                    <td className="p-4 pr-6 text-center">
                      {cheapestComparisonVisual(keellsRate, cargillsRate, polaRate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Render dynamic visual badge indicating the discount margin of the cheapest option vs supermarket index
function cheapestComparisonVisual(keells: number, cargills: number, pola: number) {
  const maxVal = Math.max(keells, cargills, pola);
  const minVal = Math.min(keells, cargills, pola);
  if (maxVal === minVal) return <span className="text-[#15803D] font-mono">-</span>;

  const discount = Math.round(((maxVal - minVal) / maxVal) * 100);

  return (
    <div className="inline-flex items-center gap-1 bg-[#F0FDF4] text-[#14532D] px-2.5 py-1 rounded-full border border-[#BBF7D0] text-[10px] font-mono font-bold">
      <TrendingUp className="h-3 w-3 text-[#16A34A]" />
      <span>Cheapest saves {discount}%</span>
    </div>
  );
}
