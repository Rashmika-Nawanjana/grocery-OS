# **Product Requirements Document: plango AI v2.0**

## **From Meal Plan to Intelligent Family Grocery OS**
### *Sri Lanka's first AI that knows your home groceries, family preferences, schedule, weather, traffic, and crises — then plans meals + shopping automatically*

**Duration:** **12 hours**  
**Track:** Agents & Autonomous Systems  
**Team Size:** 2–4 developers  
**Product:** plango AI — Multi-Agent Conversational Family Grocery OS with RAG Memory + External APIs  
**Deliverable:** Working MVP + 5-minute demo pitch

***

## **01 Product Overview**

**plango AI v2.0** is a multi-agent conversational **Family Grocery OS** that integrates **RAG memory of home groceries + family preferences** with **external APIs (weather, traffic, crisis feeds)** to deliver hyper-personalized meal planning and smart shopping. It knows:

- **What groceries you already have at home** (RAG memory: rice, tomatoes, fish, dhal inventory)
- **Each family member's preferences** (Nisha: no fish, diabetic; Raj: eats meat, no allergies; Kids: no spicy, love egg)
- **Dietary restrictions & allergies** (diabetes, hypertension, vegetarian, shellfish allergy)
- **Weather data** (monsoon → tomatoes spoil faster, suggest quick-cook meals)
- **Traffic data** (Keells route blocked → suggest Cargills alternative)
- **Crisis alerts** (flood warning → buy 3 days of food now)
- **Family schedules** (Nisha: 6–10 AM work, Raj: 9–6 PM office, Kids: school 8–3 PM)
- **Meal timing decisions** (when to decide coffee/lunch/dinner based on schedules)
- **Cooking assignment** (who cooks today + does that person have time?)

Users can say *"plan 5 dinners for family of 4, LKR 5,000, no fish, diabetic-friendly, monsoon this week"* and the system:

1. **Checks home inventory** (you have 500g rice, 2 tomatoes → need 1kg rice, 3 more tomatoes)
2. **Filters recipes** (excludes fish, low sugar for diabetes)
3. **Checks weather** (monsoon → tomatoes +30% price, spoil in 3 days → buy less, use quickly)
4. **Checks traffic** (Keells route blocked → buy from Cargills instead)
5. **Checks crisis** (flood warning → buy extra rice/dhal now for 3 days)
6. **Checks schedules** (Nisha busy 6–10 AM →assign dinner to Raj tonight)
7. **Produces shopping list** (organized by store + optimized for cheapest total + weather/traffic/crisis-aware)

**The Vision:** Replace manual, fragmented grocery planning with **AI that knows your home, family, schedule, weather, traffic, and crises** → then plans meals + shopping **automatically**.

