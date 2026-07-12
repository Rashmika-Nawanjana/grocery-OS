import React, { useState } from 'react';
import { Calendar, Droplets, Thermometer, ShieldAlert, Sparkles, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';

interface QuantityPlannerViewProps {
  weather: {
    condition: string;
    temperature: number;
    rainMm: number;
    spoilageModifier: number;
  };
}

export default function QuantityPlannerView({ weather }: QuantityPlannerViewProps) {
  const [humidity, setHumidity] = useState(85);
  const [simulateAudit, setSimulateAudit] = useState(false);
  const [auditStep, setAuditStep] = useState('');

  const runAudit = () => {
    setSimulateAudit(true);
    setAuditStep('Initializing humidity probe...');
    setTimeout(() => {
      setAuditStep('Evaluating microbial accelerated spores on tomatoes...');
      setTimeout(() => {
        setAuditStep('Compiling shelf-life regression charts...');
        setTimeout(() => {
          setSimulateAudit(false);
          setAuditStep('');
        }, 1200);
      }, 1000);
    }, 800);
  };

  // Calculations based on sliders
  const isWetmonsoon = weather.condition === 'monsoon';
  const temperature = weather.temperature;
  const tomatoLifespanDays = Math.max(1, Math.round(7 - (temperature * 0.1) - (humidity * 0.04) - (isWetmonsoon ? 2.5 : 0)));
  const tunaLifespanDays = Math.max(1, Math.round(4 - (temperature * 0.08) - (humidity * 0.02) - (isWetmonsoon ? 1.5 : 0)));
  const spinachLifespanDays = Math.max(1, Math.round(5 - (temperature * 0.09) - (humidity * 0.03) - (isWetmonsoon ? 2 : 0)));

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]" id="agent5-viewport">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">AI Sensory Diagnostics</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">Agent 5: Spoilage & Quantity Planner</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Observe decaying microbial cycles computed by Agent 5. The sensory network alters purchase limits in real-time, preventing high-glycemic or organic groceries from turning into waste during the monsoon peak.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sliders Control */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-5 shadow-sm">
            <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2">
              <Thermometer className="text-[#16A34A] h-5 w-5" /> Sensory Presets
            </h3>

            <div className="space-y-4">
              {/* Humidity Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#15803D] font-mono font-bold flex items-center gap-1">
                    <Droplets className="h-3.5 w-3.5 text-[#16A34A]" /> Humidity
                  </span>
                  <span className="font-mono font-bold text-[#14532D]">{humidity}% RH</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={humidity}
                  onChange={(e) => setHumidity(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#F0FDF4] rounded-lg appearance-none cursor-pointer accent-[#16A34A]"
                />
              </div>

              {/* Climate Summary indicators */}
              <div className="p-3 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0] text-xs space-y-2">
                <div className="flex justify-between items-center text-[#14532D]">
                  <span>Monsoon Status:</span>
                  <span className="font-bold">{isWetmonsoon ? 'Vigorous Active ☔' : 'Dry Season Sunny ☀'}</span>
                </div>
                <div className="flex justify-between items-center text-[#14532D]">
                  <span>Sensor Spoilage Modifier:</span>
                  <span className="font-mono font-bold text-[#16A34A]">{isWetmonsoon ? '0.5x Shelf-Life' : '1.0x Ambient'}</span>
                </div>
              </div>

              {/* Run diagnostics button */}
              <button
                onClick={runAudit}
                disabled={simulateAudit}
                className="w-full bg-[#16A34A] hover:bg-[#14532D] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-205 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {simulateAudit ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
                {simulateAudit ? 'Calibrating Spores...' : 'Run Spoilage Audit'}
              </button>
            </div>
          </div>

          {simulateAudit && (
            <div className="bg-[#2D332D] border border-[#BBF7D0] rounded-[24px] p-5 font-mono text-xs text-[#E8F5E9] space-y-2 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-ping"></span>
                <span className="text-[#10B981]">AGENT_5_DECAY_PLANNER: AUDITING_SENSORS</span>
              </div>
              <p className="text-white">➔ {auditStep}</p>
            </div>
          )}
        </div>

        {/* Degradation Chart / Bento Columns */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-serif font-bold text-lg text-[#14532D] pb-3 border-b border-[#BBF7D0] flex items-center gap-2">
            <Calendar className="text-[#16A34A] h-5 w-5" /> Estimated Shelf Life Decay Indices
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tomato Card */}
            <div className="bg-white border border-[#BBF7D0] rounded-[24px] p-5 space-y-3 relative overflow-hidden">
              <span className="absolute -right-2 -bottom-2 text-red-500 opacity-10 font-bold text-6xl">🍅</span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#15803D]">Local Organic Tomatoes</p>
              <p className="text-3xl font-serif font-bold text-[#14532D]">{tomatoLifespanDays} Days</p>
              
              <div className="w-full bg-[#F0FDF4] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-red-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (tomatoLifespanDays / 7) * 100)}%` }}
                ></div>
              </div>

              <div className="text-[10px] space-y-1 text-[#15803D]">
                <p>• Recommended max: <strong className="font-bold">1.2 kg</strong> buy order</p>
                <p className={`font-semibold ${tomatoLifespanDays <= 3 ? 'text-red-750' : 'text-[#16A34A]'}`}>
                  {tomatoLifespanDays <= 3 ? '⚠️ HIGH Spoilage warning' : '✓ Normal supply buy chain'}
                </p>
              </div>
            </div>

            {/* Seafood Card */}
            <div className="bg-white border border-[#BBF7D0] rounded-[24px] p-5 space-y-3 relative overflow-hidden">
              <span className="absolute -right-2 -bottom-2 text-cyan-500 opacity-10 font-bold text-6xl">🐟</span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#15803D]">MiroFish Skipjack Tuna</p>
              <p className="text-3xl font-serif font-bold text-[#14532D]">{tunaLifespanDays} Days</p>
              
              <div className="w-full bg-[#F0FDF4] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (tunaLifespanDays / 4) * 100)}%` }}
                ></div>
              </div>

              <div className="text-[10px] space-y-1 text-[#15803D]">
                <p>• Recommended max: <strong className="font-bold">600 g</strong> buy order</p>
                <p className={`font-semibold ${tunaLifespanDays <= 2 ? 'text-orange-750' : 'text-[#16A34A]'}`}>
                  {tunaLifespanDays <= 2 ? '⚡ Require instant freeze logging' : '✓ Safe under cold cover'}
                </p>
              </div>
            </div>

            {/* Spinach Card */}
            <div className="bg-white border border-[#BBF7D0] rounded-[24px] p-5 space-y-3 relative overflow-hidden">
              <span className="absolute -right-2 -bottom-2 text-[#16A34A] opacity-10 font-bold text-6xl">🥬</span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#15803D]">Water Spinach / Kankun</p>
              <p className="text-3xl font-serif font-bold text-[#14532D]">{spinachLifespanDays} Days</p>
              
              <div className="w-full bg-[#F0FDF4] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#16A34A] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (spinachLifespanDays / 5) * 100)}%` }}
                ></div>
              </div>

              <div className="text-[10px] space-y-1 text-[#15803D]">
                <p>• Recommended max: <strong className="font-bold">2 Bunches</strong> buy order</p>
                <p className={`font-semibold ${spinachLifespanDays <= 2 ? 'text-orange-750' : 'text-[#16A34A]'}`}>
                  {spinachLifespanDays <= 2 ? '⚡ Wet leaf rot danger' : '✓ Moist conditions accepted'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[24px] text-xs text-[#14532D] space-y-2">
            <p className="font-bold flex items-center gap-1">
              <ShieldAlert className="h-4 w-4" /> Sensorial Optimization Summary
            </p>
            <p className="leading-relaxed">
              plango AI links the output of this agent into <strong className="font-extrabold">Agent 3's Shopping List split algorithm</strong>. If decay forecasts drop below 3 days, our split compiler immediately caps procurement values and adds reminders to use the perishables within the active schedule!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
