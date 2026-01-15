import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Proposal } from '../shared/schema';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export function generateProposalPDF(proposal: Proposal): Buffer {
  const doc = new jsPDF();
  
  // Header with Bob's Containers branding (deep navy)
  doc.autoTable({
    body: [
      [
        {
          content: "BOB'S CONTAINERS",
          styles: { halign: 'left', fontSize: 22, textColor: '#ffffff', fontStyle: 'bold' }
        },
        {
          content: 'PROPOSAL',
          styles: { halign: 'right', fontSize: 20, textColor: '#ffffff', fontStyle: 'bold' }
        }
      ]
    ],
    theme: 'plain',
    styles: { fillColor: '#1a2d5e', cellPadding: 8 } // Deep navy
  });

  // Proposal details
  doc.autoTable({
    body: [
      [
        {
          content: 
            `Proposal #: ${proposal.proposalNumber}\n` +
            `Date: ${new Date(proposal.createdAt).toLocaleDateString()}\n` +
            `Status: ${proposal.status.toUpperCase()}`,
          styles: { halign: 'left', fontSize: 10 }
        },
        {
          content: 
            `Customer: ${proposal.customerName}\n` +
            `Email: ${proposal.customerEmail || 'N/A'}`,
          styles: { halign: 'right', fontSize: 10 }
        }
      ]
    ],
    theme: 'plain',
    styles: { cellPadding: 5 },
    startY: doc.lastAutoTable.finalY + 2
  });

  // Conversation Notes Section
  if (proposal.conversationNotes) {
    doc.autoTable({
      head: [['Customer Requirements']],
      body: [
        [{ content: proposal.conversationNotes, styles: { fontSize: 9, cellPadding: 5 } }]
      ],
      startY: doc.lastAutoTable.finalY + 5,
      theme: 'striped',
      headStyles: { fillColor: '#1a2d5e', fontSize: 11, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });
  }

  // AI Analysis Section
  if (proposal.aiAnalysis) {
    const analysis = proposal.aiAnalysis as any;
    
    // Requirements
    if (analysis.requirements && analysis.requirements.length > 0) {
      doc.autoTable({
        head: [['Identified Requirements']],
        body: analysis.requirements.map((req: string) => [req]),
        startY: doc.lastAutoTable.finalY + 5,
        theme: 'striped',
        headStyles: { fillColor: '#1a2d5e', fontSize: 11, fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });
    }
  }

  // Line Items Table
  const lineItems = proposal.lineItems as any[] || [];
  const tableColumn = ['Product', 'Quantity', 'Unit Price', 'Total'];
  const tableRows = lineItems.map(item => [
    item.productName || 'Unknown Product',
    item.quantity || '1',
    `$${((item.unitPrice || 0) / 100).toFixed(2)}`,
    `$${((item.total || (item.quantity * item.unitPrice)) / 100).toFixed(2)}`
  ]);

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: doc.lastAutoTable.finalY + 8,
    theme: 'striped',
    headStyles: { fillColor: '#1a2d5e', fontSize: 11, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 40 }
    }
  });

  // Pricing Summary
  const subtotal = proposal.subtotal || 0;
  const tax = proposal.tax || 0;
  const total = proposal.total || 0;

  doc.autoTable({
    body: [
      [
        { content: 'Subtotal:', styles: { halign: 'right', fontStyle: 'bold' }},
        { content: `$${(subtotal / 100).toFixed(2)}`, styles: { halign: 'right' }}
      ],
      [
        { content: 'Tax (8.25%):', styles: { halign: 'right', fontStyle: 'bold' }},
        { content: `$${(tax / 100).toFixed(2)}`, styles: { halign: 'right' }}
      ],
      [
        { content: 'TOTAL:', styles: { halign: 'right', fontStyle: 'bold', fontSize: 12, fillColor: '#f0f0f0' }},
        { content: `$${(total / 100).toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 12, fillColor: '#f0f0f0' }}
      ]
    ],
    startY: doc.lastAutoTable.finalY + 5,
    theme: 'plain',
    styles: { cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 45 }
    }
  });

  // Additional Notes
  if (proposal.notes) {
    doc.autoTable({
      head: [['Additional Notes']],
      body: [
        [{ content: proposal.notes, styles: { fontSize: 9 } }]
      ],
      startY: doc.lastAutoTable.finalY + 8,
      theme: 'plain',
      headStyles: { fillColor: '#1a2d5e', fontSize: 11, fontStyle: 'bold' },
      styles: { cellPadding: 5 }
    });
  }

  // Footer
  const footerY = Math.max(doc.lastAutoTable.finalY + 15, doc.internal.pageSize.height - 40);
  doc.autoTable({
    body: [
      [
        {
          content: 
            `Bob's Containers | Premium Shipping Container Solutions\n` +
            `Contact: sales@bobscontainers.com | (800) BOB-SHIP\n` +
            `www.bobscontainers.com`,
          styles: { halign: 'center', fontSize: 9, textColor: '#666' }
        }
      ]
    ],
    startY: footerY,
    theme: 'plain'
  });

  // Return as buffer for server response
  return Buffer.from(doc.output('arraybuffer'));
}