**Core Value Proposition:**
- **Hyper-Personalization:** Knows home groceries + family preferences + dietary restrictions + schedules
- **Speed:** Meal plan → shopping list in <3 minutes (vs. 30+ minutes manual)
- **Savings:** 20–30% cost reduction by optimizing store combinations + weather/traffic/crisis awareness
- **Food Waste Reduction:** 35% less waste by checking home inventory + weather spoilage rates
- **Safety:** Crisis-aware (flood/storm alerts → buy food early, don't get stranded)
- **Convenience:** Cooking assignment + timing decisions (who cooks today + when to decide lunch/dinner)

***

## **02 Problem Statement**

**Sri Lanka's family grocery planning is broken on 10+ dimensions:**

### **The Core Pain Points:**

| # | Pain Point | Impact |
|---|------------|--------|
| **1** | **No home inventory tracking** | Families overbuy (already have 500g rice at home → buy 1kg more → waste 500g) |
| **2** | **No family preference memory** | Nisha: no fish, diabetic → buys fish curry anyway → wastes LKR 450 |
| **3** | **No dietary restriction filtering** | Raj: shellfish allergy → family buys shellfish → emergency hospital visit (LKR 50,000) |
| **4** | **No weather awareness** | Monsoon → tomatoes spoil in 3 days → buy 5 tomatoes → waste 3 (LKR 120) |
| **5** | **No traffic awareness** | Keells route blocked → drive 2 hours → waste time + fuel (LKR 500) |
| **6** | **No crisis awareness** | Flood warning → don't buy food → stranded 3 days without groceries |
| **7** | **No schedule integration** | Nisha busy 6–10 AM → assign dinner to her → she's stressed, late, family hungry |
| **8** | **No cooking assignment** | "Who cooks today?" → argument → no one cooks → order takeout (LKR 1,200) |
| **9** | **No meal timing decisions** | "When to decide lunch?" → 11 AM → too late → no time to cook → takeout |
| **10** | **No price comparison** | Rice LKR 120 @ Keells vs. LKR 115 @ Cargills → waste LKR 5/kg |

### **The Manual, Fragmented Process (Current Reality):**
```
"What should we cook this week?" 
→ Memory/habit (no home inventory check) → Overbuy rice (already have 500g) 
→ Buy fish (Nisha: no fish, diabetic) → Waste LKR 450 
→ Buy tomatoes (monsoon → spoil in 3 days) → Waste 3/5 (LKR 120) 
→ Drive to Keells (route blocked → 2 hours) → Waste LKR 500 fuel 
→ No flood warning → stranded 3 days without food 
→ "Who cooks today?" → Argument → Takeout (LKR 1,200) 
→ Total: LKR 6,500 + 2 hours stress + 3-day food insecurity
```

**Result:** Families spend LKR 15,000–30,000/month on groceries but:
- **Waste 35%** on overbought perishables + home inventory duplicates
- **Miss 20–30%** savings from store optimization
- **Waste 2+ hours/week** on traffic + arguments + takeout
- **Face food insecurity** during crises (floods, storms, strikes)

***

## **03 Target Users**

### **Primary Users**
**Budget-conscious families (households with 3–6 members) at SME/middle income (LKR 50,000–150,000/month household income)**
- Shop across multiple stores weekly (Keells + Cargills + pola)
- Have dietary restrictions (diabetes, hypertension, vegetarian, allergies)
- Overbuy perishables, waste food, stressed by schedules + crises

### **Secondary Users**
**Meal planners / Home cooks (mostly women, 25–55 years)**
- Decide weekly meals for family
- Want recipe ideas tied to budget + preferences + schedules
- Need cooking assignment + timing decisions

### **Persona Example**
**"Nisha, 38, mother of 3 in Colombo"**
- **Diabetic, no fish**
- **Work:** 6–10 AM (busy mornings)
- **Family:** Raj (husband, 9–6 PM office, eats meat), Kids (school 8–3 PM, no spicy, love egg)
- **Home inventory:** 500g rice, 2 tomatoes, 1kg dhal
- **Query:** *"Plan 5 dinners, LKR 5,000, diabetic-friendly, no fish, monsoon this week"*
- **Expected:** Recipes that exclude fish + low sugar + use home inventory (500g rice, 2 tomatoes) + weather-aware (tomatoes spoil fast → buy less) + schedule-aware (Nisha busy mornings → assign dinner to Raj)
- **Outcome:** 
  ```
  "Cook: Dhal + Rice (use 500g home rice + 500g new), Vegetable Fry (use 2 home tomatoes + 3 new), Egg Curry (kids love egg), Lentil Soup (diabetic-friendly), Chicken Curry (Raj eats meat)
   
   Home inventory used: 500g rice, 2 tomatoes → save LKR 180
   
   Weather: Monsoon → tomatoes spoil in 3 days → buy 3, not 5 → save LKR 80
   
   Traffic: Keells route blocked → buy from Cargills → save LKR 200 fuel
   
   Crisis: No flood warning → normal shopping
   
   Schedule: Nisha busy 6–10 AM → assign dinner tonight to Raj
   
   Cooking: Raj cooks today (he has 6–8 PM free) ✓
   
   Total: LKR 4,670 (saves LKR 330 vs. LKR 5,000 budget + LKR 180 home inventory + LKR 80 weather + LKR 200 traffic = LKR 440 total savings)"
  ```

***

## **04 Key Goals and Success Metrics**

| Goal | Metric | Target | 12h MVP Target |
|------|--------|--------|----------------|
| **Hyper-Personalization** | RAG memory of home groceries + family preferences + dietary restrictions | 100% queries use home inventory + preferences | Home inventory + 3 preferences |
| **Speed** | Time to meal plan + shopping list | <3 minutes | <10 minutes |
| **Savings** | Cost reduction vs. single-store shopping + home inventory | 20–30% + home inventory savings | 15% + home inventory |
| **Food Waste** | Perishable overbuying reduction + weather spoilage awareness | 35% less waste | 20% less waste |
| **Safety** | Crisis-aware shopping (flood/storm alerts) | 100% crisis queries addressed | 1 crisis scenario |
| **Convenience** | Cooking assignment + timing decisions accuracy | 95% correct assignments | 1 cooking assignment |
| **Adoption** | Queries per user/week | 10+ (weekly meal planning) | 4+ demo queries |
| **Cost** | Per-query expense | <$0.05 | <$0.15 (weather + traffic APIs) |

***

## **05 Intelligence Domains — Family Grocery OS Capabilities**

plango AI v2.0 answers grocery planning questions across **8 intelligence domains**. **For 12h: Focus on 5 domains minimum** (Price Comparison + Meal Planning + Store Optimization + Home Inventory + Dietary Preferences recommended).

| Domain | Capabilities | Example Query | 12h Priority |
|--------|--------------|---------------|--------------|
| **Home Inventory** | RAG memory of groceries at home (rice, tomatoes, fish, dhal) | *"What do I already have at home?"* | ✅✅ **HIGH** |
| **Family Preferences** | Each member's preferences (Nisha: no fish, Raj: meat, Kids: egg) | *"What does Nisha eat?"* | ✅✅ **HIGH** |
| **Dietary Restrictions** | Allergies + health restrictions (diabetes, hypertension, vegetarian, shellfish) | *"Diabetic-friendly, no shellfish"* | ✅✅ **HIGH** |
| **Weather Awareness** | Weather API → spoilage rates + price changes + meal suggestions | *"Monsoon this week → what meals?"* | ✅✅ **HIGH** |
| **Traffic Awareness** | Traffic API → route optimization + store alternatives | *"Keells route blocked → where?"* | ✅✅ **HIGH** |
| **Crisis Awareness** | Crisis feeds → flood/storm alerts → buy food early | *"Flood warning → buy now?"* | ✅ **MEDIUM** |
| **Schedule Integration** | Family schedules → meal timing + cooking assignment | *"Who cooks today + has time?"* | ✅ **MEDIUM** |
| **Price Comparison** | Real-time ingredient prices across Keells/Cargills/Arpico/pola | *"How much is rice at Keells vs Cargills?"* | ✅✅ **HIGH** |

***

## **06 Agent Architecture — Detailed Specifications (8 Agents Total)**

### **Required Agents (8 Total for Full Product, 5–6 for 12h MVP)**

For 12h: Build **5–6 distinct agents** with clear responsibilities. Each agent should be a separate class/module with typed inputs/outputs.

***

### **Agent 1: Home Inventory RAG Agent (NEW)**

**Role:** Maintains RAG memory of groceries at home (inventory tracking)

**Responsibilities:**
- Store home inventory: rice, tomatoes, fish, dhal, onions, spices, etc.
- Retrieve inventory on meal planning query
- Update inventory after shopping (subtract purchased items)
- Output: **Home inventory breakdown with usage recommendations**

**RAG Schema:**
```json
{
  "inventory_id": "string",
  "family_id": "string",
  "groceries": [
    {
      "item": "string (e.g., 'rice')",
      "quantity": "string (e.g., '500g')",
      "unit": "string (e.g., 'grams')",
      "expiry_days": "number (e.g., 30 for rice)",
      "last_added": "ISO8601"
    }
  ],
  "total_value_lkr": "number",
  "suggested_use_recipes": ["string (recipes using these items)"]
}
```

**Example Output:**
```json
{
  "inventory_id": "home_inv_001",
  "family_id": "nisha_family",
  "groceries": [
    {"item": "rice", "quantity": "500g", "unit": "grams", "expiry_days": 30, "last_added": "2026-06-15T10:00:00Z"},
    {"item": "tomatoes", "quantity": "2", "unit": "pieces", "expiry_days": 3, "last_added": "2026-06-18T14:00:00Z"},
    {"item": "dhal", "quantity": "1kg", "unit": "kilograms", "expiry_days": 60, "last_added": "2026-06-10T09:00:00Z"}
  ],
  "total_value_lkr": 380,
  "suggested_use_recipes": ["Dhal + Rice", "Vegetable Fry", "Tomato Sambol"]
}
```

**12h Scope:** Store **5–10 core items** (rice, tomatoes, dhal, onions, fish, eggs, spices, oil, flour, sugar)

**User Interaction:**
```
User: "What do I already have at home?"
→ System: "Home inventory: 500g rice, 2 tomatoes, 1kg dhal, 4 onions, 200g fish (expires 2 days)
           Total value: LKR 380
           Suggested recipes: Dhal + Rice, Vegetable Fry, Tomato Sambol"
```

***

### **Agent 2: Family Preferences RAG Agent (NEW)**

**Role:** Maintains RAG memory of each family member's preferences

**Responsibilities:**
- Store preferences per member: Nisha (no fish, diabetic), Raj (meat, no allergies), Kids (no spicy, love egg)
- Retrieve preferences on recipe filtering
- Output: **Family preference breakdown with recipe filters**

**RAG Schema:**
```json
{
  "preferences_id": "string",
  "family_id": "string",
  "members": [
    {
      "name": "string",
      "age": "number",
      "preferences": ["string (e.g., 'no fish', 'meat', 'no spicy')"],
      "allergies": ["string (e.g., 'shellfish')"],
      "dietary_restrictions": ["string (e.g., 'diabetes', 'hypertension')"],
      "favorite_ingredients": ["string (e.g., 'egg', 'chicken')"],
      "schedule": {
        "work_hours": "string (e.g., '6–10 AM')",
        "free_hours": "string (e.g., '6–8 PM')",
        "cooking_availability": "boolean"
      }
    }
  ]
}
```

**Example Output:**
```json
{
  "preferences_id": "family_pref_001",
  "family_id": "nisha_family",
  "members": [
    {
      "name": "Nisha",
      "age": 38,
      "preferences": ["no fish", "diabetic-friendly"],
      "allergies": [],
      "dietary_restrictions": ["diabetes"],
      "favorite_ingredients": ["dhal", "vegetables"],
      "schedule": {
        "work_hours": "6–10 AM",
        "free_hours": "10–6 PM, 8–10 PM",
        "cooking_availability": true
      }
    },
    {
      "name": "Raj",
      "age": 42,
      "preferences": ["meat", "no allergies"],
      "allergies": [],
      "dietary_restrictions": [],
      "favorite_ingredients": ["chicken", "fish"],
      "schedule": {
        "work_hours": "9–6 PM",
        "free_hours": "6–8 PM",
        "cooking_availability": true
      }
    },
    {
      "name": "Kids",
      "age": 10,
      "preferences": ["no spicy", "love egg"],
      "allergies": [],
      "dietary_restrictions": [],
      "favorite_ingredients": ["egg", "chicken"],
      "schedule": {
        "work_hours": "School 8–3 PM",
        "free_hours": "3–8 PM",
        "cooking_availability": false
      }
    }
  ]
}
```

**12h Scope:** Store **3 family members** (Nisha, Raj, Kids) with preferences + allergies + schedules

**User Interaction:**
```
User: "What does Nisha eat?"
→ System: "Nisha: no fish, diabetic-friendly, loves dhal + vegetables
           Avoid: fish curry, sweet desserts (high sugar)
           Recommended: Dhal + Rice, Vegetable Fry, Lentil Soup"
```

***

### **Agent 3: Weather Awareness Agent (NEW)**

**Role:** Fetches weather API data → suggests meals + spoilage rates + price changes

**Responsibilities:**
- Fetch weather data from OpenWeatherMap API (monsoon, rain, temperature)
- Calculate spoilage rates (tomatoes spoil in 3 days during monsoon vs. 7 days normal)
- Predict price changes (monsoon → tomatoes +30%)
- Suggest meals (monsoon → quick-cook meals, hot soups)
- Output: **Weather-aware meal recommendations + spoilage alerts**

**Weather API Integration:**
| API Endpoint | What It Provides | 12h Scope |
|--------------|---------------|-----------|
| **OpenWeatherMap Current** | Rain, temperature, monsoon alert | ✅ Current weather + monsoon |
| **OpenWeatherMap Forecast** | 7-day forecast (rain days) | ✅ 3-day forecast |
| **Spoilage Rate Calculator** | Item spoilage vs. weather | ✅ Tomatoes + onions |

**12h Scope:** Use **OpenWeatherMap free API** + implement **tomato spoilage calculator**

**Output Schema:**
```json
{
  "weather_id": "string",
  "location": "string (e.g., 'Colombo')",
  "current_weather": {
    "condition": "string (e.g., 'monsoon', 'rain', 'sunny')",
    "temperature_celsius": "number",
    "rain_mm": "number"
  },
  "forecast_3_days": [
    {
      "date": "ISO8601",
      "condition": "string",
      "rain_mm": "number"
    }
  ],
  "spoilage_rates": [
    {
      "item": "string",
      "normal_expiry_days": "number",
      "weather_expiry_days": "number",
      "warning": "string"
    }
  ],
  "price_changes": [
    {
      "item": "string",
      "normal_price_lkr": "number",
      "weather_price_lkr": "number",
      "change_percentage": "number"
    }
  ],
  "meal_suggestions": ["string (weather-appropriate recipes)"]
}
```

**Example Output:**
```json
{
  "weather_id": "weather_001",
  "location": "Colombo",
  "current_weather": {
    "condition": "monsoon",
    "temperature_celsius": 28,
    "rain_mm": 15
  },
  "forecast_3_days": [
    {"date": "2026-06-21", "condition": "rain", "rain_mm": 20},
    {"date": "2026-06-22", "condition": "rain", "rain_mm": 18},
    {"date": "2026-06-23", "condition": "cloudy", "rain_mm": 5}
  ],
  "spoilage_rates": [
    {
      "item": "tomatoes",
      "normal_expiry_days": 7,
      "weather_expiry_days": 3,
      "warning": "Tomatoes spoil in 3 days during monsoon → buy less, use quickly"
    },
    {
      "item": "onions",
      "normal_expiry_days": 14,
      "weather_expiry_days": 7,
      "warning": "Onions spoil in 7 days during monsoon → store dry"
    }
  ],
  "price_changes": [
    {
      "item": "tomatoes",
      "normal_price_lkr": 80,
      "weather_price_lkr": 104,
      "change_percentage": 30
    }
  ],
  "meal_suggestions": ["Hot Lentil Soup", "Quick-cook Vegetable Fry", "Rice + Dhal (fast)"]
}
```

**User Interaction:**
```
User: "Monsoon this week → what meals?"
→ System: "Monsoon alert: Rain 3 days, tomatoes spoil in 3 days (not 7), tomatoes +30% price
           Suggested meals: Hot Lentil Soup, Quick-cook Vegetable Fry, Rice + Dhal
           Buy: 3 tomatoes (not 5) → save LKR 80 + avoid waste"
```

***

### **Agent 4: Traffic Awareness Agent (NEW)**

**Role:** Fetches traffic API data → optimizes shopping route + suggests store alternatives

**Responsibilities:**
- Fetch traffic data from Google Maps API (route blocked, congestion)
- Calculate optimal shopping route (minimize distance/time)
- Suggest store alternatives (Keells route blocked → Cargills instead)
- Output: **Traffic-aware shopping route + store alternatives**

**Traffic API Integration:**
| API Endpoint | What It Provides | 12h Scope |
|--------------|---------------|-----------|
| **Google Maps Routes** | Route distance + time + congestion | ✅ 1 route (home → Keells) |
| **Google Maps Alternatives** | Alternative routes/stores | ✅ 1 alternative (Cargills) |

**12h Scope:** Use **Google Maps free tier** OR **simulate traffic data** (for demo)

**Output Schema:**
```json
{
  "traffic_id": "string",
  "origin": "string (e.g., 'home Ratmalana')",
  "destination": "string (e.g., 'Keells Colombo 7')",
  "route_status": {
    "blocked": "boolean",
    "congestion_level": "string (low | medium | high)",
    "estimated_time_minutes": "number",
    "estimated_distance_km": "number"
  },
  "alternative_stores": [
    {
      "store": "string",
      "distance_km": "number",
      "time_minutes": "number",
      "savings_lkr": "number (fuel saved)"
    }
  ],
  "recommended_store": "string",
  "total_savings_lkr": "number"
}
```

**Example Output:**
```json
{
  "traffic_id": "traffic_001",
  "origin": "home Ratmalana",
  "destination": "Keells Colombo 7",
  "route_status": {
    "blocked": true,
    "congestion_level": "high",
    "estimated_time_minutes": 120,
    "estimated_distance_km": 45
  },
  "alternative_stores": [
    {
      "store": "Cargills Battaramulla",
      "distance_km": 15,
      "time_minutes": 25,
      "savings_lkr": 200
    }
  ],
  "recommended_store": "Cargills Battaramulla",
  "total_savings_lkr": 200
}
```

**User Interaction:**
```
User: "Keells route blocked → where?"
→ System: "Traffic alert: Keells Colombo 7 route blocked (120 min, 45km)
           Alternative: Cargills Battaramulla (25 min, 15km) → save LKR 200 fuel
           Recommended: Buy from Cargills instead"
```

***

### **Agent 5: Crisis Awareness Agent (NEW)**

**Role:** Fetches crisis feeds → flood/storm alerts → suggests early shopping

**Responsibilities:**
- Fetch crisis data from Government Alert API / NewsAPI (flood, storm, strike)
- Detect crisis severity (low/medium/high)
- Suggest early shopping (flood warning → buy 3 days of food now)
- Output: **Crisis alert + early shopping recommendation**

**Crisis API Integration:**
| API Endpoint | What It Provides | 12h Scope |
|--------------|---------------|-----------|
| **NewsAPI Crisis** | Flood/storm/storm alerts | ✅ 1 crisis scenario (flood) |
| **Government Alerts** | Official crisis warnings | ✅ Simulate for demo |

**12h Scope:** **Simulate 1 crisis scenario** (flood warning) for demo

**Output Schema:**
```json
{
  "crisis_id": "string",
  "crisis_type": "string (flood | storm | strike)",
  "severity": "string (low | medium | high)",
  "affected_areas": ["string"],
  "expected_duration_days": "number",
  "shopping_recommendation": {
    "action": "string (e.g., 'buy 3 days food now')",
    "items": ["string (rice, dhal, canned food)"],
    "urgency": "string (immediate | tomorrow | normal)"
  }
}
```

**Example Output:**
```json
{
  "crisis_id": "crisis_001",
  "crisis_type": "flood",
  "severity": "high",
  "affected_areas": ["Colombo", "Battaramulla", "Ratmalana"],
  "expected_duration_days": 3,
  "shopping_recommendation": {
    "action": "buy 3 days food now",
    "items": ["rice 2kg", "dhal 1kg", "canned food 3", "water 6L"],
    "urgency": "immediate"
  }
}
```

**User Interaction:**
```
User: "Flood warning → buy now?"
→ System: "CRISIS ALERT: High-severity flood in Colombo/Battaramulla/Ratmalana for 3 days
           Action: Buy 3 days of food NOW (immediate)
           Essential items: Rice 2kg, Dhal 1kg, Canned food 3, Water 6L
           Don't wait → shops may close, roads may block"
```

***

### **Agent 6: Schedule Integration Agent (NEW)**

**Role:** Tracks family schedules → meal timing decisions + cooking assignment

**Responsibilities:**
- Store family schedules (Nisha: 6–10 AM work, Raj: 9–6 PM office, Kids: school 8–3 PM)
- Detect meal timing (when to decide coffee/lunch/dinner based on schedules)
- Assign cooking (who cooks today + does that person have time?)
- Output: **Cooking assignment + meal timing recommendations**

**12h Scope:** Store **3 family schedules** + implement **1 cooking assignment logic**

**Output Schema:**
```json
{
  "schedule_id": "string",
  "family_id": "string",
  "members": [
    {
      "name": "string",
      "work_hours": "string",
      "free_hours": "string",
      "cooking_availability": "boolean",
      "cooking_skill": "string (low | medium | high)"
    }
  ],
  "meal_timing": {
    "coffee_decision_time": "string (e.g., '5 AM')",
    "lunch_decision_time": "string (e.g., '10 AM')",
    "dinner_decision_time": "string (e.g., '5 PM')"
  },
  "cooking_assignment": {
    "today_cook": "string",
    "reason": "string (e.g., 'Raj free 6–8 PM, cooking skill high')",
    "meal": "string"
  }
}
```

**Example Output:**
```json
{
  "schedule_id": "schedule_001",
  "family_id": "nisha_family",
  "members": [
    {
      "name": "Nisha",
      "work_hours": "6–10 AM",
      "free_hours": "10–6 PM, 8–10 PM",
      "cooking_availability": true,
      "cooking_skill": "high"
    },
    {
      "name": "Raj",
      "work_hours": "9–6 PM",
      "free_hours": "6–8 PM",
      "cooking_availability": true,
      "cooking_skill": "medium"
    },
    {
      "name": "Kids",
      "work_hours": "School 8–3 PM",
      "free_hours": "3–8 PM",
      "cooking_availability": false,
      "cooking_skill": "low"
    }
  ],
  "meal_timing": {
    "coffee_decision_time": "5 AM",
    "lunch_decision_time": "10 AM",
    "dinner_decision_time": "5 PM"
  },
  "cooking_assignment": {
    "today_cook": "Raj",
    "reason": "Raj free 6–8 PM, cooking skill medium, Nisha busy 6–10 AM",
    "meal": "Dinner (Dhal + Rice, Vegetable Fry)"
  }
}
```

**User Interaction:**
```
User: "Who cooks today + has time?"
→ System: "Cooking assignment: Raj cooks dinner today
           Reason: Raj free 6–8 PM (after office), cooking skill medium
           Nisha busy 6–10 AM (work), Kids at school 8–3 PM
           Decision time: Decide dinner at 5 PM (Raj home by 6 PM)"
```

***

### **Agent 7: Market Research Agent (Price Scraping)**

**Role:** Scrapes and indexes current ingredient prices from supermarket catalogs + pola databases

*(Same as original Agent 1 — see previous PRD for full specs)*

***

### **Agent 8: Meal Planning Agent**

**Role:** Generates recipe suggestions based on budget, family size, dietary preferences, home inventory, weather

**Responsibilities (Enhanced):**
- Take user query: *"Plan 5 dinners for family of 4, LKR 5,000, no fish, diabetic, monsoon"*
- **Check home inventory** (Agent 1: you have 500g rice, 2 tomatoes → need 500g more rice, 3 more tomatoes)
- **Check family preferences** (Agent 2: Nisha no fish, Raj meat, Kids egg)
- **Check dietary restrictions** (Agent 2: Nisha diabetic → low sugar)
- **Check weather** (Agent 3: monsoon → tomatoes spoil in 3 days, +30% price → buy less, quick-cook meals)
- Retrieve recipes from knowledge base (filtered by preferences + dietary + weather)
- Match recipes to budget constraint
- Output: **Ranked recipe list with home inventory usage + weather-aware cost breakdown**

**12h Scope:** Integrate **home inventory + 3 preferences + weather** into recipe filtering

***

### **Agent 9: Store Optimization Agent**

**Role:** Determines best store combination for cheapest total basket + traffic-aware + crisis-aware

**Responsibilities (Enhanced):**
- Compare ingredient prices across stores (from Market Research Agent)
- **Check traffic** (Agent 4: Keells route blocked → Cargills instead)
- **Check crisis** (Agent 5: flood warning → buy extra rice/dhal now)
- Calculate optimal store per item
- Output: **Ranked shopping list organized by store + traffic/crisis-aware savings**

***

### **Agent 10: Quantity Planning Agent**

**Role:** Calculates exact quantities needed for family + **weather spoilage awareness**

**Responsibilities (Enhanced):**
- Take recipe + family size + eating frequency + **weather**
- **Check weather spoilage** (Agent 3: tomatoes spoil in 3 days monsoon → buy 3, not 5)
- Calculate exact quantities needed
- Output: **Quantity breakdown with weather-aware waste reduction estimate**

***

### **Agent 11: Dietary Preferences Agent**

**Role:** Filters recipes based on dietary restrictions, allergies, preferences *(Same as original Agent 6)*

***

### **Agent 12: Orchestration & Control Agent**

**Role:** Tracks loop state, handles intent detection, manages handoffs between all agents *(Same as original Agent 5)*

***

## **07 Features and Requirements (Updated)**

### **NEW Feature 10: Home Inventory RAG**

**What It Does:** Tracks groceries at home to prevent overbuying

**Dynamic Artifact:**
```
🏠 Home Inventory — Prevent 35% Overbuying

| Item | Quantity at Home | Expiry Days | Suggested Use |
|------|----------------|-------------|---------------|
| Rice | 500g | 30 | Dhal + Rice |
| Tomatoes | 2 | 3 (monsoon) | Vegetable Fry |
| Dhal | 1kg | 60 | Dhal + Rice |
| Onions | 4 | 7 (monsoon) | Curry, Sambol |
| Fish | 200g | 2 | Fish Curry (use today!) |

**Total Value:** LKR 380
**Recipes Using Home Inventory:** Dhal + Rice, Vegetable Fry, Tomato Sambol
**Action:** Buy 500g rice more (not 1kg), 3 tomatoes (not 5) → save LKR 180
```

***

### **NEW Feature 11: Family Preferences RAG**

**What It Does:** Filters recipes based on each member's preferences + allergies + dietary restrictions

**Dynamic Artifact:**
```
👨‍👩‍👧‍👦 Family Preferences — Personalized for Each Member

| Member | Preferences | Allergies | Dietary | Favorite |
|--------|-------------|-----------|---------|----------|
| Nisha | no fish | — | diabetic | dhal, veg |
| Raj | meat | — | — | chicken, fish |
| Kids | no spicy | — | — | egg, chicken |

**Filtered Recipes:**
- ✅ Dhal + Rice (Nisha: diabetic, no fish ✓)
- ✅ Vegetable Fry (Kids: no spicy ✓)
- ✅ Egg Curry (Kids: love egg ✓)
- ✅ Lentil Soup (Nisha: diabetic ✓)
- ✅ Chicken Curry (Raj: meat ✓)
- ❌ Fish Curry (Nisha: no fish ✗)
- ❌ Sweet Desserts (Nisha: diabetic ✗)
```

***

### **NEW Feature 12: Weather Awareness**

**What It Does:** Weather API → spoilage rates + price changes + meal suggestions

**Dynamic Artifact:**
```
🌦️ Weather Alert — Monsoon This Week

**Current:** Monsoon, 28°C, 15mm rain
**Forecast:** Rain 3 days (Jun 21–23), cloudy Jun 24

**Spoilage Rates:**
| Item | Normal Expiry | Monsoon Expiry | Warning |
|------|--------------|----------------|---------|
| Tomatoes | 7 days | 3 days | Buy 3, not 5 |
| Onions | 14 days | 7 days | Store dry |

**Price Changes:**
| Item | Normal Price | Monsoon Price | Change |
|------|-------------|---------------|--------|
| Tomatoes | LKR 80/kg | LKR 104/kg | +30% |

**Meal Suggestions:** Hot Lentil Soup, Quick-cook Vegetable Fry, Rice + Dhal
**Action:** Buy 3 tomatoes (not 5) → save LKR 80 + avoid waste
```

***

### **NEW Feature 13: Traffic Awareness**

**What It Does:** Traffic API → route optimization + store alternatives

**Dynamic Artifact:**
```
🚗 Traffic Alert — Keells Route Blocked

**Route:** Home Ratmalana → Keells Colombo 7
**Status:** BLOCKED (120 min, 45km, high congestion)

**Alternative:** Cargills Battaramulla (25 min, 15km)
**Savings:** LKR 200 fuel + 95 min time

**Recommended:** Buy from Cargills instead
```

***

### **NEW Feature 14: Crisis Awareness**

**What It Does:** Crisis feeds → flood/storm alerts → early shopping

**Dynamic Artifact:**
```
⚠️ CRISIS ALERT — High-Severity Flood

**Type:** Flood
**Severity:** HIGH
**Affected:** Colombo, Battaramulla, Ratmalana
**Duration:** 3 days

**Action:** Buy 3 days of food NOW (immediate)
**Essential Items:** Rice 2kg, Dhal 1kg, Canned food 3, Water 6L
**Warning:** Don't wait → shops may close, roads may block
```

***

### **NEW Feature 15: Schedule Integration + Cooking Assignment**

**What It Does:** Family schedules → meal timing + cooking assignment

**Dynamic Artifact:**
```
📅 Schedule + Cooking — Who Cooks Today?

**Family Schedules:**
| Member | Work Hours | Free Hours | Cooking |
|--------|-----------|------------|---------|
| Nisha | 6–10 AM | 10–6 PM, 8–10 PM | Yes (high) |
| Raj | 9–6 PM | 6–8 PM | Yes (medium) |
| Kids | School 8–3 PM | 3–8 PM | No (low) |

**Meal Timing:**
- Coffee: Decide at 5 AM
- Lunch: Decide at 10 AM
- Dinner: Decide at 5 PM

**Cooking Assignment:**
- **Today:** Raj cooks dinner
- **Reason:** Raj free 6–8 PM (after office), cooking skill medium
- **Nisha:** Busy 6–10 AM (work)
- **Kids:** At school 8–3 PM
- **Meal:** Dhal + Rice, Vegetable Fry
```

***

## **08 Updated 12-Hour Timeline (with 6 Core Agents)**

| Time | Milestone | Deliverable | Agents |
|------|-----------|-------------|--------|
| **0:00–0:30** | Kickoff + team setup | Repo created, 6 agents planned | — |
| **0:30–1:00** | **Home Inventory RAG Agent** | Agent 1 working (5–10 items) | Agent 1 |
| **1:00–1:30** | **Family Preferences RAG Agent** | Agent 2 working (3 members) | Agent 2 |
| **1:30–2:00** | **Market Research Agent** + scraping | Agent 7 working (3 stores) | Agent 7 |
| **2:00–2:30** | **Meal Planning Agent** + inventory/weather/preferences | Agent 8 working | Agent 8 |
| **2:30–3:00** | **Weather Awareness Agent** + OpenWeatherMap | Agent 3 working | Agent 3 |
| **3:00–3:30** | **Traffic/Crisis/Schedule Agents** (simulate for demo) | Agents 4, 5, 6 working | Agents 4, 5, 6 |
| **3:30–4:00** | **Orchestration Agent** + intent | Agent 12 working | Agent 12 |
| **4:00–4:00** | **BREAK** | — | — |
| **4:00–5:00** | Streamlit interface + memory | Chat page ready | Feature 1 |
| **5:00–6:00** | Dynamic artifacts (8 total) | Inventory + preferences + weather + traffic + crisis + schedule + price grid + shopping list | Features 1–8, 10–15 |
| **6:00–7:00** | End-to-end demo flow | 6 queries (inventory → preferences → weather → meal plan → shopping list → cooking assignment) | All agents |
| **7:00–8:00** | Edge cases + polish | Handle failures | — |
| **8:00–9:00** | Demo script + slides | 5-min pitch | — |
| **9:00–12:00** | Final rehearsal + submission | Demo recorded, README done | — |

***

## **09 Updated MVP Checklist (with 6 Core Agents)**

| Requirement | Status |
|-------------|--------|
| ✅ 6 core agents (Home Inventory RAG + Family Preferences RAG + Market Research + Meal Planning + Weather + Orchestration) | ☐ |
| ✅ Traffic/Crisis/Schedule agents simulated for demo | ☐ |
| ✅ Home Inventory stores 5–10 items (rice, tomatoes, dhal, etc.) | ☐ |
| ✅ Family Preferences stores 3 members (Nisha, Raj, Kids) | ☐ |
| ✅ Weather Agent fetches OpenWeatherMap + spoilage calculator | ☐ |
| ✅ 8 dynamic artifacts (inventory + preferences + weather + traffic + crisis + schedule + price grid + shopping list) | ☐ |
| ✅ 6 demo queries (inventory → preferences → weather → meal plan → shopping list → cooking assignment) | ☐ |
| ✅ 5-minute demo script + slide deck | ☐ |
| ✅ Clean README | ☐ |

***

## **10 Final Product Positioning**

**plango AI v2.0:** *Sri Lanka's first AI that knows your home groceries, family preferences, schedule, weather, traffic, and crises — then plans meals + shopping automatically.*

**Key Differentiators:**
- **Not just meal planning** — Knows home inventory, family preferences, weather, traffic, crises, schedules
- **Not just price comparison** — Traffic-aware store alternatives, crisis-aware early shopping, weather-aware spoilage
- **Not just shopping list** — Cooking assignment + meal timing decisions (who cooks today + when to decide)

***

**Good luck. Build the 6 agents. Save Sri Lankan families LKR 2,000/month + 2 hours/week + prevent food crises.**

*plango.ai*


orchestrator - user  input prompt. few scenarios.  1. user already decided what to eat. 2. user needs suggests what to eat. 3. user goes to shopping tot buy. orchectrato rdecides what agents to run

prices catalog agent - prices accrosidn tot the above scenario. (if user already decided find prices of that product if not find prices of suitable all products). do price comapriosn.

Recipe compiler - give recepe suggestions according tot user prompt. + inventory RAG.

route optimizer - find tht ebest route according to the selected recepe. take news data. get traffic data

sensory decay - get whether data and decide at what time or day the suggested recepe products will get spoied 

dietary guard - einstruct on whether to continue witht the suggestion according tot user health and fitness patterns. (diet plans)

new agent for analyzing live news and identify possible crisis and give suggestions.
system works as user enters main query to tthe orchestrator. then user may decise tot eneter followups or not. For each time user eneter the main query or th efollow up orchestrator decised to which agents tot run. if not needed no agnetts would run. in a each sttset of the prompt  user should be able to see all statues of angets outptuts.