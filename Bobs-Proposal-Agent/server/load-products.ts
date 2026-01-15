import { readFileSync } from 'fs';
import { join } from 'path';
import { storage } from './storage';
import type { InsertProduct } from '@shared/schema';

function parseCurrency(value: string): number {
  // Remove currency symbols, quotes, and commas, convert to cents
  const cleaned = value.replace(/["$,]/g, '').trim();
  const dollars = parseFloat(cleaned);
  return Math.round(dollars * 100);
}

function parseCSVLine(line: string): [string, string] | null {
  // Handle CSV with proper quote escaping
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  parts.push(current);
  
  if (parts.length >= 2) {
    return [parts[0].trim(), parts[1].trim()];
  }
  
  return null;
}

export async function loadProductsFromCSV() {
  try {
    const csvPath = join(process.cwd(), 'attached_assets', 'Bob\'s Containers - All Products (SKUs) - For Agent_1761233039039.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    const lines = csvContent.split('\n').slice(1); // Skip header
    let count = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      const parsed = parseCSVLine(line);
      if (!parsed) continue;

      const [name, priceStr] = parsed;
      if (!name || !priceStr) continue;

      const unitPrice = parseCurrency(priceStr);
      
      const product: InsertProduct = {
        name,
        unitPrice,
      };

      await storage.createProduct(product);
      count++;
    }

    console.log(`Loaded ${count} products from CSV`);
    return count;
  } catch (error) {
    console.error('Error loading products from CSV:', error);
    return 0;
  }
}
