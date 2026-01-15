import OpenAI from 'openai';
import { z } from 'zod';
import crypto from 'crypto';
import { identifyBundles, suggestComplementaryProducts } from './product-bundler';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
});

// Cache for deterministic results - stores hash of input -> result
const aiResultCache = new Map<string, AIAnalysisResult>();

// Input normalization for consistent hashing
function normalizeInput(text: string): string {
  return text
    .replace(/[^\w\s]/g, '') // Remove all punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim()
    .toLowerCase();
}

// Rule-based keyword extraction (100% deterministic)
interface KeywordPattern {
  label: string;
  patterns: RegExp[];
  weight: number;
}

const KEYWORD_PATTERNS: KeywordPattern[] = [
  // Main container products - highest priority
  {
    label: 'container',
    patterns: [/container/gi, /shipping\s+container/gi, /storage\s+container/gi],
    weight: 12  // Highest weight for main container mentions
  },
  {
    label: 'adu',
    patterns: [/\badu\b/gi, /backyard\s+rental/gi, /guest\s+house/gi, /tiny\s+home/gi, /accessory\s+dwelling/gi],
    weight: 10  // High weight for ADU products
  },
  {
    label: '20ft',
    patterns: [/20[\s-]?ft/gi, /20[\s-]?foot/gi, /twenty[\s-]?foot/gi, /20'/gi],
    weight: 10  // High weight for specific container sizes
  },
  {
    label: '40ft',
    patterns: [/40[\s-]?ft/gi, /40[\s-]?foot/gi, /forty[\s-]?foot/gi, /40'/gi],
    weight: 10  // High weight for specific container sizes
  },
  {
    label: '53ft',
    patterns: [/53[\s-]?ft/gi, /53[\s-]?foot/gi, /fifty[\s-]?three[\s-]?foot/gi, /53'/gi],
    weight: 10  // High weight for specific container sizes
  },
  {
    label: 'office',
    patterns: [/office\s+container/gi, /mobile\s+office/gi, /container\s+office/gi, /workspace/gi],
    weight: 9  // High weight for office containers
  },
  {
    label: 'kitchen',
    patterns: [/kitchen/gi, /commercial\s+kitchen/gi, /food\s+prep/gi, /cooking\s+area/gi],
    weight: 8  // Good weight for kitchen containers
  },
  {
    label: 'bathroom',
    patterns: [/bathroom/gi, /restroom/gi, /bath\s+container/gi, /washroom/gi],
    weight: 8  // Good weight for bathroom containers
  },
  {
    label: 'studio',
    patterns: [/studio/gi, /efficiency/gi, /single\s+room/gi],
    weight: 9  // High weight for studio units
  },
  // Add-ons and upgrades - lower priority
  {
    label: 'rooftop_deck',
    patterns: [/rooftop.*deck/gi, /deck.*rooftop/gi, /roof\s+deck/gi],
    weight: 6  // Moderate weight for add-ons
  },
  {
    label: 'upgrade',
    patterns: [/upgrade/gi, /premium/gi, /finish/gi, /interior\s+upgrade/gi],
    weight: 4  // Lower weight for upgrades
  },
  {
    label: 'onsite',
    patterns: [/on[\s-]?site/gi, /site\s+work/gi, /site\s+assessment/gi, /tx\s+onsite/gi],
    weight: 4
  },
  {
    label: 'consultation',
    patterns: [/consultation/gi, /design\s+call/gi, /design\s+consultation/gi],
    weight: 3  // Lower weight for consultations
  },
  // Off-grid and solar features
  {
    label: 'offgrid',
    patterns: [/off[\s-]?grid/gi, /self[\s-]?sufficient/gi, /standalone/gi, /remote\s+living/gi],
    weight: 10  // High weight for off-grid solutions
  },
  {
    label: 'solar',
    patterns: [/solar/gi, /photovoltaic/gi, /pv\s+system/gi, /solar\s+pre[\s-]?wir/gi, /solar\s+panel/gi],
    weight: 9  // High weight for solar features
  },
  {
    label: 'composting',
    patterns: [/compost/gi, /composting\s+toilet/gi, /eco\s+toilet/gi, /waterless\s+toilet/gi],
    weight: 8  // Good weight for composting toilets
  },
  {
    label: 'insulation',
    patterns: [/insulation/gi, /spray\s+foam/gi, /r[\s-]?value/gi, /thermal/gi, /weatheriz/gi],
    weight: 7  // Moderate-high weight for insulation
  },
  {
    label: 'electrical',
    patterns: [/electrical/gi, /wiring/gi, /pre[\s-]?wir/gi, /power\s+system/gi, /outlets/gi],
    weight: 6  // Moderate weight for electrical
  },
  {
    label: 'water',
    patterns: [/water\s+tank/gi, /water\s+storage/gi, /grey\s+water/gi, /black\s+water/gi, /plumbing/gi],
    weight: 6  // Moderate weight for water systems
  },
  {
    label: 'battery',
    patterns: [/battery/gi, /energy\s+storage/gi, /power\s+bank/gi, /backup\s+power/gi],
    weight: 7  // Good weight for battery storage
  },
  {
    label: 'foundation',
    patterns: [/foundation/gi, /concrete\s+pad/gi, /slab/gi, /footer/gi, /pier/gi],
    weight: 5  // Moderate weight for foundation
  },
  {
    label: 'permit',
    patterns: [/permit/gi, /travis\s+county/gi, /code\s+compliant/gi, /zoning/gi, /regulatory/gi],
    weight: 3  // Lower weight for permits (informational)
  },
  {
    label: 'timeline',
    patterns: [/before\s+summer/gi, /asap/gi, /urgent/gi, /rush/gi, /expedite/gi, /timeline/gi],
    weight: 2  // Low weight but important for urgency
  },
  {
    label: 'gate',
    patterns: [/\d+[\s-]?ft\s+gate/gi, /gate\s+access/gi, /narrow\s+access/gi, /modular/gi],
    weight: 4  // Moderate weight for access constraints
  }
];

function extractKeywords(conversation: string): Set<string> {
  const normalized = normalizeInput(conversation);
  const keywords = new Set<string>();
  
  for (const pattern of KEYWORD_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(normalized)) {
        keywords.add(pattern.label);
        break; // Found match for this pattern, move to next
      }
    }
  }
  
  return keywords;
}

// Product scoring system
interface ScoredProduct {
  id: string;
  name: string;
  unitPrice: number;
  score: number;
}

function scoreProduct(
  product: {id: string; name: string; unitPrice: number},
  keywords: Set<string>
): number {
  let score = 0;
  const productNameLower = product.name.toLowerCase();
  
  // Check each keyword pattern
  for (const pattern of KEYWORD_PATTERNS) {
    if (!keywords.has(pattern.label)) continue;
    
    // Award points for matching keywords in product name
    switch(pattern.label) {
      case 'container':
        if (productNameLower.includes('container') || 
            productNameLower.includes('unit')) {
          score += pattern.weight * 2;
        }
        break;
      case 'adu':
        if (productNameLower.includes('adu') || 
            productNameLower.includes('studio') ||
            productNameLower.includes('alpine')) {
          score += pattern.weight * 2;
        }
        break;
      case '20ft':
        if (productNameLower.includes('20')) {
          score += pattern.weight * 2;
        }
        break;
      case '40ft':
        if (productNameLower.includes('40')) {
          score += pattern.weight * 2;
        }
        break;
      case '53ft':
        if (productNameLower.includes('53')) {
          score += pattern.weight * 2;
        }
        break;
      case 'office':
        if (productNameLower.includes('office')) {
          score += pattern.weight * 2;
        }
        break;
      case 'kitchen':
        if (productNameLower.includes('kitchen')) {
          score += pattern.weight * 2;
        }
        break;
      case 'bathroom':
        if (productNameLower.includes('bathroom') || 
            productNameLower.includes('restroom')) {
          score += pattern.weight * 2;
        }
        break;
      case 'studio':
        if (productNameLower.includes('studio')) {
          score += pattern.weight * 2;
        }
        break;
      case 'rooftop_deck':
        if (productNameLower.includes('rooftop') && productNameLower.includes('deck')) {
          score += pattern.weight * 2;
        }
        break;
      case 'upgrade':
        if (productNameLower.includes('upgrade') && productNameLower.includes('interior')) {
          score += pattern.weight * 2;
        }
        break;
      case 'onsite':
        if (productNameLower.includes('onsite') || productNameLower.includes('tx onsite')) {
          score += pattern.weight * 2;
        }
        break;
      case 'consultation':
        if (productNameLower.includes('consultation') || productNameLower.includes('design call')) {
          score += pattern.weight * 2;
        }
        break;
      case 'offgrid':
        if (productNameLower.includes('off-grid') || productNameLower.includes('offgrid') ||
            productNameLower.includes('standalone') || productNameLower.includes('self-sufficient')) {
          score += pattern.weight * 2;
        }
        break;
      case 'solar':
        if (productNameLower.includes('solar') || productNameLower.includes('photovoltaic') ||
            productNameLower.includes('pv ')) {
          score += pattern.weight * 2;
        }
        break;
      case 'composting':
        if (productNameLower.includes('compost') || productNameLower.includes('eco toilet') ||
            productNameLower.includes('waterless')) {
          score += pattern.weight * 2;
        }
        break;
      case 'insulation':
        if (productNameLower.includes('insulation') || productNameLower.includes('spray foam') ||
            productNameLower.includes('r6.5') || productNameLower.includes('thermal')) {
          score += pattern.weight * 2;
        }
        break;
      case 'electrical':
        if (productNameLower.includes('electrical') || productNameLower.includes('wiring') ||
            productNameLower.includes('pre-wir') || productNameLower.includes('prewir')) {
          score += pattern.weight * 2;
        }
        break;
      case 'water':
        if (productNameLower.includes('water') || productNameLower.includes('tank') ||
            productNameLower.includes('plumbing')) {
          score += pattern.weight * 2;
        }
        break;
      case 'battery':
        if (productNameLower.includes('battery') || productNameLower.includes('energy storage') ||
            productNameLower.includes('power bank')) {
          score += pattern.weight * 2;
        }
        break;
      case 'foundation':
        if (productNameLower.includes('foundation') || productNameLower.includes('concrete') ||
            productNameLower.includes('slab') || productNameLower.includes('pier')) {
          score += pattern.weight * 2;
        }
        break;
      case 'permit':
        if (productNameLower.includes('permit') || productNameLower.includes('travis county') ||
            productNameLower.includes('regulatory')) {
          score += pattern.weight * 2;
        }
        break;
      case 'timeline':
        if (productNameLower.includes('expedite') || productNameLower.includes('rush') ||
            productNameLower.includes('priority')) {
          score += pattern.weight * 2;
        }
        break;
      case 'gate':
        if (productNameLower.includes('modular') || productNameLower.includes('narrow access') ||
            productNameLower.includes('split')) {
          score += pattern.weight * 2;
        }
        break;
    }
  }
  
  return score;
}

// Deterministic product selection with multi-level tiebreakers
function selectBestProducts(
  scoredProducts: ScoredProduct[],
  keywords: Set<string>
): ScoredProduct[] {
  // Filter to only products with positive scores
  const candidates = scoredProducts.filter(p => p.score > 0);
  
  if (candidates.length === 0) {
    return [];
  }
  
  // Sort by: score (desc) → price (asc) → name (asc) → id (asc)
  candidates.sort((a, b) => {
    // 1. Higher score wins
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    // 2. Lower price wins
    if (a.unitPrice !== b.unitPrice) {
      return a.unitPrice - b.unitPrice;
    }
    // 3. Alphabetical by name
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }
    // 4. Alphabetical by ID (final tiebreaker)
    return a.id.localeCompare(b.id);
  });
  
  return candidates;
}

