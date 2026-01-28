import OpenAI from 'openai';
import { z } from 'zod';
import crypto from 'crypto';
import { identifyBundles, suggestComplementaryProducts } from './product-bundler';

// AI Provider Configuration - Easily replaceable
// Supports: OpenAI, Google Gemini (via OpenAI compatibility layer)
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini'; // 'openai' or 'gemini'
const AI_API_KEY = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || 'AIzaSyBk4Jto0rkkTToDrQxICHruWD41S2158II'; // AIzaSyBv8FoWfT7DTVm9T9_GusoovxVOSFBLbu0
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
const AI_BASE_URL = process.env.AI_BASE_URL || (AI_PROVIDER === 'gemini' 
  ? 'https://generativelanguage.googleapis.com/v1beta/openai/' 
  : undefined);

const aiClient = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: AI_BASE_URL,
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
    label: 'high_cube',
    patterns: [/high\s+cube/gi, /high\s+cube\s+container/gi, /new\s+high\s+cube/gi],
    weight: 15  // Very high weight for high cube containers (more specific)
  },
  {
    label: 'new',
    patterns: [/\bnew\s+container/gi, /\bnew\s+20/gi, /\bnew\s+high/gi],
    weight: 8  // Good weight for "new" containers
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
      case 'high_cube':
        if (productNameLower.includes('high') && productNameLower.includes('cube')) {
          score += pattern.weight * 3; // Extra weight for high cube
        }
        break;
      case 'new':
        if (productNameLower.includes('new')) {
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
  customerName?: string;
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

    // Format products in a structured way for Gemini
    const productCatalog = products.map(p => 
      `ID: ${p.id}\nName: ${p.name}\nPrice: $${(p.unitPrice / 100).toFixed(2)}`
    ).join('\n---\n');

    // Direct prompt to Gemini - no keyword matching, let AI do all the work
    const systemPrompt = `You are an expert sales proposal generator for Bob's Containers. Your job is to analyze customer conversations and create accurate proposals by matching customer requests to products in the catalog.

CRITICAL RULES:
1. DISTINGUISH CUSTOMER REQUESTS FROM SALES OPTIONS:
   - When Sales lists products (e.g., "We have: Office, Kitchen, Bathroom..."), these are OPTIONS, NOT requests
   - Only include products the CUSTOMER explicitly requested or said they want
   - Look for customer phrases: "I want", "I need", "I would like", "I'll take", "I'll go with", "I would love"
   - If customer says "I would love X" or "I need X", that's the actual request
   - Ignore products that only appear in Sales' lists of available options

2. PRODUCT MATCHING:
   - Match the EXACT product the customer requested from the catalog
   - Use the product name from the catalog exactly (including exact spelling and format)
   - Match product IDs exactly as they appear in the catalog
   - If customer says "new high cube container", find the product with "New High Cube Container" in the name

3. QUANTITY EXTRACTION:
   - "two" or "2" → quantity: 2
   - "a couple" → quantity: 2
   - "a few" → quantity: 3
   - "several" → quantity: 4
   - "I need 2 containers" → quantity: 2
   - No mention → quantity: 1

4. CONTEXT UNDERSTANDING:
   - "discussing X vs Y" → This is comparison, NOT a purchase request
   - Only include products that are explicitly requested or clearly needed
   - If customer just "discussed" or "compared" something, don't include it
   - Sales listing options ≠ Customer requesting them

5. EXTRACT ADDITIONAL INFO:
   - Timeline: Extract delivery dates/timelines mentioned
   - Budget: Extract budget information if mentioned
   - Location: Note delivery location if mentioned
   - Customer Name: Extract the customer's actual name from the conversation (look for "my name is", "my name would be", "change my name to", etc.)

You will respond with ONLY valid JSON matching the exact schema provided.`;

    const userPrompt = `PRODUCT CATALOG (${products.length} products):
${productCatalog}

CUSTOMER: ${customerName}
CONVERSATION NOTES:
${conversationNotes}

TASK: Analyze this conversation and create a proposal by matching customer requests to products in the catalog.

INSTRUCTIONS:
1. Read the conversation carefully and identify what the CUSTOMER actually requested (not what Sales listed as options)
2. Match customer requests to products in the catalog using EXACT product names and IDs
3. Extract quantities, timeline, budget, and other relevant information
4. Only include products the customer explicitly requested

EXAMPLE:
- Sales: "We have: 20ft Office, 20ft Kitchen, 20ft Bathroom, 20ft New High Cube Container..."
- Customer: "I would love a new high cube container. I need 2 containers."
- CORRECT: Match "20ft New High Cube Container" with quantity: 2
- WRONG: Don't match Office, Kitchen, Bathroom (these were just options listed)

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
  "customerName": "extracted customer name from conversation or null",
  "additionalNotes": "special requests or null"
}`;

    // Check if LLM should be used (default: true if API key is available)
    const useLLM = process.env.USE_LLM !== 'false' && AI_API_KEY;
    
    let matchedProducts: ProductMatch[] = [];
    let aiAnalysisResult: any = null;

    // Always use Gemini directly - no keyword matching, let AI do all the work
    if (useLLM) {
      try {
        console.log(`🤖 Calling ${AI_PROVIDER.toUpperCase()} (${AI_MODEL}) to refine product selection...`);
        
        const response = await aiClient.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1, // Low temperature for consistency
          max_tokens: 2000
        });

        const aiResponseText = response.choices[0]?.message?.content;
        if (aiResponseText) {
          aiAnalysisResult = JSON.parse(aiResponseText);
          console.log(`✅ ${AI_PROVIDER.toUpperCase()} response received:`, JSON.stringify(aiAnalysisResult, null, 2));

          // Validate and map LLM response to our format
          if (aiAnalysisResult.matchedProducts && Array.isArray(aiAnalysisResult.matchedProducts)) {
            matchedProducts = aiAnalysisResult.matchedProducts
              .filter((p: any) => {
                // Validate product ID exists
                const productExists = products.some(prod => prod.id === p.productId);
                if (!productExists) {
                  console.warn(`⚠️ LLM suggested invalid product ID: ${p.productId}`);
                  return false;
                }
                return true;
              })
              .map((p: any) => {
                // Find the actual product to get correct price
                const actualProduct = products.find(prod => prod.id === p.productId);
                return {
                  productId: p.productId,
                  productName: p.productName || actualProduct?.name || 'Unknown',
                  quantity: Math.max(1, Math.floor(p.quantity || 1)),
                  unitPrice: p.unitPrice || actualProduct?.unitPrice || 0,
                  confidence: Math.min(1.0, Math.max(0.0, p.confidence || 0.5)),
                  evidence: p.evidence || 'Matched by LLM analysis',
                  reasoning: p.reasoning || 'LLM determined this product matches the requirement'
                } as ProductMatch;
              });
          }
        }
      } catch (llmError) {
        console.error('❌ LLM call failed, falling back to scoring system:', llmError);
        // Fall through to scoring system
      }
    }

    // If LLM returned results, use them
    if (matchedProducts.length > 0) {
      // Identify potential bundles (using empty keywords set since we're not using keyword matching)
      const bundles = identifyBundles(new Set(), products);
      
      // Suggest complementary products
      const selectedIds = matchedProducts.map(m => m.productId);
      const complementary = suggestComplementaryProducts(selectedIds, products);
      
      // Cache and return result
      const result: AIAnalysisResult = {
        requirements: aiAnalysisResult?.requirements || [],
        recommendedProducts: [],
        matchedProducts,
        estimatedBudget: aiAnalysisResult?.estimatedBudget || undefined,
        timeline: aiAnalysisResult?.timeline || undefined,
        customerName: aiAnalysisResult?.customerName || undefined, // Use name extracted by AI
        additionalNotes: aiAnalysisResult?.additionalNotes || `Selected using ${AI_PROVIDER.toUpperCase()}-enhanced analysis`,
        reasoningSteps: aiAnalysisResult?.reasoningSteps || [],
        unmatchedNeeds: aiAnalysisResult?.unmatchedNeeds || undefined,
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
    console.log('⚠️ No products matched by AI, returning empty proposal');
    
    const fallbackResult: AIAnalysisResult = {
      requirements: ['No clear product requirements identified'],
      recommendedProducts: [],
      matchedProducts: [],
      estimatedBudget: undefined,
      timeline: undefined,
      additionalNotes: 'Unable to identify specific products from the conversation. Please ensure Gemini API is configured and working.',
      reasoningSteps: ['AI analysis did not match any products'],
      unmatchedNeeds: ['Please provide more specific product requirements or check AI configuration']
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
