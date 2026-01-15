import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Product/SKU Schema
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unitPrice: integer("unit_price").notNull(), // in cents
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Proposal Schema
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalNumber: text("proposal_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  conversationNotes: text("conversation_notes").notNull(),
  aiAnalysis: jsonb("ai_analysis").$type<{
    requirements: string[];
    recommendedProducts: string[];
    estimatedBudget?: string;
    timeline?: string;
    additionalNotes?: string;
  }>(),
  lineItems: jsonb("line_items").notNull().$type<Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number; // in cents
    total: number; // in cents
  }>>(),
  subtotal: integer("subtotal").notNull(), // in cents
  tax: integer("tax").default(0), // in cents
  total: integer("total").notNull(), // in cents
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  notes: text("notes"),
});

export const insertProposalSchema = createInsertSchema(proposals).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  rejectedAt: true,
});

export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

// Additional schemas for API requests
export const analyzeConversationSchema = z.object({
  conversationNotes: z.string().min(10, "Conversation notes must be at least 10 characters"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional(),
});

export type AnalyzeConversationInput = z.infer<typeof analyzeConversationSchema>;

export const updateProposalStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  notes: z.string().optional(),
});

export type UpdateProposalStatusInput = z.infer<typeof updateProposalStatusSchema>;
