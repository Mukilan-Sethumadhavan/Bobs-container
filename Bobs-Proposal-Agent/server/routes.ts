import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loadProductsFromCSV } from "./load-products";
import { analyzeConversation } from "./ai-service";
import { 
  analyzeConversationSchema, 
  insertProposalSchema,
  updateProposalStatusSchema,
  type InsertProposal 
} from "@shared/schema";
import { z } from "zod";
import * as hubspot from "./hubspot-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Load products from CSV on startup
  await loadProductsFromCSV();

  // Health check endpoint to verify AI configuration
  app.get("/api/health", async (req, res) => {
    const aiProvider = process.env.AI_PROVIDER || 'gemini';
    const aiModel = process.env.AI_MODEL || 'gemini-2.5-flash';
    const hasApiKey = !!(process.env.AI_API_KEY || process.env.GEMINI_API_KEY);
    const apiKeyPrefix = process.env.AI_API_KEY ? process.env.AI_API_KEY.substring(0, 10) + '...' : 'NOT SET';
    
    res.json({
      status: 'ok',
      ai: {
        provider: aiProvider,
        model: aiModel,
        apiKeyConfigured: hasApiKey,
        apiKeyPrefix: apiKeyPrefix,
      },
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get single product
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Analyze conversation with AI
  app.post("/api/proposals/analyze", async (req, res) => {
    try {
      const data = analyzeConversationSchema.parse(req.body);
      
      // Get all products for intelligent matching
      const products = await storage.getProducts();
      
      const analysis = await analyzeConversation(
        data.conversationNotes,
        data.customerName,
        products
      );
      res.json(analysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error analyzing conversation:", error);
      res.status(500).json({ error: "Failed to analyze conversation" });
    }
  });

  // // Generate complete proposal from conversation (2-step flow)
  // app.post("/api/proposals/generate", async (req, res) => {
  //   try {
  //     const data = analyzeConversationSchema.parse(req.body);
      
  //     // print the data on console
  //     console.log("Received data:", data);
      
  //     // Get all products for intelligent matching
  //     const products = await storage.getProducts();
      
  //     // Analyze conversation with AI
  //     const analysis = await analyzeConversation(
  //       data.conversationNotes,
  //       data.customerName,
  //       products
  //     );

  //     // If no products matched, return error
  //     if (!analysis.matchedProducts || analysis.matchedProducts.length === 0) {
  //       return res.status(400).json({ 
  //         error: "Could not identify specific products from conversation",
  //         analysis 
  //       });
  //     }

  //     // Calculate pricing
  //     const lineItems = analysis.matchedProducts.map(match => ({
  //       productId: match.productId,
  //       productName: match.productName,
  //       quantity: match.quantity,
  //       unitPrice: match.unitPrice || 0,
  //       total: (match.unitPrice || 0) * match.quantity, // Changed from totalPrice to total
  //     }));

  //     const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  //     const taxRate = 0.0825; // 8.25% tax
  //     const tax = Math.round(subtotal * taxRate);
  //     const total = subtotal + tax;

  //     // Generate proposal number
  //     const date = new Date();
  //     const proposalNumber = `BC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`;

  //     // Use customer name from AI analysis if available, otherwise use provided name
  //     const finalCustomerName = (analysis as any).customerName || data.customerName;

  //     // Create the proposal
  //     const proposal: InsertProposal = {
  //       proposalNumber,
  //       customerName: finalCustomerName,
  //       customerEmail: data.customerEmail || '',
  //       conversationNotes: data.conversationNotes,
  //       aiAnalysis: analysis,
  //       lineItems,
  //       subtotal,
  //       tax,
  //       total,
  //       status: "pending",
  //     };

  //     const created = await storage.createProposal(proposal);
      
  //     // Return the created proposal with analysis
  //     res.json({
  //       proposal: created,
  //       analysis
  //     });
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       return res.status(400).json({ error: "Validation error", details: error.errors });
  //     }
  //     console.error("Error generating proposal:", error);
  //     res.status(500).json({ error: "Failed to generate proposal" });
  //   }
  // });

  // New endpoint: Generate proposal from conversation with sequence number
app.post("/api/proposals/generate", async (req, res) => {
  try {
    const { sequence_number, conversationNotes } = req.body;
    
    // Validate input
    if (!sequence_number || typeof sequence_number !== 'number') {
      return res.status(400).json({ error: "sequence_number is required and must be a number" });
    }
    
    if (!conversationNotes || typeof conversationNotes !== 'string' || conversationNotes.length < 20) {
      return res.status(400).json({ error: "conversationNotes is required and must be at least 20 characters" });
    }
    
    console.log("Received data:", { sequence_number, conversationNotes });
    
    // Extract customer info intelligently from conversation
    const extractCustomerName = (text: string): string => {
      const patterns = [
        /(?:my\s+name\s+(?:is|would\s+be|will\s+be)|change\s+my\s+name\s+to|name\s+would\s+be)\s+([A-Za-z][A-Za-z0-9\s]+?)(?:[,\.\n]|$)/i,
        /(?:I'?m|I\s+am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        /(?:customer|client|contact):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        /(?:^|\n)(?:name|Name):\s*([A-Za-z][A-Za-z0-9\s]+?)(?:[,\.\n]|$)/i,
        /this\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?):/m,
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
          const name = match[1].trim();
          if (name.length > 1 && 
              !name.toLowerCase().includes('customer') && 
              !name.toLowerCase().includes('client') &&
              !name.toLowerCase().includes('sales') &&
              name.length < 50) {
            return name;
          }
        }
      }
      
      return "Valued Customer";
    };
    
    const extractCustomerEmail = (text: string): string | undefined => {
      const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
      const match = text.match(emailPattern);
      return match?.[1];
    };
    
    const customerName = extractCustomerName(conversationNotes);
    const customerEmail = extractCustomerEmail(conversationNotes);
    
    // Get all products for intelligent matching
    const products = await storage.getProducts();
    
    // Analyze conversation with AI
    const analysis = await analyzeConversation(
      conversationNotes,
      customerName,
      products
    );

    // If no products matched, return error
    if (!analysis.matchedProducts || analysis.matchedProducts.length === 0) {
      return res.status(400).json({ 
        error: "Could not identify specific products from conversation",
        analysis 
      });
    }

    // Calculate pricing
    const lineItems = analysis.matchedProducts.map(match => ({
      productId: match.productId,
      productName: match.productName,
      quantity: match.quantity,
      unitPrice: match.unitPrice || 0,
      total: (match.unitPrice || 0) * match.quantity,
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 0.0825; // 8.25% tax
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + tax;

    // Use sequence number for proposal number
    const proposalNumber = `BC-SEQ-${String(sequence_number).padStart(6, '0')}`;

    // Use customer name from AI analysis if available, otherwise use extracted name
    const finalCustomerName = (analysis as any).customerName || customerName;

    // Create the proposal
    const proposal: InsertProposal = {
      proposalNumber,
      customerName: finalCustomerName,
      customerEmail: customerEmail || '',
      conversationNotes,
      aiAnalysis: analysis,
      lineItems,
      subtotal,
      tax,
      total,
      status: "pending",
    };

    const created = await storage.createProposal(proposal);
    
    // Return the created proposal with analysis
    res.json({
      success: true,
      proposal: created,
      analysis,
      metadata: {
        sequence_number,
        matched_products: analysis.matchedProducts.length,
        confidence_score: Math.round(
          (analysis.matchedProducts.reduce((sum: number, p: any) => sum + (p.confidence || 0.5), 0) / 
          Math.max(analysis.matchedProducts.length, 1)) * 100
        ),
        unmatched_needs: (analysis as any).unmatchedNeeds || []
      }
    });
  } catch (error) {
    console.error("Error generating proposal from sequence:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to generate proposal",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

  // Create proposal
  app.post("/api/proposals", async (req, res) => {
    try {
      const data = insertProposalSchema.parse(req.body);
      const proposal = await storage.createProposal(data);
      res.status(201).json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating proposal:", error);
      res.status(500).json({ error: "Failed to create proposal" });
    }
  });

  // Get all proposals
  app.get("/api/proposals", async (req, res) => {
    try {
      const proposals = await storage.getProposals();
      res.json(proposals);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  // Get single proposal
  app.get("/api/proposals/:id", async (req, res) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  });

  // Update proposal status
  app.patch("/api/proposals/:id/status", async (req, res) => {
    try {
      const data = updateProposalStatusSchema.parse(req.body);
      const proposal = await storage.getProposal(req.params.id);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const updates: any = {
        status: data.status,
        notes: data.notes,
      };

      if (data.status === "approved") {
        updates.approvedAt = new Date();
        updates.rejectedAt = null;
      } else if (data.status === "rejected") {
        updates.rejectedAt = new Date();
        updates.approvedAt = null;
      }

      const updatedProposal = await storage.updateProposal(req.params.id, updates);
      res.json(updatedProposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating proposal:", error);
      res.status(500).json({ error: "Failed to update proposal" });
    }
  });

  // Generate PDF
  app.post("/api/proposals/:id/pdf", async (req, res) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      
      // Import PDF generator
      const { generateProposalPDF } = await import('./pdf-generator');
      
      // Generate PDF buffer
      const pdfBuffer = generateProposalPDF(proposal);
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.proposalNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      
      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // HubSpot Configuration Endpoints
  app.post("/api/hubspot/config", async (req, res) => {
    try {
      const { apiKey, mode } = req.body;
      
      if (!apiKey || !mode) {
        return res.status(400).json({ error: "API key and mode are required" });
      }

      if (!["read-only", "test", "production"].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode" });
      }

      await hubspot.setHubSpotConfig({ apiKey, mode });
      
      res.json({ 
        success: true, 
        message: "HubSpot configuration saved",
        mode
      });
    } catch (error) {
      console.error("Error setting HubSpot config:", error);
      res.status(500).json({ error: "Failed to configure HubSpot" });
    }
  });

  app.get("/api/hubspot/config", async (req, res) => {
    try {
      const config = hubspot.getHubSpotConfig();
      
      if (!config) {
        return res.json({ configured: false });
      }

      // Don't send the actual API key to the frontend
      res.json({ 
        configured: true,
        mode: config.mode,
        hasApiKey: !!config.apiKey
      });
    } catch (error) {
      console.error("Error getting HubSpot config:", error);
      res.status(500).json({ error: "Failed to get HubSpot config" });
    }
  });

  // HubSpot Activity Log
  app.get("/api/hubspot/activity-log", async (req, res) => {
    try {
      const logs = hubspot.getActivityLog();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity log:", error);
      res.status(500).json({ error: "Failed to fetch activity log" });
    }
  });

  app.delete("/api/hubspot/activity-log", async (req, res) => {
    try {
      hubspot.clearActivityLog();
      res.json({ success: true, message: "Activity log cleared" });
    } catch (error) {
      console.error("Error clearing activity log:", error);
      res.status(500).json({ error: "Failed to clear activity log" });
    }
  });

  // HubSpot Conversations API
  app.get("/api/hubspot/conversations", async (req, res) => {
    try {
      const params = {
        inboxId: req.query.inboxId as string | undefined,
        channelId: req.query.channelId as string | undefined,
        associatedContactId: req.query.associatedContactId as string | undefined,
        threadStatus: req.query.threadStatus as "OPEN" | "CLOSED" | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        after: req.query.after as string | undefined
      };

      const threads = await hubspot.getConversationThreads(params);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/hubspot/conversations/:threadId", async (req, res) => {
    try {
      const { threadId } = req.params;
      const conversation = await hubspot.getConversationWithContext(threadId);
      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation details:", error);
      res.status(500).json({ error: "Failed to fetch conversation details" });
    }
  });

  app.get("/api/hubspot/conversations/:threadId/messages", async (req, res) => {
    try {
      const { threadId } = req.params;
      const messages = await hubspot.getThreadMessages(threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // HubSpot Contacts API
  app.get("/api/hubspot/contacts", async (req, res) => {
    try {
      const params = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        after: req.query.after as string | undefined,
        properties: req.query.properties 
          ? (req.query.properties as string).split(",") 
          : ["email", "firstname", "lastname", "phone", "company"],
        archived: req.query.archived === "true"
      };

      const contacts = await hubspot.getContacts(params);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.get("/api/hubspot/contacts/:contactId", async (req, res) => {
    try {
      const { contactId } = req.params;
      const properties = req.query.properties 
        ? (req.query.properties as string).split(",")
        : undefined;

      const contact = await hubspot.getContactById(contactId, properties);
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ error: "Failed to fetch contact" });
    }
  });

  // HubSpot Deals API
  app.get("/api/hubspot/deals", async (req, res) => {
    try {
      const params = {
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        after: req.query.after as string | undefined,
        properties: req.query.properties 
          ? (req.query.properties as string).split(",") 
          : ["dealname", "dealstage", "pipeline", "amount", "closedate"],
        archived: req.query.archived === "true"
      };

      const deals = await hubspot.getDeals(params);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.get("/api/hubspot/deals/:dealId", async (req, res) => {
    try {
      const { dealId } = req.params;
      const properties = req.query.properties 
        ? (req.query.properties as string).split(",")
        : undefined;

      const deal = await hubspot.getDealById(dealId, properties);
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  // HubSpot Proposal Simulation
  app.post("/api/hubspot/simulate-proposal", async (req, res) => {
    try {
      const proposalData = req.body;
      const simulation = hubspot.simulateProposalCreation(proposalData);
      res.json(simulation);
    } catch (error) {
      console.error("Error simulating proposal:", error);
      res.status(500).json({ error: "Failed to simulate proposal creation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
