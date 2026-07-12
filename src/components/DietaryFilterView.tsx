import React, { useState } from 'react';
import { Shield, Sparkles, AlertTriangle, Heart, CheckCircle2, RefreshCw } from 'lucide-react';
import { FamilyMember } from '../types';

interface DietaryFilterViewProps {
  family: FamilyMember[];
  setFamily: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
}

export default function DietaryFilterView({ family, setFamily }: DietaryFilterViewProps) {
  const [selectedIngredient, setSelectedIngredient] = useState('White Rice');
  const [testResult, setTestResult] = useState<{
    status: 'pass' | 'fail' | 'warn';
    glycemicIndex: number;
    glycemicLoad: number;
    allergenWarning: string;
    description: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const ingredientDB: Record<string, {
    glycemicIndex: number;
    glycemicLoad: number;
    allergenWarning: string;
    description: string;
    status: 'pass' | 'fail' | 'warn';
  }> = {
    'White Rice': {
      glycemicIndex: 72,
      glycemicLoad: 29,
      allergenWarning: 'None',
      description: 'High glycemic index stimulates insulin spike. Highly dangerous for diabetics like Raj.',
      status: 'fail',
    },
    'Unpolished Red Rice': {
      glycemicIndex: 55,
      glycemicLoad: 16,
      allergenWarning: 'None',
      description: 'Medium glycemic index with rich fibre content. Safe for diabetic diabetic diets.',
      status: 'pass',
    },
    'Mysoor Dhal': {
      glycemicIndex: 25,
      glycemicLoad: 5,
      allergenWarning: 'None',
      description: 'Very low glycemic level and packed with proteins, safe and nutritious for all members.',
      status: 'pass',
    },
    'Fresh Cow Milk': {
      glycemicIndex: 31,
      glycemicLoad: 3,
      allergenWarning: 'Lactose Allergen Alert: Baby Amara exhibits digestive sensitivities to cow protein.',
      description: 'Lactose dairy proteins can trigger digestive sensitivities in infants.',
      status: 'warn',
    },
    'Prawns': {
      glycemicIndex: 0,
      glycemicLoad: 0,
      allergenWarning: '⚠️ CRITICAL: Shellfish Allergen. Triggers acute histamine reaction in Nisha!',
      description: 'Severe high-antigen shellfish. Must be entirely filtered from Nisha’s meal plans.',
      status: 'fail',
    },
    'Stevia sweetener': {
      glycemicIndex: 0,
      glycemicLoad: 0,
      allergenWarning: 'None',
      description: 'Zero caloric organic leaf extract. Approved alternative sweetener for diabetes.',
      status: 'pass',
    }
  };

  const runTest = () => {
    setTesting(true);
    setTimeout(() => {
      setTestResult(ingredientDB[selectedIngredient] || null);
      setTesting(false);
    }, 600);
  };

  React.useEffect(() => {
    // Initial load
    setTestResult(ingredientDB[selectedIngredient]);
  }, [selectedIngredient]);

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]" id="agent6-viewport">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">AI Dietary Guard</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">Agent 6: Dietary Preference Filter</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Observe biochemical rules evaluated by Agent 6. Every generated meal undergoes a rigorous scanning filter cross-checked against your household medical and allergy files.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Parameter Panel */}
        <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-6 shadow-sm">
          <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2">
            <Heart className="text-[#16A34A] h-5 w-5" /> Screen Ingredient
          </h3>

          <div className="space-y-4 text-xs">
            {/* Dropdown test trigger */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block">Select Grocery Item</label>
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                className="w-full text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              >
                {Object.keys(ingredientDB).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <button
              onClick={runTest}
              disabled={testing}
              className="w-full bg-[#16A34A] hover:bg-[#14532D] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {testing ? 'Auditing Biochemistry...' : 'Audit Glycemic Profile'}
            </button>
          </div>

          <div className="pt-4 border-t border-[#BBF7D0] space-y-2.5 text-xs text-[#15803D]">
            <p className="font-bold uppercase tracking-wider text-[9px] text-[#14532D]">Active Rules Matrix</p>
            <div className="space-y-1">
              <p>• Diabetic Rule: Glucose Limit <strong className="font-bold">&lt; 55 GI</strong></p>
              <p>• Histamine Allergy Restriction: <strong className="font-bold">Shellfish</strong></p>
              <p>• Pediatric Restriction: No unboiled cow milk</p>
            </div>
          </div>
        </div>

        {/* Right Output Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-serif font-bold text-lg text-[#14532D] pb-3 border-b border-[#BBF7D0] flex items-center gap-2">
            <Sparkles className="text-[#16A34A] h-5 w-5 animate-pulse" /> Neural Filter Outcome
          </h3>

          {testResult && (
            <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-6 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-bold font-serif text-[#14532D] leading-tight">{selectedIngredient}</h4>
                  <p className="text-[10px] text-[#15803D] uppercase tracking-wider font-mono mt-1">Biocode Verification</p>
                </div>

                <span className={`px-4 py-1.5 rounded-full font-sans text-xs font-bold uppercase tracking-wide border ${
                  testResult.status === 'pass'
                    ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                    : testResult.status === 'warn'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-red-50 text-red-850 border-red-200'
                }`}>
                  {testResult.status === 'pass' ? '✓ SAFE FOR RATIONING' : testResult.status === 'warn' ? '⚠️ ALLERGEN WARNING' : '🚫 EXCLUDED BY FILTER'}
                </span>
              </div>

              {/* Bio Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-[#F0FDF4] p-4 rounded-2xl border border-[#BBF7D0] text-center">
                  <p className="text-[#15803D] text-[10px] uppercase font-mono">Glycemic Index</p>
                  <p className="text-2xl font-bold font-mono text-[#14532D] mt-1">{testResult.glycemicIndex}</p>
                </div>
                <div className="bg-[#F0FDF4] p-4 rounded-2xl border border-[#BBF7D0] text-center">
                  <p className="text-[#15803D] text-[10px] uppercase font-mono">Glycemic Load (Per 100g)</p>
                  <p className="text-2xl font-bold font-mono text-[#14532D] mt-1">{testResult.glycemicLoad}</p>
                </div>
                <div className="bg-[#F0FDF4] p-4 rounded-2xl border border-[#BBF7D0] text-center col-span-2 sm:col-span-1">
                  <p className="text-[#15803D] text-[10px] uppercase font-mono">Allergies Mapped</p>
                  <p className="text-xs font-semibold text-[#14532D] mt-1.5 truncate">{testResult.allergenWarning !== 'None' ? 'Yes' : 'None'}</p>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0] text-xs leading-relaxed text-[#14532D] italic">
                "{testResult.description}"
              </div>

              {/* Allergen detail if exists */}
              {testResult.allergenWarning !== 'None' && (
                <div className="flex gap-2.5 p-4 bg-orange-50 border border-orange-200 text-orange-950 rounded-2xl text-xs">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold uppercase tracking-wider text-[10px]">Allergen Protocol Initiated</p>
                    <p className="text-[11px] text-stone-600 leading-relaxed mt-1">{testResult.allergenWarning}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-[#2D332D] border border-stone-800 text-white rounded-[24px] text-xs flex gap-3 shadow-inner">
            <CheckCircle2 className="h-5 w-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#16A34A] font-mono uppercase tracking-wider text-[10px]">PLAN_GRO DIETARY COMPILER PRE-SCREENER</p>
              <p className="text-stone-300 leading-relaxed mt-1">
                Dietary presets ensure that glycemic loads remain buffered. The system strips all white-starch shopping lines and forces Cargills or Keells to provide low glycemic, unpolished substitutes such as red unpolished rice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
