import React from 'react';
import { CloudRain, Sun, AlertTriangle, Route, ShieldAlert, Sparkles, TrendingDown, Clock, HelpCircle, Eye } from 'lucide-react';
import { WeatherCondition, TrafficCondition, CrisisAlert, FamilyMember } from '../types';

interface DashboardOverviewProps {
  weather: WeatherCondition;
  setWeather: (w: WeatherCondition) => void;
  traffic: TrafficCondition;
  setTraffic: (t: TrafficCondition) => void;
  crisis: CrisisAlert;
  setCrisis: (c: CrisisAlert) => void;
  family: FamilyMember[];
  inventoryValue: number;
  unpurchasedItems: number;
}

export default function DashboardOverview({
  weather,
  setWeather,
  traffic,
  setTraffic,
  crisis,
  setCrisis,
  family,
  inventoryValue,
  unpurchasedItems,
}: DashboardOverviewProps) {
  
  // Toggling climate values
  const toggleClimate = () => {
    if (weather.condition === 'monsoon') {
      setWeather({ condition: 'sunny', temperature: 31, rainMm: 0, spoilageModifier: 1.0 });
    } else {
      setWeather({ condition: 'monsoon', temperature: 27, rainMm: 24, spoilageModifier: 0.5 });
    }
  };

  // Toggling traffic bottlenecks
  const toggleTraffic = () => {
    if (traffic.status === 'blocked' || traffic.status === 'congested') {
      setTraffic({
        route: 'Ratmalana (Home) ➔ Colombo 7 Supermarkets',
        status: 'clear',
        estimatedTimeMin: 20,
        fuelAdjustedCostLkr: 220,
      });
    } else {
      setTraffic({
        route: 'Ratmalana (Home) ➔ Colombo 7 Supermarkets',
        status: 'blocked',
        estimatedTimeMin: 110,
        fuelAdjustedCostLkr: 890,
        alternativeRoute: 'Ratmalana Road via Attidiya ➔ Cargills Battaramulla',
        alternativeTimeMin: 35,
      });
    }
  };

  // Toggling crisis alerts
  const toggleCrisis = () => {
    if (crisis.type === 'flood') {
      setCrisis({
        type: 'none',
        severity: 'none',
        affectedAreas: [],
        expectedDurationDays: 0,
        warningText: 'All regions clear. Supermarkets are functioning on regular timetables.',
      });
    } else {
      setCrisis({
        type: 'flood',
        severity: 'high',
        affectedAreas: ['Colombo 7', 'Thalawathugoda', 'Low lying parts of Ratmalana'],
        expectedDurationDays: 3,
        warningText: 'Active monsoon flooding around key low-lying roads. Keells route highly congested & flooded. Secure reserves!',
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      
      {/* Header section */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold">Active Status Control</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">SaaS Family Dashboard</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Observe live metrics mapped into the plango Agent pipeline. Simulate environmental and dietary triggers below to immediately examine how our neural routing reorganizes your shopping cost.
        </p>
      </div>

      {/* Grid counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Bento Card 1: Home Inventory Value */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-[#BBF7D0] relative overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="absolute right-4 top-4 text-[#BBF7D0] opacity-40">
            <Sparkles className="h-16 w-16" />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-[#15803D] font-bold">Home Stock Value</p>
          <p className="text-3xl font-light text-[#2D332D] mt-2">{inventoryValue} <span className="text-lg opacity-60">LKR</span></p>
          <div className="text-xs text-[#15803D] mt-4 flex items-center gap-1.5 bg-[#F0FDF4] py-1.5 px-3 rounded-xl w-max border border-[#BBF7D0]">
            <TrendingDown className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>Prevents 35% overbuying</span>
          </div>
        </div>

        {/* Bento Card 2: Active shopping targets */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-[#BBF7D0] relative overflow-hidden transition-all duration-305 hover:shadow-md">
          <p className="text-[10px] uppercase tracking-wider text-[#15803D] font-bold">Total Active Members</p>
          <p className="text-3xl font-light text-[#2D332D] mt-2">{family.length} <span className="text-lg opacity-60">Persons</span></p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <span className="text-[10px] bg-[#F0FDF4] text-[#16A34A] px-2.5 py-0.5 rounded-full font-semibold border border-[#BBF7D0]">diabetic filter active</span>
            <span className="text-[10px] bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full font-semibold border border-red-100 font-sans">allergen filter active</span>
          </div>
        </div>

        {/* Bento Card 3: Food waste reduction metric */}
        <div className="bg-[#16A34A] rounded-[32px] p-6 shadow-sm text-white flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider opacity-90 font-bold">Food Waste Mitigation</span>
              <span className="text-xs font-mono font-bold text-[#14532D] bg-[#DCFCE7] px-2.5 py-0.5 rounded-md border border-[#BBF7D0]">92% Rating</span>
            </div>
            
            {/* Minimal progress bar */}
            <div className="w-full bg-white/20 h-1.5 mt-3 rounded-full overflow-hidden">
              <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: '92%' }}></div>
            </div>
            <p className="text-white/90 text-[11px] mt-2">Adjusted perishable portions matching weather spoilage thresholds.</p>
          </div>
          <div className="text-[10px] text-white/75 mt-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Updated 1 min ago
          </div>
        </div>
      </div>

      {/* Simulator Actions Box */}
      <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 shadow-sm">
        <h3 className="text-xs font-bold text-[#14532D] tracking-widest uppercase mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#16A34A] animate-pulse" />
          Autonomous System Env Control Hub
        </h3>
        <p className="text-xs text-[#15803D] mb-5 leading-relaxed">
          plango AI dynamically adjusts grocery lists by querying external weather, municipal traffic limits, and active humanitarian alerts. Toggle variables below to trace pipeline shifts.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Weather simulation button */}
          <button
            onClick={toggleClimate}
            className="flex flex-col items-start p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 border-[#BBF7D0] bg-[#FBFBFA] hover:bg-[#DCFCE7]/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${weather.condition === 'monsoon' ? 'bg-[#C6F6D5] text-[#14532D]' : 'bg-amber-50 text-amber-700'}`}>
                {weather.condition === 'monsoon' ? <CloudRain className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </div>
              <span className="text-xs font-semibold text-[#2D332D] capitalize">{weather.condition} mode</span>
            </div>
            <span className="text-[10px] text-[#15803D]">{weather.condition === 'monsoon' ? 'Water Spilage modifier 0.5x' : 'Expires on typical durations'}</span>
            <span className="text-[11px] font-semibold text-[#16A34A] mt-2 underline">Switch Climate</span>
          </button>

          {/* Traffic simulation button */}
          <button
            onClick={toggleTraffic}
            className="flex flex-col items-start p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 border-[#BBF7D0] bg-[#FBFBFA] hover:bg-[#DCFCE7]/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${traffic.status === 'blocked' ? 'bg-red-50 text-red-700' : 'bg-[#C6F6D5] text-[#14532D]'}`}>
                <Route className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#2D332D] capitalize">Traffic: {traffic.status}</span>
            </div>
            <span className="text-[10px] text-[#15803D]">Commute takes {traffic.estimatedTimeMin} mins</span>
            <span className="text-[11px] font-semibold text-[#16A34A] mt-2 underline">Switch Transit Route</span>
          </button>

          {/* Crisis simulation button */}
          <button
            onClick={toggleCrisis}
            className="flex flex-col items-start p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 border-[#BBF7D0] bg-[#FBFBFA] hover:bg-[#DCFCE7]/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${crisis.type === 'flood' ? 'bg-orange-50 text-orange-700 animate-pulse' : 'bg-[#C6F6D5] text-[#14532D]'}`}>
                <ShieldAlert className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#2D332D] capitalize">Alert Status: {crisis.type}</span>
            </div>
            <span className="text-[10px] text-[#15803D]">{crisis.type === 'flood' ? 'Triggers secure stockpile order' : 'Status clean'}</span>
            <span className="text-[11px] font-semibold text-[#16A34A] mt-2 underline">Switch Emergency Sensor</span>
          </button>
        </div>
      </div>

      {/* Grid detailing environments specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Environment Column 1: Live Weather & Spilage */}
        <div className="border border-[#BBF7D0] rounded-[32px] p-6 bg-white shadow-sm space-y-4">
          <h4 className="font-serif text-lg font-bold text-[#14532D] flex items-center gap-2">
            <CloudRain className="text-[#16A34A] h-5 w-5" /> Weather Spoilage Sensors
          </h4>
          <p className="text-[#15803D] text-xs leading-relaxed">
            During heavy rains and high tropical humidity, local tomatoes decay 50% faster. Current sensors adjust your purchase quantities dynamically:
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs bg-[#FBFBFA] p-4 rounded-2xl border border-[#BBF7D0]">
            <div>
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Condition</p>
              <p className="text-[#2D332D] font-semibold mt-1 flex items-center gap-1.5 capitalize">
                {weather.condition === 'monsoon' ? '☔ Sri Lankan Monsoon' : '☀ Sunny Tropical'}
              </p>
            </div>
            <div>
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Temperature</p>
              <p className="text-[#2D332D] font-semibold mt-1">{weather.temperature}°C Mean</p>
            </div>
            <div className="mt-2">
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Rain Vol</p>
              <p className="text-[#2D332D] font-semibold mt-1">{weather.rainMm} mm/hr</p>
            </div>
            <div className="mt-2">
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Spoilage Speed</p>
              <p className="text-[#2D332D] font-semibold mt-1 text-[#16A34A] font-mono">
                {weather.condition === 'monsoon' ? '⚡ Tomato decays 2x faster' : '✓ Normal Decay Rate'}
              </p>
            </div>
          </div>
        </div>

        {/* Environment Column 2: Traffic & Crises */}
        <div className="border border-[#BBF7D0] rounded-[32px] p-6 bg-white shadow-sm space-y-4">
          <h4 className="font-serif text-lg font-bold text-[#14532D] flex items-center gap-2">
            <AlertTriangle className="text-orange-600 h-5 w-5" /> Transit and Emergency Alerts
          </h4>
          <p className="text-[#15803D] text-xs leading-relaxed">
            Active roadblocks, monsoon flooding, and strikes bypass supermarkets located in congested corridors, moving shopping lists to alternative store hubs:
          </p>

          <div className="space-y-3">
            <div className="bg-[#FBFBFA] p-3.5 rounded-2xl border border-[#BBF7D0] text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#2D332D]">Transport: Ratmalana ➔ Colombo 7</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono ${traffic.status === 'blocked' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                  {traffic.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[#15803D] text-[11px] mt-1">Commute takes {traffic.estimatedTimeMin} mins (Cost: LKR {traffic.fuelAdjustedCostLkr})</p>
              {traffic.alternativeRoute && (
                <div className="mt-2 p-2 bg-[#F0FDF4] rounded-xl text-[10px] text-[#14532D] border-l-2 border-[#16A34A]">
                  Alternative Route suggested: {traffic.alternativeRoute} ({traffic.alternativeTimeMin} mins)
                </div>
              )}
            </div>

            {crisis.type !== 'none' && (
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl flex gap-3 text-xs">
                <ShieldAlert className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-orange-950 uppercase text-[10px]">Active Storm & Flood Warning</p>
                  <p className="text-stone-605 text-[11px] mt-0.5 leading-relaxed">{crisis.warningText}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