export interface ProductMatch {
  productId: string;
  productName: string;
  quantity: number;
  confidence: number;
  evidence: string;
  unitPrice?: number;
  reasoning?: string;
}

export interface AIAnalysisResult {
  requirements: string[];
  recommendedProducts: string[];
  matchedProducts: ProductMatch[];
  estimatedBudget?: string;
  timeline?: string;
  additionalNotes?: string;
  reasoningSteps?: string[];
  unmatchedNeeds?: string[];
  bundles?: Array<{
    name: string;
    description: string;
    products: Array<{productId: string; productName: string; quantity: number}>;
    totalPrice: number;
    savings: number;
  }>;
  complementaryProducts?: Array<{
    productId: string;
    productName: string;
    reason: string;
  }>;
}

// Strict JSON Schema for AI responses
const AIResponseSchema = z.object({
  requirements: z.array(z.string()).describe("Extracted customer requirements"),
  reasoningSteps: z.array(z.string()).describe("Step-by-step reasoning for product selection"),
  matchedProducts: z.array(z.object({
    productId: z.string().describe("Exact UUID from catalog"),
    productName: z.string().describe("Exact name from catalog"),
    quantity: z.number().int().min(1).describe("Quantity needed"),
    unitPrice: z.number().describe("Price in cents"),
    evidence: z.string().describe("Quote from conversation supporting this selection"),
    reasoning: z.string().describe("Why this product matches the requirement"),
    confidence: z.number().min(0).max(1).describe("Confidence score 0-1")
  })),
  unmatchedNeeds: z.array(z.string()).optional().describe("Requirements that couldn't be matched to products"),
  estimatedBudget: z.string().nullable().optional(),
  timeline: z.string().nullable().optional(),
  additionalNotes: z.string().nullable().optional()
});

