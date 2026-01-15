import type { Request, Response, NextFunction } from "express";

// HubSpot API configuration
const HUBSPOT_API_BASE = "https://api.hubapi.com";

export interface HubSpotConfig {
  apiKey: string;
  mode: "read-only" | "test" | "production";
}

export interface HubSpotThread {
  id: string;
  status: "OPEN" | "CLOSED";
  associatedContactId?: string;
  latestMessageTimestamp?: string;
  inboxId?: string;
  originalChannelId?: string;
  originalChannelAccountId?: string;
}

export interface HubSpotMessage {
  id: string;
  conversationsThreadId: string;
  createdAt: string;
  updatedAt?: string;
  text: string;
  richText?: string;
  direction: "INCOMING" | "OUTGOING";
  senders?: Array<{
    actorId: string;
    name?: string;
    deliveryIdentifier?: {
      type: string;
      value: string;
    };
  }>;
  recipients?: Array<{
    actorId: string;
    name?: string;
    deliveryIdentifier?: {
      type: string;
      value: string;
    };
  }>;
  status?: {
    statusType: string;
  };
  channelId?: string;
  type: string;
  attachments?: Array<any>;
  truncationStatus?: string;
}

export interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    lifecyclestage?: string;
    hs_object_id?: string;
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    pipeline?: string;
    amount?: string;
    closedate?: string;
    hubspot_owner_id?: string;
    hs_object_id?: string;
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  associations?: {
    contacts?: string[];
    companies?: string[];
  };
}

export interface HubSpotActivityLog {
  timestamp: string;
  action: string;
  endpoint: string;
  method: string;
  mode: string;
  success: boolean;
  details?: any;
  error?: string;
}

// In-memory storage for HubSpot configuration and logs
let hubspotConfig: HubSpotConfig | null = null;
const activityLog: HubSpotActivityLog[] = [];

