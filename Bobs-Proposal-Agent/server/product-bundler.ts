/**
 * Intelligent Product Bundling Engine
 * Identifies commonly purchased product combinations and suggests bundles
 */

export interface ProductBundle {
  name: string;
  description: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
  totalPrice: number;
  savings: number;
  confidence: number;
}

// Common bundle patterns based on customer purchase history
const BUNDLE_PATTERNS = [
  {
    name: "Off-Grid Living Package",
    trigger: ["offgrid", "solar", "remote"],
    requiredProducts: ["offgrid", "solar"],
    includedProducts: [
      { keywords: ["20ft", "container", "studio"], quantity: 1 },
      { keywords: ["solar", "pre-wir", "panel"], quantity: 1 },
      { keywords: ["composting", "toilet", "eco"], quantity: 1 },
      { keywords: ["battery", "storage", "power"], quantity: 1 },
      { keywords: ["water", "tank", "storage"], quantity: 1 },
      { keywords: ["insulation", "spray", "foam"], quantity: 1 }
    ],
    discount: 0.10 // 10% bundle discount for complete off-grid solution
  },
  {
    name: "Complete Office Setup",
    trigger: ["office", "workspace"],
    requiredProducts: ["container", "office"],
    includedProducts: [
      { keywords: ["office", "container"], quantity: 1 },
      { keywords: ["electrical", "upgrade"], quantity: 1 },
      { keywords: ["ac", "hvac", "climate"], quantity: 1 },
      { keywords: ["furniture", "desk"], quantity: 1 }
    ],
    discount: 0.05 // 5% bundle discount
  },
  {
    name: "ADU Living Package",
    trigger: ["adu", "rental", "backyard"],
    requiredProducts: ["adu", "studio"],
    includedProducts: [
      { keywords: ["adu", "studio", "alpine"], quantity: 1 },
      { keywords: ["interior", "upgrade", "finish"], quantity: 1 },
      { keywords: ["rooftop", "deck"], quantity: 1 },
      { keywords: ["electrical", "plumbing"], quantity: 1 }
    ],
    discount: 0.07 // 7% bundle discount
  },
  {
    name: "Construction Site Bundle",
    trigger: ["construction", "site", "crew"],
    requiredProducts: ["container"],
    includedProducts: [
      { keywords: ["40ft", "container"], quantity: 2 },
      { keywords: ["office", "container"], quantity: 1 },
      { keywords: ["bathroom", "restroom"], quantity: 1 },
      { keywords: ["onsite", "delivery"], quantity: 1 }
    ],
    discount: 0.08 // 8% bundle discount
  },
  {
    name: "Startup Workspace",
    trigger: ["startup", "tech", "team"],
    requiredProducts: ["office", "workspace"],
    includedProducts: [
      { keywords: ["20ft", "office"], quantity: 1 },
      { keywords: ["ac", "climate"], quantity: 1 },
      { keywords: ["interior", "modern"], quantity: 1 },
      { keywords: ["consultation"], quantity: 1 }
    ],
    discount: 0.06 // 6% bundle discount
  }
];

/**
 * Identifies potential bundles based on conversation keywords
 */
export function identifyBundles(
  keywords: Set<string>,
  products: Array<{id: string; name: string; unitPrice: number}>
): ProductBundle[] {
  const bundles: ProductBundle[] = [];
  
  for (const pattern of BUNDLE_PATTERNS) {
    // Check if conversation triggers this bundle
    const triggered = pattern.trigger.some(t => keywords.has(t));
    if (!triggered) continue;
    
    // Check if required products are mentioned
    const hasRequired = pattern.requiredProducts.some(req => 
      keywords.has(req) || products.some(p => 
        p.name.toLowerCase().includes(req)
      )
    );
    if (!hasRequired) continue;
    
    // Build the bundle
    const bundleProducts: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }> = [];
    
    for (const item of pattern.includedProducts) {
      // Find matching product
      const matchingProduct = products.find(p => {
        const nameLower = p.name.toLowerCase();
        return item.keywords.some(kw => nameLower.includes(kw));
      });
      
      if (matchingProduct) {
        bundleProducts.push({
          productId: matchingProduct.id,
          productName: matchingProduct.name,
          quantity: item.quantity,
          price: matchingProduct.unitPrice
        });
      }
    }
    
    // Calculate pricing
    if (bundleProducts.length >= 2) { // Only create bundle if we have at least 2 products
      const totalPrice = bundleProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
      const discountedPrice = Math.round(totalPrice * (1 - pattern.discount));
      const savings = totalPrice - discountedPrice;
      
      bundles.push({
        name: pattern.name,
        description: `Save ${(pattern.discount * 100).toFixed(0)}% with this curated bundle`,
        products: bundleProducts.map(p => ({
          productId: p.productId,
          productName: p.productName,
          quantity: p.quantity
        })),
        totalPrice: discountedPrice,
        savings: savings,
        confidence: bundleProducts.length / pattern.includedProducts.length
      });
    }
  }
  
  // Sort bundles by confidence
  return bundles.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggests complementary products based on selected items
 */
export function suggestComplementaryProducts(
  selectedProductIds: string[],
  allProducts: Array<{id: string; name: string; unitPrice: number}>
): Array<{productId: string; productName: string; reason: string; confidence: number}> {
  const suggestions: Array<{
    productId: string;
    productName: string;
    reason: string;
    confidence: number;
  }> = [];
  
  const selectedProducts = allProducts.filter(p => selectedProductIds.includes(p.id));
  
  // Rules for complementary products
  const complementaryRules = [
    {
      if: ["container", "unit"],
      suggest: ["electrical", "upgrade"],
      reason: "Most container units need electrical upgrades"
    },
    {
      if: ["office"],
      suggest: ["ac", "hvac", "climate"],
      reason: "Office containers typically need climate control"
    },
    {
      if: ["adu", "studio"],
      suggest: ["rooftop", "deck"],
      reason: "Rooftop decks maximize living space for ADUs"
    },
    {
      if: ["40ft", "53ft"],
      suggest: ["onsite", "assessment"],
      reason: "Larger containers benefit from site assessment"
    },
    {
      if: ["kitchen"],
      suggest: ["plumbing", "electrical"],
      reason: "Kitchen containers require utilities"
    }
  ];
  
  for (const rule of complementaryRules) {
    // Check if selected products match the "if" condition
    const hasMatchingProduct = selectedProducts.some(p => {
      const nameLower = p.name.toLowerCase();
      return rule.if.some(keyword => nameLower.includes(keyword));
    });
    
    if (hasMatchingProduct) {
      // Find products matching the "suggest" keywords
      const suggestedProducts = allProducts.filter(p => {
        if (selectedProductIds.includes(p.id)) return false; // Don't suggest already selected
        
        const nameLower = p.name.toLowerCase();
        return rule.suggest.some(keyword => nameLower.includes(keyword));
      });
      
      for (const product of suggestedProducts) {
        if (!suggestions.find(s => s.productId === product.id)) {
          suggestions.push({
            productId: product.id,
            productName: product.name,
            reason: rule.reason,
            confidence: 0.75
          });
        }
      }
    }
  }
  
  // Sort by confidence and limit to top 3
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}