// Create product index for faster lookup
function createProductIndex(products: Array<{id: string; name: string; unitPrice: number}>) {
  const index: Record<string, any> = {};
  const synonymMap: Record<string, string[]> = {
    'adu': ['accessory dwelling unit', 'backyard unit', 'rental unit', 'granny flat'],
    'office': ['workspace', 'work space', 'office container', 'mobile office'],
    'bathroom': ['restroom', 'bath', 'toilet', 'washroom'],
    'kitchen': ['kitchenette', 'cooking area', 'food prep'],
    'studio': ['1br', 'one bedroom', 'single room', 'efficiency'],
    '20ft': ['20 ft', '20-ft', '20 foot', '20-foot', 'twenty foot'],
    '40ft': ['40 ft', '40-ft', '40 foot', '40-foot', 'forty foot'],
    '53ft': ['53 ft', '53-ft', '53 foot', '53-foot', 'fifty three foot']
  };
  
  products.forEach(p => {
    index[p.id] = {
      ...p,
      nameLower: p.name.toLowerCase(),
      keywords: extractProductKeywords(p.name)
    };
  });
  
  return { index, synonymMap };
}

function extractProductKeywords(name: string): string[] {
  const keywords = name.toLowerCase().split(/[\s-]+/);
  return keywords.filter(k => k.length > 2);
}

