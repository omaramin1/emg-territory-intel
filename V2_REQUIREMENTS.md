# Territory Intelligence Engine — V2 Requirements
## Owner: Omar Amin | Updated: 2026-03-21

## WORKFLOW
1. User opens map → picks UTILITY (Dominion, BGE, Pepco, etc.)
2. Targets auto-populate for that utility territory
3. Targets ranked by LOOKALIKE FIT to actual enrolled customer areas
4. Each target = shift-sized canvass zone (few blocks, ~200 doors, 8hr shift)
5. User picks targets → texts links to leads → reps canvass → data updates

## RANKING ALGORITHM (what determines target priority)
1. **Lookalike fit** to enrolled customer demographics (income, EH%, housing type, own/rent)
2. **kWh priority** — higher electric usage areas rank higher (bigger bills = easier close)
3. **Electric heat %** — direct proxy for kWh consumption
4. **Close rate history** — areas where reps already closed well rank higher
5. **Recency gap** — areas not canvassed recently rank higher
6. **Saturation headroom** — areas with low enrollment-to-household ratio rank higher
7. **Rep-area fit** — certain reps perform better in certain neighborhoods

## DATA REQUIREMENTS (must be real, verified Census ACS)
- Housing structure: B25024 (SFH, townhome, apartment, mobile home %)
- Heating fuel: B25040 (electric heat %)
- Income: B19013 (median household income)  
- Poverty: B17001 (poverty rate for LMI qualification)
- Employment: B23025 (unemployment, daytime home proxy)
- Home value: B25077 (median home value)
- Rent burden: B25071 (rent as % of income)
- All at TRACT level, aggregated from BLOCK GROUP where available

## PIN TYPES (each shows its OWN data, not ZIP-level)
- 🏚 Trailer Park — mobile home %, est. units, EH%, nearest utility
- 🏢 Apartment Zone — apartment %, est. units, MDU enrollment eligibility
- 🏘 Townhome Zone — townhome %, door density, walkability proxy
- 🔥 Electric Heat Zone — EH%, est. monthly bill, kWh proxy
- ⚡ Combo zones — multiple signals (EH + mobile, EH + apartment, etc.)

## MARKETS
- VA: Dominion Energy (active, 30K+ sales, strongest data)
- MD: BGE, Pepco, Potomac Edison, Delmarva (active, 19K sales)
- NY: Central Hudson, National Grid, ORU, RGE, NYSEG (active, 102K sales)
- DC: Pepco (active, small)
- DE: Delmarva Power (new market, LMI self-attestation, payment collection)

## KNOWN ISSUES TO FIX
- VA/unified map has JS errors (renderPriorityPanel null reference)
- DE has no GeoJSON boundary files, housing targets have lat=0
- MD old data has no payable status (all NULL campaign records)
- Maps start blank — need default overlay
- Reco panel still shows old ZIP-based code on some pages
- Housing target popups show ZIP data instead of tract-level data
- 30K VA sales pins cause slow load — need deferred loading