// Helper function to make HubSpot API calls
async function makeHubSpotRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  if (!hubspotConfig) {
    throw new Error("HubSpot API key not configured");
  }

  const url = `${HUBSPOT_API_BASE}${endpoint}`;
  const headers = {
    "Authorization": `Bearer ${hubspotConfig.apiKey}`,
    "Content-Type": "application/json",
    ...options.headers
  };

  const logEntry: HubSpotActivityLog = {
    timestamp: new Date().toISOString(),
    action: "API Call",
    endpoint,
    method: options.method || "GET",
    mode: hubspotConfig.mode,
    success: false
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      logEntry.error = error;
      activityLog.push(logEntry);
      throw new Error(`HubSpot API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    logEntry.success = true;
    logEntry.details = { recordCount: data.results?.length || 1 };
    activityLog.push(logEntry);

    return data;
  } catch (error) {
    logEntry.error = error instanceof Error ? error.message : String(error);
    activityLog.push(logEntry);
    throw error;
  }
}

// HubSpot API Service Functions

export async function setHubSpotConfig(config: HubSpotConfig): Promise<void> {
  hubspotConfig = config;
  
  const logEntry: HubSpotActivityLog = {
    timestamp: new Date().toISOString(),
    action: "Configuration Updated",
    endpoint: "N/A",
    method: "N/A",
    mode: config.mode,
    success: true,
    details: { mode: config.mode }
  };
  
  activityLog.push(logEntry);
}

export function getHubSpotConfig(): HubSpotConfig | null {
  return hubspotConfig;
}

export function getActivityLog(): HubSpotActivityLog[] {
  return activityLog;
}

export function clearActivityLog(): void {
  activityLog.length = 0;
}

// Conversations API
export async function getConversationThreads(params?: {
  inboxId?: string;
  channelId?: string;
  associatedContactId?: string;
  threadStatus?: "OPEN" | "CLOSED";
  limit?: number;
  after?: string;
}): Promise<{ results: HubSpotThread[]; paging?: any }> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
  }

  const endpoint = `/conversations/v3/conversations/threads${queryParams.toString() ? `?${queryParams}` : ""}`;
  return makeHubSpotRequest(endpoint);
}

export async function getThreadMessages(
  threadId: string
): Promise<{ results: HubSpotMessage[] }> {
  const endpoint = `/conversations/v3/conversations/threads/${threadId}/messages`;
  return makeHubSpotRequest(endpoint);
}

export async function getThreadDetails(
  threadId: string,
  includeAssociations?: boolean
): Promise<HubSpotThread> {
  const endpoint = `/conversations/v3/conversations/threads/${threadId}${
    includeAssociations ? "?associations=ticket" : ""
  }`;
  return makeHubSpotRequest(endpoint);
}

// Contacts API
export async function getContacts(params?: {
  limit?: number;
  after?: string;
  properties?: string[];
  archived?: boolean;
}): Promise<{ results: HubSpotContact[]; paging?: any }> {
  const queryParams = new URLSearchParams();
  if (params) {
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.after) queryParams.append("after", params.after);
    if (params.properties) queryParams.append("properties", params.properties.join(","));
    if (params.archived !== undefined) queryParams.append("archived", String(params.archived));
  }

  const endpoint = `/crm/v3/objects/contacts${queryParams.toString() ? `?${queryParams}` : ""}`;
  return makeHubSpotRequest(endpoint);
}

export async function getContactById(
  contactId: string,
  properties?: string[]
): Promise<HubSpotContact> {
  const queryParams = properties ? `?properties=${properties.join(",")}` : "";
  const endpoint = `/crm/v3/objects/contacts/${contactId}${queryParams}`;
  return makeHubSpotRequest(endpoint);
}

export async function getContactsByEmail(
  emails: string[]
): Promise<{ results: HubSpotContact[] }> {
  const endpoint = `/crm/v3/objects/contacts/batch/read`;
  return makeHubSpotRequest(endpoint, {
    method: "POST",
    body: JSON.stringify({
      idProperty: "email",
      properties: ["email", "firstname", "lastname", "phone", "company"],
      inputs: emails.map(email => ({ id: email }))
    })
  });
}

// Deals API
export async function getDeals(params?: {
  limit?: number;
  after?: string;
  properties?: string[];
  archived?: boolean;
}): Promise<{ results: HubSpotDeal[]; paging?: any }> {
  const queryParams = new URLSearchParams();
  if (params) {
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.after) queryParams.append("after", params.after);
    if (params.properties) queryParams.append("properties", params.properties.join(","));
    if (params.archived !== undefined) queryParams.append("archived", String(params.archived));
  }

  const endpoint = `/crm/v3/objects/deals${queryParams.toString() ? `?${queryParams}` : ""}`;
  return makeHubSpotRequest(endpoint);
}

export async function getDealById(
  dealId: string,
  properties?: string[]
): Promise<HubSpotDeal> {
  const queryParams = properties ? `?properties=${properties.join(",")}` : "";
  const endpoint = `/crm/v3/objects/deals/${dealId}${queryParams}`;
  return makeHubSpotRequest(endpoint);
}

// Combined conversation data fetcher
export async function getConversationWithContext(threadId: string): Promise<{
  thread: HubSpotThread;
  messages: HubSpotMessage[];
  contact?: HubSpotContact;
  deals?: HubSpotDeal[];
}> {
  // Get thread details
  const thread = await getThreadDetails(threadId, true);
  
  // Get all messages in thread
  const messagesResponse = await getThreadMessages(threadId);
  const messages = messagesResponse.results;

  let contact: HubSpotContact | undefined;
  let deals: HubSpotDeal[] = [];

  // If thread has associated contact, fetch contact details
  if (thread.associatedContactId) {
    try {
      contact = await getContactById(thread.associatedContactId, [
        "email",
        "firstname",
        "lastname",
        "phone",
        "company",
        "lifecyclestage"
      ]);

      // Try to get deals associated with this contact
      const dealsResponse = await getDeals({
        limit: 100,
        properties: ["dealname", "dealstage", "amount", "closedate"]
      });
      
      // In production, you'd filter deals by contact association
      // For now, we'll return all recent deals as an example
      deals = dealsResponse.results.slice(0, 5);
    } catch (error) {
      console.error("Error fetching contact or deals:", error);
    }
  }

  return {
    thread,
    messages,
    contact,
    deals
  };
}

// Simulation functions for test mode
export function simulateProposalCreation(proposalData: any): {
  success: boolean;
  mode: string;
  wouldCreate: any;
  timestamp: string;
} {
  if (!hubspotConfig) {
    throw new Error("HubSpot not configured");
  }

  const simulation = {
    success: true,
    mode: hubspotConfig.mode,
    timestamp: new Date().toISOString(),
    wouldCreate: {
      deal: {
        properties: {
          dealname: `Proposal for ${proposalData.customerName}`,
          amount: proposalData.total / 100, // Convert from cents
          dealstage: "presentationscheduled",
          pipeline: "default",
          closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        },
        associations: {
          contact: proposalData.contactId,
        }
      },
      note: {
        properties: {
          hs_note_body: `Automated Proposal #${proposalData.proposalNumber}\n\n${JSON.stringify(proposalData.lineItems, null, 2)}`,
          hs_timestamp: new Date().toISOString()
        }
      },
      attachments: ["PDF Proposal Document"]
    }
  };

  const logEntry: HubSpotActivityLog = {
    timestamp: simulation.timestamp,
    action: "Simulated Proposal Creation",
    endpoint: "/crm/v3/objects/deals",
    method: "POST",
    mode: hubspotConfig.mode,
    success: true,
    details: simulation.wouldCreate
  };
  
  activityLog.push(logEntry);

  return simulation;
}