export async function analyzeConversation(
  conversationNotes: string,
  customerName: string,
  products?: Array<{id: string; name: string; unitPrice: number}>
): Promise<AIAnalysisResult> {
  try {
    if (!products || products.length === 0) {
      throw new Error('No product catalog available');
    }

    // Normalize inputs for consistent hashing
    const normalizedConversation = normalizeInput(conversationNotes);
    const normalizedCustomer = normalizeInput(customerName);
    
    // Create a deterministic hash of the normalized input
    const inputHash = crypto
      .createHash('sha256')
      .update(normalizedConversation)
      .update(normalizedCustomer)
      .digest('hex');
    
    // Check cache first
    if (aiResultCache.has(inputHash)) {
      console.log('🎯 Using cached result for identical input');
      return aiResultCache.get(inputHash)!;
    }

    // PHASE 1: Rule-based keyword extraction (100% deterministic)
    const keywords = extractKeywords(conversationNotes);
    console.log('📝 Extracted keywords:', Array.from(keywords));
    
    // PHASE 2: Score all products based on keywords
    const scoredProducts: ScoredProduct[] = products.map(p => ({
      ...p,
      score: scoreProduct(p, keywords)
    }));
    
    // PHASE 3: Select best products using deterministic tiebreakers
    const selectedProducts = selectBestProducts(scoredProducts, keywords);
    console.log(`🏆 Top scoring products: ${selectedProducts.slice(0, 5).map(p => `${p.name} (score: ${p.score})`).join(', ')}`);
    
    // PHASE 4: Simplified AI parsing for quantities and context
    const { index: productIndex, synonymMap } = createProductIndex(products);
    
    // Format products in a structured way
    const productCatalog = products.map(p => 
      `ID: ${p.id}\nName: ${p.name}\nPrice: $${(p.unitPrice / 100).toFixed(2)}`
    ).join('\n---\n');

    // Build matched products from scoring system
    const preSelectedProducts = selectedProducts.slice(0, 10).map(p => ({
      productId: p.id,
      productName: p.name,
      quantity: 1, // Default, will be adjusted by AI
      unitPrice: p.unitPrice,
      score: p.score
    }));

    const systemPrompt = `You are a deterministic quantity parser for Bob's Containers.

ALREADY SELECTED PRODUCTS (by scoring system):
${preSelectedProducts.map(p => `- ${p.productName} (ID: ${p.productId}, Score: ${p.score})`).join('\n')}

YOUR TASKS:
1. Determine QUANTITIES for the pre-selected products
2. Identify which selected products to actually include based on conversation
3. Extract any timeline or budget mentioned

QUANTITY RULES:
- "two" or "2" → quantity: 2
- "a couple" → quantity: 2
- "a few" → quantity: 3
- "several" → quantity: 4
- No mention → quantity: 1

CONTEXT RULES:
- "discussing X vs Y" → This is comparison, NOT a purchase request
- Only include products that are explicitly requested or clearly needed
- If customer just "discussed" or "compared" something, don't include it

You will respond with ONLY valid JSON matching the exact schema provided.`;

    const userPrompt = `PRODUCT CATALOG (${products.length} products):
${productCatalog}

CUSTOMER: ${customerName}
CONVERSATION NOTES:
${conversationNotes}

TASK: Analyze this conversation and match to exact products with perfect accuracy.

IMPORTANT: When the conversation mentions "discussing 20-ft versus multi-container homes", this is a COMPARISON, not a request for both products. Only select what the customer actually DECIDED on or REQUESTED, not what they discussed as options.

Step 1: Extract ONLY the ACTUAL requirements (not comparison points)
Step 2: For EACH requirement, use the EXACT PRODUCT SELECTION RULES above
Step 3: Always use quantity 1 unless a number is explicitly stated
Step 4: Validate all product IDs exist in the catalog
Step 5: For the EXACT phrase "small backyard rental unit", ALWAYS choose the FIRST product alphabetically that contains "ADU" or "Studio" in the name

Return a JSON response with this EXACT structure:
{
  "requirements": [list each requirement found],
  "reasoningSteps": [explain your logic for each product selection],
  "matchedProducts": [
    {
      "productId": "exact UUID from catalog",
      "productName": "exact name from catalog",
      "quantity": number,
      "unitPrice": price in cents,
      "evidence": "exact quote from conversation",
      "reasoning": "why this product matches the requirement",
      "confidence": 0.0-1.0
    }
  ],
  "unmatchedNeeds": [any requirements you couldn't match],
  "estimatedBudget": "budget if mentioned or null",
  "timeline": "timeline if mentioned or null",
  "additionalNotes": "special requests or null"
}`;

    // Build the final matched products from scoring system
    const matchedProducts: ProductMatch[] = [];
    
    // Use scoring system results directly
    if (selectedProducts.length > 0) {
      // Extract requirements from conversation
      const requirements: string[] = [];
      if (keywords.has('container')) requirements.push('shipping container');
      if (keywords.has('adu')) requirements.push('small backyard rental unit');
      if (keywords.has('20ft')) requirements.push('20-ft container');
      if (keywords.has('40ft')) requirements.push('40-ft container');
      if (keywords.has('53ft')) requirements.push('53-ft container');
      if (keywords.has('office')) requirements.push('office container');
      if (keywords.has('kitchen')) requirements.push('kitchen container');
      if (keywords.has('bathroom')) requirements.push('bathroom facilities');
      if (keywords.has('studio')) requirements.push('studio unit');
      if (keywords.has('offgrid')) requirements.push('off-grid setup');
      if (keywords.has('solar')) requirements.push('solar pre-wiring/panels');
      if (keywords.has('composting')) requirements.push('composting toilet');
      if (keywords.has('insulation')) requirements.push('upgraded insulation');
      if (keywords.has('electrical')) requirements.push('electrical system');
      if (keywords.has('water')) requirements.push('water storage/plumbing');
      if (keywords.has('battery')) requirements.push('battery storage system');
      if (keywords.has('foundation')) requirements.push('foundation/concrete pad');
      if (keywords.has('rooftop_deck')) requirements.push('rooftop deck');
      if (keywords.has('upgrade')) requirements.push('upgraded finishes');
      if (keywords.has('onsite')) requirements.push('site assessment');
      if (keywords.has('consultation')) requirements.push('design call');
      if (keywords.has('permit')) requirements.push('permitting assistance');
      if (keywords.has('timeline')) requirements.push('expedited delivery');
      if (keywords.has('gate')) requirements.push('modular/narrow access build');
      
      // Map scored products to matched products
      // Limit to top 5 highest scoring products to avoid including too many items
      const topProducts = selectedProducts
        .filter(p => p.score >= 6)  // Increased minimum score threshold to be more selective
        .slice(0, 5);  // Take only the top 5 products
      
      for (const product of topProducts) {
        matchedProducts.push({
          productId: product.id,
          productName: product.name,
          quantity: 1,  // Default quantity
          unitPrice: product.unitPrice,
          confidence: Math.min(1.0, product.score / 10),  // Convert score to confidence
          evidence: `Matched based on keywords: ${Array.from(keywords).join(', ')}`,
          reasoning: `Product scored ${product.score} points based on keyword matching`
        });
      }
      
      // Identify potential bundles
      const bundles = identifyBundles(keywords, products);
      
      // Suggest complementary products
      const selectedIds = matchedProducts.map(m => m.productId);
      const complementary = suggestComplementaryProducts(selectedIds, products);
      
      // Cache and return result
      const result: AIAnalysisResult = {
        requirements,
        recommendedProducts: [],
        matchedProducts,
        estimatedBudget: undefined,
        timeline: undefined,
        additionalNotes: `Selected using deterministic scoring system`,
        reasoningSteps: [`Extracted keywords: ${Array.from(keywords).join(', ')}`, 
                        `Top products by score: ${selectedProducts.slice(0, 3).map(p => `${p.name} (${p.score})`).join(', ')}`],
        unmatchedNeeds: undefined,
        bundles: bundles.length > 0 ? bundles.map(b => ({
          name: b.name,
          description: b.description,
          products: b.products,
          totalPrice: b.totalPrice,
          savings: b.savings
        })) : undefined,
        complementaryProducts: complementary.length > 0 ? complementary.map(c => ({
          productId: c.productId,
          productName: c.productName,
          reason: c.reason
        })) : undefined
      };
      
      // Cache the result
      aiResultCache.set(inputHash, result);
      console.log(`💾 Cached result for hash: ${inputHash.substring(0, 8)}...`);
      
      return result;
    }
    
    // Fallback if no products matched - return empty result
    console.log('⚠️ No products matched via scoring, returning empty proposal');
    
    const fallbackResult: AIAnalysisResult = {
      requirements: ['No clear product requirements identified'],
      recommendedProducts: [],
      matchedProducts: [],
      estimatedBudget: undefined,
      timeline: undefined,
      additionalNotes: 'Unable to identify specific products from the conversation',
      reasoningSteps: ['No keywords matched our product patterns'],
      unmatchedNeeds: ['Please provide more specific product requirements']
    };
    
    // Cache the fallback result
    aiResultCache.set(inputHash, fallbackResult);
    console.log(`💾 Cached fallback result for hash: ${inputHash.substring(0, 8)}...`);
    
    return fallbackResult;
  } catch (error) {
    console.error('AI analysis error:', error);
    // More informative fallback
    return {
      requirements: ['Unable to parse conversation - manual review required'],
      recommendedProducts: [],
      matchedProducts: [],
      estimatedBudget: undefined,
      timeline: undefined,
      additionalNotes: `AI analysis error: ${error instanceof Error ? error.message : 'Unknown error'}. Please review manually.`,
      unmatchedNeeds: ['All requirements need manual matching due to AI error']
    };
  }
}

// Helper function to validate product existence
export function validateProductExists(productId: string, products: Array<{id: string; name: string; unitPrice: number}>): boolean {
  return products.some(p => p.id === productId);
}

// Helper function for deterministic product lookup
export function getProductById(productId: string, products: Array<{id: string; name: string; unitPrice: number}>) {
  return products.find(p => p.id === productId);
}
