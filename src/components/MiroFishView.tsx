import React, { useState } from 'react';
import { Sparkles, AlertCircle, RefreshCw, BarChart2, CheckCircle, Ship, Compass, ArrowRight } from 'lucide-react';

export default function MiroFishView() {
  const [seaCondition, setSeaCondition] = useState<'neutral' | 'monsoon' | 'gale'>('neutral');
  const [selectedSpecies, setSelectedSpecies] = useState('Skipjack Tuna');
  const [runningSim, setRunningSim] = useState(false);
  const [simStep, setSimStep] = useState('');
  const [simFinished, setSimFinished] = useState(true);

  // DB of seafood params
  const speciesDB: Record<string, { basePriceA: number; basePriceB: number; baseDaysA: number; baseDaysB: number }> = {
    'Skipjack Tuna': { basePriceA: 1400, basePriceB: 950, baseDaysA: 3, baseDaysB: 6 },
    'Red Snapper': { basePriceA: 1900, basePriceB: 1200, baseDaysA: 2, baseDaysB: 5 },
    'Modha (Barramundi)': { basePriceA: 2200, basePriceB: 1550, baseDaysA: 3, baseDaysB: 7 },
    'Lagoon Prawns': { basePriceA: 1600, basePriceB: 1100, baseDaysA: 2, baseDaysB: 4 },
  };

  const executeSimulation = () => {
    setRunningSim(true);
    setSimFinished(false);
    setSimStep('Connecting to Negombo & Trincomalee harbor terminal feeds...');
    setTimeout(() => {
      setSimStep('Evaluating Peliyagoda Fish Auction wholesale surcharges...');
      setTimeout(() => {
        setSimStep('Modeling ice-to-seawater cold chain degradation curves...');
        setTimeout(() => {
          setSimStep('Finalizing margins vs carbon toll models...');
          setTimeout(() => {
            setRunningSim(false);
            setSimFinished(true);
            setSimStep('');
          }, 1000);
        }, 900);
      }, 900);
    }, 800);
  };

  const speciesData = speciesDB[selectedSpecies] || speciesDB['Skipjack Tuna'];

  // Calculate under sea condition filters
  let premiumA = 0;
  let premiumB = 0;
  let reductionA = 0;
  let reductionB = 0;

  if (seaCondition === 'monsoon') {
    premiumA = 400; // middleman uses monsoon shortage as pricing excuse
    premiumB = 150; // direct boats take slightly more hazard pay
    reductionA = 1.5; // stale transit takes longer, spoils faster
    reductionB = 1.0; // smart cold containment boxes insulate direct boat catch
  } else if (seaCondition === 'gale') {
    premiumA = 800; // heavy shortages, prices spike wildly
    premiumB = 300;
    reductionA = 2.0;
    reductionB = 1.5;
  }

  const priceA = speciesData.basePriceA + premiumA;
  const priceB = speciesData.basePriceB + premiumB;
  const daysA = Math.max(0.5, speciesData.baseDaysA - reductionA);
  const daysB = Math.max(1.0, speciesData.baseDaysB - reductionB);

  const markupSavings = priceA - priceB;
  const savingsPercent = Math.round((markupSavings / priceA) * 100);

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]" id="mirofish-viewport">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">A/B Procurement Experiment</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">MiroFish Sourcing Analytics</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Evaluate distributed supply chain hypotheses for Ceylon's fresh fish inventory. Direct coastal boat contracts bypass middle-man auctions, maintaining pristine cold chain standards and wholesale margins.
        </p>
      </div>

      {/* Main Layout Divided */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sourcing parameters */}
        <div className="space-y-6">
          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-5 shadow-sm">
            <h3 className="font-serif font-bold text-base text-[#14532D] flex items-center gap-2">
              <Ship className="text-[#16A34A] h-5 w-5" /> Sourcing Inputs
            </h3>

            {/* Species Select */}
            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-mono tracking-widest text-[#15803D] uppercase font-bold block">Seafood Variety</label>
              <select
                value={selectedSpecies}
                onChange={(e) => setSelectedSpecies(e.target.value)}
                className="w-full text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              >
                {Object.keys(speciesDB).map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
            </div>

            {/* Sea Condition Preset */}
            <div className="space-y-1.5 text-xs">
              <label className="text-[10px] font-mono tracking-widest text-[#15803D] uppercase font-bold block">Ocean Climate Preset</label>
              <div className="grid grid-cols-3 gap-2">
                {(['neutral', 'monsoon', 'gale'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSeaCondition(mode)}
                    className={`p-2 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer text-center ${
                      seaCondition === mode
                        ? 'bg-[#16A34A] text-white border-[#16A34A]'
                        : 'bg-[#FBFBFA] border-[#BBF7D0] hover:bg-[#F0FDF4]'
                    }`}
                  >
                    {mode === 'neutral' ? 'Calm' : mode === 'monsoon' ? 'Monsoon' : 'Storm Gale'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={executeSimulation}
              disabled={runningSim}
              className="w-full bg-[#16A34A] hover:bg-[#14532D] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {runningSim ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
              {runningSim ? 'Recalculating Models...' : 'Execute A/B Simulation'}
            </button>
          </div>

          {/* Running simulated logs code */}
          {runningSim && (
            <div className="bg-[#2D332D] border border-stone-800 rounded-[24px] p-5 font-mono text-xs text-[#E8F5E9] space-y-2 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-ping"></span>
                <span className="text-[#10B981]">MIROFISH_ANALYTICS: SIMULATING_MODELS</span>
              </div>
              <p className="text-white">➔ {simStep}</p>
            </div>
          )}
        </div>

        {/* Side by side comparison results */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-[#BBF7D0]">
            <h3 className="font-serif font-bold text-lg text-[#14532D]">A/B Sourcing Hypothesis Testing (A vs B)</h3>
            <span className="text-[10px] font-mono uppercase bg-[#F0FDF4] text-[#16A34A] px-2.5 py-0.5 rounded-full border border-[#BBF7D0]">Active Sourcing Matrix</span>
          </div>

          {simFinished && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              
              {/* Hypothesis A card */}
              <div className="bg-white border border-[#BBF7D0]/60 rounded-[32px] p-6 space-y-5 shadow-xs relative opacity-90">
                <span className="absolute right-4 top-4 text-xs font-mono font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded border">HYPOTHESIS A</span>
                <div>
                  <h4 className="font-serif font-bold text-[#14532D] text-lg">Auction Brokerage</h4>
                  <p className="text-[10px] text-stone-400 font-mono tracking-widest uppercase">Peliyagoda Wholesale Market</p>
                </div>

                <div className="space-y-3.5 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500 font-medium">Wholesale Price (LKR/kg):</span>
                    <span className="font-mono font-bold text-[#14532D]">LKR {priceA}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500 font-medium">Post-Sourcing Freshness:</span>
                    <span className="font-mono font-semibold text-orange-700">{daysA} Days remaining</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500 font-medium">Carbon Toll (Local road dispatch):</span>
                    <span className="font-mono font-medium text-stone-700">12.4 kg CO2</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500 font-medium">Monsoon Congestion Risk:</span>
                    <span className="font-sans font-bold text-red-600 uppercase">HIGH</span>
                  </div>
                </div>

                <p className="text-[11px] bg-stone-50 text-stone-500 p-3 rounded-2xl italic leading-relaxed border">
                  Sourcing reliant on local dealers. Volatility spikes of up to 50% are passed down directly to Ceylon supermarket retail shelves.
                </p>
              </div>

              {/* Hypothesis B card */}
              <div className="bg-white border-2 border-[#16A34A] rounded-[32px] p-6 space-y-5 shadow-sm relative">
                <span className="absolute right-4 top-4 text-xs font-mono font-bold text-white bg-[#16A34A] px-2 py-0.5 rounded-full border border-[#16A34A]">HYPOTHESIS B (WINNER)</span>
                <div>
                  <h4 className="font-serif font-bold text-[#14532D] text-lg flex items-center gap-1.5">
                    plango Direct Boat Sourcing
                  </h4>
                  <p className="text-[10px] text-[#16A34A] font-mono tracking-widest uppercase">Coastal Harbor Procurement</p>
                </div>

                <div className="space-y-3.5 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#15803D] font-bold">Wholesale Price (LKR/kg):</span>
                    <span className="font-mono font-extrabold text-[#16A34A]">LKR {priceB}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#15803D] font-bold">Post-Sourcing Freshness:</span>
                    <span className="font-mono font-extrabold text-[#16A34A]">{daysB} Days remaining</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#15803D] font-medium">Carbon Toll (Direct harbour route):</span>
                    <span className="font-mono font-bold text-[#14532D]">4.2 kg CO2</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#15803D] font-medium">Monsoon Congestion Risk:</span>
                    <span className="font-sans font-bold text-[#16A34A] uppercase">LOW</span>
                  </div>
                </div>

                <p className="text-[11px] bg-[#F0FDF4] text-[#14532D] p-3 rounded-2xl italic leading-relaxed border border-[#BBF7D0]">
                  Direct harbor-to-kitchen routing. Smart insulation boxes protect the skipjack fish during Galle road monsoon floods.
                </p>
              </div>
            </div>
          )}

          {simFinished && (
            <div className="p-5 bg-[#F0FDF4] rounded-[24px] border border-[#BBF7D0] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-serif font-bold text-[#14532D]">Procurement Hypothesis Verdict</p>
                <p className="text-xs text-[#15803D] leading-relaxed">
                  Hypothesis B saves <strong className="font-bold text-[#16A34A]">LKR {markupSavings} per kg</strong> (saves {savingsPercent}% overall) and secures <strong className="font-bold text-[#16A34A]">+{daysB - daysA} days</strong> of extended shelf life in baby Amara's nutritional cupboard database!
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm flex-shrink-0">
                <span>Save Hypothesis</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
