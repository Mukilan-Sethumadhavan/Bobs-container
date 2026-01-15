# Design Guidelines: Bob's Containers Automated Proposal System

## Design Approach

**Selected System**: Material Design with professional B2B customization
**Justification**: Utility-focused sales productivity tool requiring clear data presentation, efficient workflows, and professional credibility. The system prioritizes function over form while maintaining brand consistency.

## Core Design Elements

### A. Color Palette

**Primary Colors (from Bob's Containers branding)**
- Primary: Deep Navy Blue (210 85% 20%) - headers, primary actions, brand elements
- Primary Light: (210 75% 35%) - hover states, accents
- Background Dark: (215 25% 12%) - main dark mode background
- Background Surface: (215 20% 16%) - card/panel backgrounds

**Secondary Colors**
- Success Green: (145 65% 45%) - approved proposals, confirmations
- Warning Amber: (35 85% 55%) - pending approvals, cautions  
- Error Red: (355 75% 50%) - rejections, validation errors
- Neutral Gray: (215 15% 65%) - secondary text, borders

**Light Mode Alternatives**
- Background: (0 0% 98%)
- Surface: (0 0% 100%)
- Text Primary: (215 25% 15%)

### B. Typography

**Font Families**
- Primary: Inter (body text, UI elements, data)
- Headings: Inter (weight: 600-700 for hierarchy)
- Monospace: JetBrains Mono (SKU codes, pricing)

**Type Scale**
- Display: 32px/40px (page headers)
- H1: 24px/32px (section headers)
- H2: 20px/28px (card headers)
- H3: 16px/24px (sub-sections)
- Body: 14px/20px (standard text)
- Small: 12px/16px (metadata, labels)

### C. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-20
- Card spacing: p-6
- Form fields: gap-4
- Grid gaps: gap-6

**Container Widths**
- Dashboard: max-w-7xl (main workspace)
- Proposal viewer: max-w-4xl (optimal reading)
- Forms: max-w-2xl (focused input)

### D. Component Library

**Dashboard Components**
- Status cards with metrics (pending/approved/rejected counts)
- Data table with sortable columns (proposal list, SKU selection)
- Filter sidebar (date range, status, product categories)
- Action toolbar (bulk actions, export, search)

**Proposal Generation Flow**
- Multi-step form wizard with progress indicator
- Conversation input area (textarea with syntax highlighting for HubSpot notes)
- AI analysis results panel (extracted requirements, matched SKUs)
- Product selector with category tabs and search
- Line item editor (table with inline editing, quantity, pricing)
- Preview panel (live proposal preview)

**Forms & Inputs**
- Text inputs with floating labels
- Dropdowns with search/filter capability
- Number inputs for quantities with increment buttons
- Rich text editor for proposal customization
- File upload for additional attachments

**Data Displays**
- Product catalog table (SKU, name, unit price, actions)
- Pricing summary card (subtotal, taxes, total with clear hierarchy)
- Timeline component (proposal history, approval chain)
- Comparison table (multiple proposals side-by-side)

**Navigation**
- Top navigation bar with Bob's Containers logo (left), user menu (right)
- Sidebar navigation for main sections (Dashboard, New Proposal, Catalog, Settings)
- Breadcrumb navigation for deep pages
- Tab navigation within proposal editor

**Overlays**
- Modal dialogs for confirmations (approval, rejection)
- Slide-over panel for SKU details
- Toast notifications for actions (proposal sent, approval received)
- Loading states with skeleton screens

### E. Proposal PDF Design

**Layout Structure**
- Header: Dark navy bar (full-width) with Bob's Containers logo (white)
- Cover page: Company info, proposal number, date, customer details
- Executive summary: Key points, total investment
- Itemized breakdown: Clean table with SKU, description, quantity, unit price, total
- Terms & conditions: Professional typography in smaller text
- Footer: Contact information, page numbers

**PDF Visual Style**
- Professional serif font for proposal body (Georgia or similar)
- Sans-serif for headers and tables (Inter)
- Accent color: Navy blue for section headers, borders
- Tables: Alternating row backgrounds (subtle gray), bold totals row
- Whitespace: Generous margins (1.5-2 inches), clear section breaks
- Branding: Subtle logo watermark, navy accent lines

## Images

No large hero images needed - this is an internal sales tool. Use:
- Bob's Containers logo in navigation header and PDF proposals
- Product thumbnail images in SKU selector (if available from catalog)
- Empty state illustrations for "No proposals yet" screens
- Icon-based illustrations for workflow steps

## Design Principles

1. **Data First**: Information hierarchy prioritizes pricing, SKUs, and proposal status
2. **Efficient Workflows**: Minimize clicks from conversation → approved proposal
3. **Trust & Accuracy**: Clear visual confirmation of AI-extracted data before proposal generation
4. **Professional Output**: PDF proposals maintain Bob's Containers brand credibility
5. **Contextual Help**: Inline guidance for AI analysis results, SKU matching confidence scores