'use client';
import React, { useMemo, useState } from 'react';
import { Clock, AlertOctagon, Heart, CheckCircle2, Plus } from 'lucide-react';
import { FamilyMember } from '@/lib/types';

interface DietaryPreferencesPanelProps {
  family: FamilyMember[];
  setFamily: (fam: FamilyMember[]) => void;
  visibleNames: string[];
  setVisibleNames: (names: string[]) => void;
}

function createFamilyMember(name: string, age: number, canCook: boolean): FamilyMember {
  return {
    id: `local-${Date.now()}`,
    name: name.trim(),
    age,
    preferences: [],
    allergies: [],
    dietaryRestrictions: [],
    favoriteIngredients: [],
    schedule: {
      workHours: '09:00 - 17:00',
      freeHours: '17:00 - 21:00',
      cookingAvailability: canCook,
      cookingSkill: 'medium',
    },
  };
}

export default function DietaryPreferencesPanel({
  family,
  setFamily,
  visibleNames,
  setVisibleNames,
}: DietaryPreferencesPanelProps) {
  const [activeInputName, setActiveInputName] = useState<string | null>(null);
  const [newPreference, setNewPreference] = useState('');
  const [activeAllergyInput, setActiveAllergyInput] = useState<string | null>(null);
  const [newAllergy, setNewAllergy] = useState('');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [newMemberCanCook, setNewMemberCanCook] = useState(false);
  const [addFormError, setAddFormError] = useState('');

  const visibleMembers = useMemo(() => {
    const seen = new Set<string>();
    const members: FamilyMember[] = [];
    for (const name of visibleNames) {
      if (seen.has(name)) continue;
      const member = family.find((m) => m.name === name);
      if (member) {
        seen.add(name);
        members.push(member);
      }
    }
    return members;
  }, [family, visibleNames]);

  const resetAddForm = () => {
    setNewMemberName('');
    setNewMemberAge('');
    setNewMemberCanCook(false);
    setAddFormError('');
  };

  const addNewFamilyMember = () => {
    const name = newMemberName.trim();
    const age = parseInt(newMemberAge, 10);
    if (!name) {
      setAddFormError('Enter a name for the household member.');
      return;
    }
    if (!Number.isFinite(age) || age < 1 || age > 120) {
      setAddFormError('Enter a valid age between 1 and 120.');
      return;
    }
    if (family.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setAddFormError('Someone with this name is already in your household.');
      return;
    }

    const member = createFamilyMember(name, age, newMemberCanCook);
    setFamily([...family, member]);
    setVisibleNames([...visibleNames, member.name]);
    setAddFormOpen(false);
    resetAddForm();
  };

  // Add preference tag to specific family member
  const addPreference = (memberName: string) => {
    if (!newPreference.trim()) return;
    const updated = family.map((member) => {
      if (member.name === memberName) {
        return {
          ...member,
          preferences: [...new Set([...member.preferences, newPreference.trim()])]
        };
      }
      return member;
    });
    setFamily(updated);
    setNewPreference('');
    setActiveInputName(null);
  };

  // Delete preference tag
  const removePreference = (memberName: string, pref: string) => {
    const updated = family.map((member) => {
      if (member.name === memberName) {
        return {
          ...member,
          preferences: member.preferences.filter((p) => p !== pref)
        };
      }
      return member;
    });
    setFamily(updated);
  };

  // Add Allergy / Dietary restriction
  const addAllergy = (memberName: string) => {
    if (!newAllergy.trim()) return;
    const updated = family.map((member) => {
      if (member.name === memberName) {
        return {
          ...member,
          allergies: [...new Set([...member.allergies, newAllergy.trim()])],
          dietaryRestrictions: [...new Set([...member.dietaryRestrictions, newAllergy.trim().toLowerCase()])]
        };
      }
      return member;
    });
    setFamily(updated);
    setNewAllergy('');
    setActiveAllergyInput(null);
  };

  // Remove Allergy restriction
  const removeAllergy = (memberName: string, allergy: string) => {
    const updated = family.map((member) => {
      if (member.name === memberName) {
        return {
          ...member,
          allergies: member.allergies.filter((a) => a !== allergy),
          dietaryRestrictions: member.dietaryRestrictions.filter((r) => r !== allergy.toLowerCase())
        };
      }
      return member;
    });
    setFamily(updated);
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      
      {/* Header section */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">Multi-User Diagnostics</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">Schedules & Preferential Memory</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          plango stores structured profiles for each household occupant. When meal recommendations are orchestrated, Agent 6 evaluates allergy thresholds while schedules guide cooking assignments.
        </p>
      </div>

      {/* Main card list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {visibleMembers.map((member) => {
          return (
            <div key={member.id ?? member.name} className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-6 flex flex-col justify-between hover:shadow-md transition-all duration-300">
              
              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-[#F0FDF4] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-[#DCFCE7] border border-[#BBF7D0] rounded-xl flex items-center justify-center text-[#14532D] font-serif font-bold text-lg">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2D332D] text-sm leading-tight">{member.name}</h3>
                      <p className="text-[10px] text-[#15803D] mt-0.5 font-bold">{member.age} years old • Commuter</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${member.schedule.cookingAvailability ? 'bg-[#DCFCE7] text-[#14532D] border border-[#BBF7D0]' : 'bg-stone-100 text-stone-600'}`}>
                    {member.schedule.cookingAvailability ? 'Cook' : 'Non-Cook'}
                  </span>
                </div>

                {/* Schedules specs */}
                <div className="space-y-2 bg-[#FBFBFA] border border-[#BBF7D0]/60 p-4 rounded-2xl text-xs">
                  <div className="flex items-center gap-1.5 text-[#2D332D]">
                    <Clock className="h-4 w-4 text-[#16A34A] flex-shrink-0" />
                    <span className="font-bold uppercase tracking-wider text-[9px] text-[#14532D]">Commute Schedule timings</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] mt-1 text-[#15803D]">
                    <div>
                      <p className="opacity-70 text-[10px]">Active Commute:</p>
                      <p className="font-bold text-[#2D332D] mt-0.5">{member.schedule.workHours}</p>
                    </div>
                    <div>
                      <p className="opacity-70 text-[10px]">Cooking expertise:</p>
                      <p className="font-bold text-[#2D332D] mt-0.5 capitalize">{member.schedule.cookingSkill} skill</p>
                    </div>
                  </div>
                </div>

                {/* Allergens Block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[#2D332D]">
                      <AlertOctagon className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      <span className="font-bold uppercase tracking-wider text-[9px] text-orange-850">Medical & Allergens</span>
                    </div>
                    <button
                      onClick={() => {
                        setActiveAllergyInput(member.name);
                        setActiveInputName(null);
                      }}
                      className="text-[10px] text-[#16A34A] font-extrabold cursor-pointer flex items-center gap-0.5 hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>

                  {activeAllergyInput === member.name && (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="e.g. Diabetics"
                        value={newAllergy}
                        onChange={(e) => setNewAllergy(e.target.value)}
                        className="text-xs border border-[#BBF7D0] p-2 rounded-xl grow bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A] font-medium"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addAllergy(member.name);
                        }}
                      />
                      <button
                        onClick={() => addAllergy(member.name)}
                        className="bg-[#16A34A] text-white rounded-xl px-3 text-xs font-bold cursor-pointer hover:bg-[#14532D]"
                      >
                        Set
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {member.allergies.length === 0 && member.dietaryRestrictions.length === 0 ? (
                      <span className="text-[10px] text-[#15803D] italic font-semibold">No restrictions declared</span>
                    ) : (
                      <>
                        {member.allergies.map((allergy, aIdx) => (
                          <span
                            key={aIdx}
                            className="text-[10px] bg-red-50 text-red-800 px-2.5 py-0.5 rounded-full font-bold border border-red-150 flex items-center gap-1 animate-fade-in"
                          >
                            <span>{allergy}</span>
                            <button
                              onClick={() => removeAllergy(member.name, allergy)}
                              className="text-red-400 hover:text-red-950 font-extrabold ml-1 cursor-pointer text-xs"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {member.dietaryRestrictions
                          .filter((r) => !member.allergies.includes(r))
                          .map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-[10px] bg-sky-50 text-sky-850 px-2.5 py-0.5 rounded-full font-bold border border-sky-150 flex items-center gap-1 animate-fade-in"
                            >
                              <span className="capitalize">{tag}</span>
                              <button
                                onClick={() => removeAllergy(member.name, tag)}
                                className="text-sky-400 hover:text-sky-950 font-extrabold ml-1 cursor-pointer text-xs"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Preferences Block */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-[#2D332D]">
                      <Heart className="h-4 w-4 text-[#16A34A] flex-shrink-0" />
                      <span className="font-bold uppercase tracking-wider text-[9px] text-[#14532D]">Household Preferences</span>
                    </div>
                    <button
                      onClick={() => {
                        setActiveInputName(member.name);
                        setActiveAllergyInput(null);
                      }}
                      className="text-[10px] text-[#16A34A] font-extrabold cursor-pointer flex items-center gap-0.5 hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>

                  {activeInputName === member.name && (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="e.g. loves onions"
                        value={newPreference}
                        onChange={(e) => setNewPreference(e.target.value)}
                        className="text-xs border border-[#BBF7D0] p-2 rounded-xl grow bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A] font-medium"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addPreference(member.name);
                        }}
                      />
                      <button
                        onClick={() => addPreference(member.name)}
                        className="bg-[#16A34A] text-white rounded-xl px-3 text-xs font-bold cursor-pointer hover:bg-[#14532D]"
                      >
                        Set
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {member.preferences.map((pref, pIdx) => {
                      return (
                        <div
                          key={pIdx}
                          className="text-[10px] bg-[#FBFBFA] text-[#2D332D] px-2.5 py-1 rounded-full border border-[#BBF7D0]/70 flex items-center gap-1 group font-medium"
                        >
                          <span>{pref}</span>
                          <button
                            onClick={() => removePreference(member.name, pref)}
                            className="text-[#15803D] hover:text-red-700 font-extrabold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Status footer alert */}
              <div className="pt-3 border-t border-[#F0FDF4] text-[10px] text-[#15803D] flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
                <span>RAG indexed profile active</span>
              </div>
            </div>
          );
        })}

        <div className="bg-[#FBFBFA] border-2 border-dashed border-[#BBF7D0] rounded-[32px] p-6 min-h-[320px] flex flex-col justify-center hover:border-[#16A34A]/50 hover:bg-[#F0FDF4]/60 transition-all">
          {!addFormOpen ? (
            <button
              type="button"
              onClick={() => {
                resetAddForm();
                setAddFormOpen(true);
              }}
              className="flex flex-col items-center justify-center gap-3 text-[#15803D] cursor-pointer group w-full"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#BBF7D0] bg-white text-[#16A34A] group-hover:border-[#16A34A] group-hover:bg-[#DCFCE7] transition-colors shadow-sm">
                <Plus className="h-8 w-8" strokeWidth={2.5} />
              </span>
              <span className="text-sm font-bold text-[#14532D]">Add household member</span>
              <span className="text-[10px] text-stone-500 font-mono text-center px-4">
                Create a new profile for someone in your home
              </span>
            </button>
          ) : (
            <div className="w-full space-y-4 animate-fade-in">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold text-center">
                New household member
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#14532D]">Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Amma, Saman"
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      setAddFormError('');
                    }}
                    className="w-full text-sm border border-[#BBF7D0] p-2.5 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#14532D]">Age</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    placeholder="e.g. 35"
                    value={newMemberAge}
                    onChange={(e) => {
                      setNewMemberAge(e.target.value);
                      setAddFormError('');
                    }}
                    className="w-full text-sm border border-[#BBF7D0] p-2.5 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-[#2D332D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newMemberCanCook}
                    onChange={(e) => setNewMemberCanCook(e.target.checked)}
                    className="rounded border-[#BBF7D0] text-[#16A34A] focus:ring-[#16A34A]"
                  />
                  <span className="font-medium">Available to cook meals</span>
                </label>
              </div>

              {addFormError && (
                <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {addFormError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAddFormOpen(false);
                    resetAddForm();
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-[#BBF7D0] text-[#15803D] hover:bg-[#EAF7EE] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addNewFamilyMember}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#16A34A] text-white hover:bg-[#14532D] cursor-pointer"
                >
                  Add member
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
