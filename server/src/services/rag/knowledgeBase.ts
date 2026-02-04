/**
 * Knowledge Base - Pre-built knowledge about Portuguese real estate
 * This data is indexed into the RAG system for context-aware responses
 */

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export const PORTUGAL_REAL_ESTATE_KNOWLEDGE: KnowledgeDocument[] = [
  // Buying Process
  {
    id: "buying-process-overview",
    title: "Buying Property in Portugal - Overview",
    content: `The process of buying property in Portugal typically involves these steps:
1. Get a NIF (Número de Identificação Fiscal) - Portuguese tax number required for any financial transaction
2. Open a Portuguese bank account (recommended but not required)
3. Find a property through agents, websites, or direct search
4. Make an offer and negotiate the price
5. Sign a Promissory Contract (CPCV) with a deposit (usually 10-20%)
6. Due diligence: verify property registration, debts, licenses
7. Sign the final deed (Escritura) at a notary
8. Register the property at the Land Registry (Conservatória)
9. Pay taxes: IMT (transfer tax) and Stamp Duty`,
    category: "buying-process",
    tags: ["buying", "process", "steps", "how-to", "purchase"],
  },
  {
    id: "nif-tax-number",
    title: "NIF - Portuguese Tax Number",
    content: `The NIF (Número de Identificação Fiscal) is essential for buying property in Portugal.
- EU citizens can apply directly at any Tax Office (Finanças)
- Non-EU citizens need a fiscal representative (can be a lawyer or accountant)
- Required documents: passport, proof of address
- Can be obtained in person or through a representative
- Cost: Free if done in person, €100-300 through a representative
- Processing time: Usually immediate if in person, 1-2 weeks through representative`,
    category: "buying-process",
    tags: ["nif", "tax", "documents", "requirements"],
  },
  {
    id: "imt-transfer-tax",
    title: "IMT - Property Transfer Tax",
    content: `IMT (Imposto Municipal sobre Transmissões) is the main tax when buying property in Portugal.
Rates for residential property (mainland Portugal):
- Up to €97,064: 0%
- €97,064 - €132,774: 2%
- €132,774 - €181,034: 5%
- €181,034 - €301,688: 7%
- €301,688 - €578,598: 8%
- €578,598 - €1,050,400: 6% (single rate)
- Over €1,050,400: 7.5%
Rural land: 5% flat rate
Note: Rates are lower for permanent residence and higher for second homes.
IMT must be paid before signing the deed.`,
    category: "taxes",
    tags: ["imt", "tax", "transfer", "costs", "rates"],
  },
  {
    id: "stamp-duty",
    title: "Stamp Duty (Imposto de Selo)",
    content: `Stamp Duty is an additional tax when buying property in Portugal.
- Rate: 0.8% of the property value or tax value (whichever is higher)
- Paid together with IMT before the deed
- Also applies to mortgage contracts (0.6% on the loan amount)
- No exemptions for first-time buyers
Example: For a €100,000 property, stamp duty = €800`,
    category: "taxes",
    tags: ["stamp", "duty", "tax", "costs"],
  },
  {
    id: "regions-algarve",
    title: "Algarve Region - Property Guide",
    content: `The Algarve is Portugal's southernmost region, famous for tourism and expat communities.
Popular areas:
- Lagos: Historic town, great beaches, mid-range prices
- Albufeira: Tourist hub, lots of amenities, higher prices
- Tavira: Quieter, traditional, good value
- Faro: Regional capital, airport, more local feel
- Vilamoura: Luxury marina, golf, premium prices
Property types: Apartments, villas, townhouses, golf properties
Price range: €150,000-500,000 for apartments, €300,000-2M+ for villas
Climate: 300+ sunny days, mild winters, hot summers
Considerations: Tourist-heavy, seasonal rentals potential, international community`,
    category: "regions",
    tags: ["algarve", "south", "coast", "beach", "tourism", "lagos", "albufeira", "tavira", "faro"],
  },
  {
    id: "regions-lisbon",
    title: "Lisbon Region - Property Guide",
    content: `Lisbon is Portugal's capital and largest city, with diverse property options.
Popular areas:
- Lisbon City: Historic neighborhoods, apartments, €3,000-8,000/sqm
- Cascais: Upscale coastal town, €4,000-10,000/sqm
- Sintra: UNESCO heritage, palaces, nature, €2,500-5,000/sqm
- Setúbal Peninsula: More affordable, beaches, €1,500-3,000/sqm
- Mafra/Torres Vedras: Rural, affordable, €1,000-2,000/sqm
Property types: Apartments (most common), townhouses, villas, rural estates
Investment potential: Strong rental market, Airbnb popular
Considerations: Higher prices, traffic, excellent infrastructure`,
    category: "regions",
    tags: ["lisbon", "capital", "city", "cascais", "sintra", "urban"],
  },
  {
    id: "regions-alentejo",
    title: "Alentejo Region - Property Guide",
    content: `Alentejo is Portugal's largest region, known for rural landscapes and affordable property.
Popular areas:
- Évora: UNESCO city, cultural hub
- Beja: Agricultural, very affordable
- Alentejo Coast: Unspoiled beaches, growing popularity
- Comporta: Upscale coastal area, celebrities, premium prices
Property types: Farms (herdades), rural houses (montes), land, ruins for renovation
Price range: €50,000-200,000 for rural properties, land from €5,000/hectare
Climate: Hot summers (40°C+), cold winters, low rainfall
Considerations: Remote, limited services, great for self-sufficiency, agriculture`,
    category: "regions",
    tags: ["alentejo", "rural", "farm", "land", "affordable", "evora", "countryside"],
  },
  {
    id: "regions-porto-north",
    title: "Porto and Northern Portugal - Property Guide",
    content: `Northern Portugal offers a different character from the south - greener, more traditional.
Popular areas:
- Porto City: Second largest city, UNESCO, €2,500-5,000/sqm
- Vila Nova de Gaia: Wine cellars, river views, slightly cheaper
- Braga: Historic, religious, growing tech hub
- Guimarães: Medieval, UNESCO, traditional
- Douro Valley: Wine region, river, tourism potential
- Minho: Green, rural, very affordable
Property types: City apartments, traditional stone houses, quintas (estates)
Price range: Generally 30-50% cheaper than Lisbon
Climate: Rainy, green, mild summers, cool winters
Considerations: Less English spoken, more authentic, good value`,
    category: "regions",
    tags: ["porto", "north", "douro", "braga", "traditional", "wine"],
  },
  {
    id: "regions-silver-coast",
    title: "Silver Coast - Property Guide",
    content: `The Silver Coast (Costa de Prata) stretches from Lisbon to Porto along the Atlantic.
Popular areas:
- Óbidos: Medieval walled town, charming, touristy
- Caldas da Rainha: Spa town, ceramics, affordable
- Nazaré: Giant waves, fishing village, tourism
- Leiria: Regional center, practical
- Figueira da Foz: Beach resort, casinos
- Aveiro: "Portuguese Venice", canals, university
Property types: Beach apartments, traditional houses, rural properties
Price range: €100,000-300,000 for most properties
Climate: Atlantic influence, cooler summers, mild winters, some fog
Considerations: Good value, authentic, less crowded, surfing`,
    category: "regions",
    tags: ["silver-coast", "central", "beach", "obidos", "nazare", "affordable"],
  },
  {
    id: "land-buying",
    title: "Buying Land in Portugal",
    content: `Land purchase in Portugal has specific considerations:
Types of land:
- Urban (Urbano): Designated for construction, more expensive
- Rural (Rústico): Agricultural use, harder to build on
- Mixed: Some construction rights on rural land

Building permissions:
- Urban land: Usually straightforward to build
- Rural land: Minimum plot sizes (often 5000+ sqm), may need special permits
- RAN/REN zones: Protected agricultural/ecological areas, very restricted

Price ranges:
- Urban plots (Algarve): €50-200/sqm
- Rural land (Alentejo): €1-10/sqm
- Rural land (Central): €3-20/sqm

Key checks:
- Verify caderneta predial (property registration)
- Check PDM (municipal development plan) for zoning
- Confirm access rights (servitude)
- Water and electricity availability
- Any existing structures or ruins`,
    category: "property-types",
    tags: ["land", "plot", "rural", "urban", "building", "construction", "terreno"],
  },
  {
    id: "construction-land-portugal",
    title: "Construction Land Laws in Portugal - Terreno para Construção",
    content: `IMPORTANT: Not all land in Portugal can be built on. Understanding land classification is critical.

LAND TYPES AND BUILDABILITY:

1. TERRENO URBANO (Urban Land) - CAN BUILD ✅
   - Officially classified for construction in municipal plans (PDM)
   - Listed as "urbano" in Caderneta Predial (property registry)
   - Has approved building parameters (height, area, usage)
   - Usually has or can get utilities (água, luz, saneamento)
   - Keywords in listings: "urbano", "para construção", "lote", "urbanizável"

2. TERRENO RÚSTICO (Rural/Rustic Land) - DIFFICULT TO BUILD ❌
   - Agricultural land, usually cannot build residential
   - Listed as "rústico" in Caderneta Predial
   - May only allow agricultural structures (barns, storage)
   - Exceptions: Very large plots (5000+ sqm) in some municipalities
   - Keywords: "rústico", "agrícola", "terreno agrícola"

3. MIXED/APTO PARA CONSTRUÇÃO (Mixed Use) - CAN BUILD WITH CONDITIONS ⚠️
   - Rural land with building rights
   - Often old "grandfathered" plots
   - Check PIP (Pedido de Informação Prévia) for exact allowances

CRITICAL DOCUMENTS TO CHECK:

📄 CADERNETA PREDIAL (Property Registry)
   - Shows if land is "urbano" or "rústico"
   - Get from Finanças (tax office)
   - If it says "urbano" → construction allowed

📄 PDM (Plano Director Municipal)
   - Municipal zoning plan
   - Defines what can be built where
   - Check at local Câmara Municipal (city hall)
   - Zones: residential, commercial, industrial, agricultural

📄 PIP (Pedido de Informação Prévia)
   - Pre-approval request to municipality
   - Confirms exactly what you can build
   - Cost: €50-200, takes 30-60 days
   - HIGHLY RECOMMENDED before buying

📄 ALVARÁ DE LOTEAMENTO
   - For plots in approved developments
   - Includes all specifications for building
   - Simplest option - everything pre-approved

WHAT TO LOOK FOR IN LISTINGS:

✅ GOOD SIGNS (can build):
- "Terreno urbano" - urban land
- "Lote de terreno" - building plot
- "Para construção" - for construction
- "Viabilidade de construção" - building viability
- "Projeto aprovado" - approved project
- "Com alvará" - with building permit
- "Índice de construção" - building index specified
- "Área de implantação" - footprint area specified

❌ WARNING SIGNS (may NOT be buildable):
- "Terreno rústico" - rural land (usually no building)
- "Terreno agrícola" - agricultural land
- "RAN" - National Agricultural Reserve (no building)
- "REN" - National Ecological Reserve (no building)
- "Área protegida" - protected area
- No mention of "urbano" or "construção"

BUILDING PERMIT PROCESS:
1. Projeto de Arquitetura - Architectural project
2. Submit to Câmara Municipal
3. Technical evaluation (60-120 days)
4. Pay license fee (taxa de licença)
5. Receive Alvará de Construção
6. Build within permit timeframe

COMMON MISTAKES:
- Buying "rústico" thinking you can build → you usually cannot
- Not checking PDM before purchase → may have restrictions
- Assuming ruins = building rights → not always
- Not verifying utilities access → expensive to connect

PRICE DIFFERENCE:
- Urban plots: €30-300/sqm (depending on location)
- Rural/rústico: €1-15/sqm (much cheaper but can't build)
- The price difference reflects buildability!`,
    category: "property-types",
    tags: ["construction", "land", "terreno", "urbano", "rustico", "building", "permit", "PDM", "construção", "lote", "plot"],
  },
  {
    id: "ruins-renovation",
    title: "Buying and Renovating Ruins in Portugal",
    content: `Ruins can be excellent value but require careful consideration:
Advantages:
- Low purchase price (€5,000-50,000 typical)
- Potential to create dream home
- Often come with land
- Authentic stone construction

Challenges:
- Renovation costs often exceed purchase price (budget €1,000-2,000/sqm)
- Permits can be complex and slow (6-18 months)
- May need architect and engineer
- Unexpected structural issues common
- Remote locations may lack utilities

Key considerations:
- Check if ruin has habitation license (more valuable)
- Verify building footprint can be maintained
- Ensure access to water and electricity
- Get structural assessment before purchase
- Budget 30% contingency for surprises

Popular areas for ruins: Alentejo, Central Portugal, Interior North`,
    category: "property-types",
    tags: ["ruins", "renovation", "restore", "reconstruction", "project"],
  },
  {
    id: "golden-visa",
    title: "Golden Visa Program",
    content: `Portugal's Golden Visa grants residency through investment.
Current investment options (2024+):
- €500,000 in investment funds
- €500,000 in qualifying company shares
- €250,000 in arts/culture (reduced from €500k)
- €500,000 in research activities
- Job creation (10 jobs minimum)

Note: Real estate investment NO LONGER qualifies for Golden Visa as of 2023.

Benefits:
- Residency permit for investor and family
- Free movement in Schengen area
- Path to permanent residency (5 years) and citizenship (5 years)
- Low presence requirement (7 days in year 1, 14 days in subsequent years)

For property buyers: Consider D7 visa (passive income visa) instead.`,
    category: "visas-residency",
    tags: ["golden-visa", "residency", "investment", "visa", "immigration"],
  },
  {
    id: "d7-visa",
    title: "D7 Passive Income Visa",
    content: `The D7 visa is popular for retirees and remote workers wanting to live in Portugal.
Requirements:
- Proof of regular passive income (pension, investments, rental income)
- Minimum income: Portuguese minimum wage (€820/month for 2024)
- Recommended: €1,500-2,000/month for comfortable approval
- Accommodation in Portugal (can be rental)
- Clean criminal record
- Health insurance

Process:
1. Apply at Portuguese consulate in home country
2. Receive temporary visa (4 months)
3. Travel to Portugal
4. Apply for residence permit at SEF/AIMA
5. Receive 2-year residence permit
6. Renew for 3 more years
7. Apply for permanent residency or citizenship after 5 years

Benefits:
- Path to citizenship
- Can work in Portugal
- Family reunification possible
- NHR tax benefits may apply`,
    category: "visas-residency",
    tags: ["d7", "visa", "passive-income", "retirement", "residency"],
  },
  {
    id: "nhr-tax-regime",
    title: "NHR - Non-Habitual Resident Tax Regime",
    content: `NHR offers significant tax benefits for new residents (program modified in 2024).
Original NHR (before 2024):
- 10 years of tax benefits
- 20% flat rate on Portuguese income from qualifying professions
- Potential exemption on foreign income
- Popular with retirees and digital nomads

New regime (2024+):
- NHR replaced with "Incentivized Tax Regime for Scientific Research and Innovation"
- More restrictive qualifying criteria
- Focus on researchers, academics, and innovation
- 20% flat rate on qualifying employment income
- 10-year duration

Existing NHR holders:
- Grandfathered under old rules
- Benefits continue for original 10-year period

Consult a tax advisor for current rules and eligibility.`,
    category: "taxes",
    tags: ["nhr", "tax", "non-habitual", "resident", "benefits"],
  },
  {
    id: "annual-property-taxes",
    title: "Annual Property Taxes (IMI)",
    content: `IMI (Imposto Municipal sobre Imóveis) is the annual property tax in Portugal.
Rates:
- Urban properties: 0.3% to 0.45% of tax value (VPT)
- Rural properties: 0.8% of tax value
- Rates set by each municipality

Tax value (VPT):
- Usually lower than market value
- Based on formulas considering size, age, location, quality
- Reassessed periodically

Payment:
- Due in April, May, or November (depending on amount)
- Can be paid in 2-3 installments if over €100/€500
- Penalties for late payment

Exemptions:
- Low-income households
- 3-year exemption for primary residence (under certain values)
- Rehabilitation projects may qualify

Example: €200,000 market value property might have €80,000 VPT = €320/year IMI at 0.4%`,
    category: "taxes",
    tags: ["imi", "annual", "tax", "property", "municipal"],
  },
  {
    id: "utilities-costs",
    title: "Utilities and Running Costs",
    content: `Typical monthly costs for property in Portugal:
Utilities:
- Electricity: €50-150/month (higher with AC/heating)
- Water: €20-40/month
- Gas (if piped): €20-50/month
- Internet/TV: €30-60/month
- Mobile phone: €15-30/month

Property costs:
- IMI (property tax): Varies, typically €200-1000/year
- Condominium fees (apartments): €30-100/month
- Home insurance: €100-300/year
- Maintenance reserve: Budget 1% of value/year

Tips for savings:
- Solar panels increasingly popular (good ROI)
- Bi-hourly electricity tariffs save money
- Well water for irrigation
- Good insulation reduces heating/cooling costs

Total monthly running costs:
- Small apartment: €150-250
- House: €200-400
- Large villa: €400-800+`,
    category: "costs",
    tags: ["utilities", "costs", "electricity", "water", "monthly", "running"],
  },
  {
    id: "lawyers-notaries",
    title: "Lawyers and Notaries in Portugal",
    content: `Professional help is recommended when buying property in Portugal.
Lawyers (Advogados):
- Not legally required but highly recommended
- Handle due diligence, contracts, negotiations
- Costs: €1,000-3,000 for standard purchase
- English-speaking lawyers available in main cities
- Can act as fiscal representative for NIF

Notaries (Notários):
- Required for final deed (Escritura)
- Government-regulated fees
- Verify identities, witness signing
- Costs: €300-800 for deed

Other professionals:
- Solicitors (Solicitadores): Lower cost alternative to lawyers
- Estate agents: Typically paid by seller (5% commission)
- Surveyors: Not common in Portugal, but recommended for old properties
- Translators: For documents and appointments

Recommendation: Always use a lawyer independent from the seller and agent.`,
    category: "buying-process",
    tags: ["lawyer", "notary", "legal", "professional", "advogado"],
  },
  {
    id: "mortgage-financing",
    title: "Mortgages and Financing",
    content: `Mortgages are available in Portugal for residents and non-residents.
For residents:
- Up to 90% LTV (loan-to-value)
- Lower interest rates
- Longer terms available (up to 40 years)

For non-residents:
- Typically 60-70% LTV
- Higher interest rates
- Maximum terms usually 25-30 years

Current rates (2024):
- Variable: Euribor + 0.8-1.5%
- Fixed: 3-4% (varies by term)

Requirements:
- Proof of income (3 years tax returns)
- Bank statements
- Property valuation
- Life insurance required
- Property insurance required

Banks offering mortgages to foreigners:
- Millennium BCP
- Novo Banco
- Santander
- BPI

Process: Allow 4-8 weeks for approval
Costs: Expect 2-3% of loan value in fees`,
    category: "financing",
    tags: ["mortgage", "loan", "bank", "financing", "credit"],
  },
  {
    id: "rental-income",
    title: "Rental Income and Regulations",
    content: `Renting out property in Portugal has specific rules and tax implications.
Long-term rentals (Arrendamento):
- Tenant protection laws apply
- Notice periods: 2-5 years depending on contract
- Rent increases limited to inflation coefficient
- Tax: 28% flat rate or progressive (depending on status)

Short-term/Tourist rentals (Alojamento Local):
- Registration required with local council
- Maximum 120 days in some areas (Lisbon, Porto)
- Safety requirements (fire extinguishers, etc.)
- Tax: 35% of gross income (simplified regime) or actual expenses

Gross yields:
- Lisbon: 3-5%
- Porto: 4-6%
- Algarve: 4-8% (seasonal)
- Rural: 2-4%

Costs to deduct:
- IMI, condominium, insurance
- Maintenance and repairs
- Agent fees
- Mortgage interest (if applicable)

Platform requirements:
- Airbnb, Booking.com require AL license number
- Tax reporting mandatory`,
    category: "investment",
    tags: ["rental", "income", "investment", "airbnb", "alojamento", "yield"],
  },
];

/**
 * Get all knowledge documents
 */
export function getAllKnowledge(): KnowledgeDocument[] {
  return PORTUGAL_REAL_ESTATE_KNOWLEDGE;
}

/**
 * Get knowledge by category
 */
export function getKnowledgeByCategory(category: string): KnowledgeDocument[] {
  return PORTUGAL_REAL_ESTATE_KNOWLEDGE.filter(doc => doc.category === category);
}

/**
 * Get knowledge by tags
 */
export function getKnowledgeByTags(tags: string[]): KnowledgeDocument[] {
  return PORTUGAL_REAL_ESTATE_KNOWLEDGE.filter(doc => 
    tags.some(tag => doc.tags.includes(tag.toLowerCase()))
  );
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  return [...new Set(PORTUGAL_REAL_ESTATE_KNOWLEDGE.map(doc => doc.category))];
}
