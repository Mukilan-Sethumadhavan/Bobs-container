// Test fixtures for regression testing of AI parsing consistency

export const testConversations = [
  {
    id: 'test-1-adu-basic',
    name: 'Basic ADU Request',
    customerName: 'John Smith',
    conversationNotes: `
Customer is looking for a backyard rental unit for their property in Austin. 
They need a 40-foot container converted into a studio apartment with bathroom and kitchenette. 
Budget is around $50,000 and timeline is 3 months.
Site is already prepared with utilities available.
    `,
    expectedProducts: [
      { nameContains: '40', type: 'ADU' },
      { nameContains: 'bathroom', type: 'accessory' },
      { nameContains: 'kitchen', type: 'accessory' }
    ],
    expectedQuantities: {
      'ADU': 1,
      'bathroom': 1,
      'kitchen': 1
    },
    expectedBudget: '$50,000',
    expectedTimeline: '3 months'
  },
  {
    id: 'test-2-office-multiple',
    name: 'Multiple Office Containers',
    customerName: 'Tech Startup Inc',
    conversationNotes: `
We need two 20-foot containers for a construction site office setup.
Each should have windows, AC, and electrical. 
We also need 3 desks and 6 chairs.
Project starts next month.
    `,
    expectedProducts: [
      { nameContains: '20', type: 'office', quantity: 2 },
      { nameContains: 'desk', type: 'furniture', quantity: 3 },
      { nameContains: 'chair', type: 'furniture', quantity: 6 }
    ],
    expectedTimeline: 'next month'
  },
  {
    id: 'test-3-restaurant-complex',
    name: 'Restaurant Container Complex',
    customerName: 'Food Concepts LLC',
    conversationNotes: `
Looking to create a popup restaurant using containers.
Need a 40ft kitchen container with commercial equipment.
Also need a 20ft bar container and two 20ft dining containers.
Plus outdoor deck and seating for 50 people.
Opening target is summer 2024.
    `,
    expectedProducts: [
      { nameContains: '40', type: 'kitchen', quantity: 1 },
      { nameContains: '20', type: 'bar', quantity: 1 },
      { nameContains: '20', type: 'dining', quantity: 2 },
      { nameContains: 'deck', type: 'accessory' },
      { nameContains: 'seating', type: 'furniture' }
    ],
    expectedTimeline: 'summer 2024'
  },
  {
    id: 'test-4-ambiguous',
    name: 'Ambiguous Request',
    customerName: 'Unclear Customer',
    conversationNotes: `
I need containers for my business.
Maybe something around 30 feet?
Not sure about the details yet.
    `,
    shouldHaveUnmatchedNeeds: true,
    expectedUnmatchedPatterns: ['30 feet', 'unclear specifications']
  },
  {
    id: 'test-5-quantity-keywords',
    name: 'Quantity Keywords Test',
    customerName: 'Quantity Test Co',
    conversationNotes: `
We need a couple of storage containers for equipment.
Also a few workstations and several safety kits.
Standard 20-foot containers should work.
    `,
    expectedQuantities: {
      'storage': 2, // "a couple"
      'workstation': 3, // "a few"
      'safety': 4 // "several"
    }
  }
];

export async function runRegressionTest(
  analyzeFunction: (notes: string, customer: string, products: any[]) => Promise<any>,
  products: any[]
): Promise<{ passed: number; failed: number; details: any[] }> {
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of testConversations) {
    console.log(`Running test: ${test.id} - ${test.name}`);
    
    // Run the same test 3 times to check consistency
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const result = await analyzeFunction(
        test.conversationNotes,
        test.customerName,
        products
      );
      runs.push(result);
    }
    
    // Check if all runs produced identical results
    const firstRunJSON = JSON.stringify(runs[0].matchedProducts);
    const isConsistent = runs.every(run => 
      JSON.stringify(run.matchedProducts) === firstRunJSON
    );
    
    // Check expected patterns
    let matchesExpectations = true;
    const issues = [];
    
    if (!isConsistent) {
      matchesExpectations = false;
      issues.push('INCONSISTENT: Different results on multiple runs');
    }
    
    if (test.expectedBudget && runs[0].estimatedBudget !== test.expectedBudget) {
      issues.push(`Budget mismatch: expected ${test.expectedBudget}, got ${runs[0].estimatedBudget}`);
    }
    
    if (test.expectedTimeline && !runs[0].timeline?.includes(test.expectedTimeline)) {
      issues.push(`Timeline mismatch: expected ${test.expectedTimeline}, got ${runs[0].timeline}`);
    }
    
    if (test.shouldHaveUnmatchedNeeds && (!runs[0].unmatchedNeeds || runs[0].unmatchedNeeds.length === 0)) {
      issues.push('Expected unmatched needs but none found');
    }
    
    const testResult = {
      testId: test.id,
      testName: test.name,
      consistent: isConsistent,
      passed: isConsistent && issues.length === 0,
      issues,
      firstRun: runs[0],
      allRuns: runs
    };
    
    if (testResult.passed) {
      passed++;
      console.log(`✅ PASSED: ${test.name}`);
    } else {
      failed++;
      console.log(`❌ FAILED: ${test.name}`);
      console.log('Issues:', issues);
    }
    
    results.push(testResult);
  }
  
  return { passed, failed, details: results };
}