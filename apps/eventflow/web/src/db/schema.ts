import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// 1. CFM Events Team Accounts
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "producer", "warehouse"] }).default("admin").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 2. Clients / CRM
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Mastercard Portugal", "Marta Almeida"
  contactName: text("contact_name"), // e.g. "João Silva"
  email: text("email"),
  phone: text("phone"),
  nif: text("nif"),
  address: text("address"),
  notes: text("notes"),
  source: text("source").default("manual"), // "manual" | "calendly"
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 3. Storage Locations & Facility Managers
export const storageLocations = sqliteTable("storage_locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Armazém Principal", "Armazém A", "Armazém B"
  code: text("code"), // e.g. "ARM-PRIN", "ARM-A"
  address: text("address"), // e.g. "Rua da Indústria 12, Loures"
  managerUserId: text("manager_user_id").references(() => users.id),
  managerName: text("manager_name").notNull(), // e.g. "Administrador CFM", "Madalena Rosa"
  managerContact: text("manager_contact"), // e.g. "+351 912 345 678 · admin@cfmeventos.pt"
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 3.1 Inventory & Rental Stock
export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  sku: text("sku").unique().notNull(), // e.g. "MOB-CHA-001"
  name: text("name").notNull(), // e.g. "Cadeira Chiavari Dourada"
  category: text("category").notNull(), // e.g. "Mobiliário / Cadeiras"
  totalQuantity: integer("total_quantity").notNull().default(1),
  minStock: integer("min_stock").default(0),
  warehouseLocation: text("warehouse_location"), // e.g. "Armazém A · B3 · P2"
  locationId: text("location_id").references(() => storageLocations.id),
  dimensions: text("dimensions"), // e.g. "40 × 45 × 92 cm"
  unitPrice: real("unit_price").default(0).notNull(), // rental price per unit / event
  replacementCost: real("replacement_cost").default(0),
  purchaseStatus: text("purchase_status", { enum: ["bought", "not_bought"] }).default("bought").notNull(), // "bought" (contabilizado em finanças) | "not_bought" (deduzido no lucro projetado)
  purchaseCost: real("purchase_cost").default(0), // total acquisition / purchase cost
  isConsumable: integer("is_consumable", { mode: "boolean" }).default(false).notNull(), // true = consumível (velas, guardanapos, fitas, flores), false = equipamento reutilizável
  packageUnits: integer("package_units").default(1), // unidades por embalagem / pack
  imageUrl: text("image_url"),
  barcode: text("barcode"), // EAN-13, UPC-A, Code-128 etc.
  damagedQuantity: integer("damaged_quantity").default(0),
  inMaintenanceQuantity: integer("in_maintenance_quantity").default(0),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastUpdatedByUserId: text("last_updated_by_user_id"),
  lastUpdatedByName: text("last_updated_by_name"),
});

// 4. Events Lifecycle & Production Pipeline
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Mastercard Gala"
  clientId: text("client_id").references(() => clients.id),
  venue: text("venue"), // e.g. "Estufa Fria"
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }),
  prepDate: integer("prep_date", { mode: "timestamp" }),
  returnDate: integer("return_date", { mode: "timestamp" }),
  status: text("status", { 
    enum: ["planeamento", "orcamento", "confirmado", "preparacao", "em_curso", "devolucao", "concluido", "cancelado"] 
  }).default("planeamento").notNull(),
  totalBudget: real("total_budget").default(0), // Total internal production budget
  customerPrice: real("customer_price").default(0), // Total amount customer is going to pay
  category: text("category").default("Geral"), // e.g. "Aniversário Infantil", "Casamento", "Corporativo", "Gala"
  theme: text("theme"), // e.g. "Winnie the Pooh", "Gatsby", "Boho Chic"
  vibeColors: text("vibe_colors"), // JSON string array of hex codes e.g. '["#E5A93C","#C93B2B","#5A8261","#F7E7C4"]'
  specialNeeds: text("special_needs"), // Dietary restrictions, noise limits, VIP asks, power needs
  notes: text("notes"),
  coverImageUrl: text("cover_image_url"),
  calendlyEventUri: text("calendly_event_uri"),
  linkedEventId: text("linked_event_id"), // If this event row (e.g. Calendly meeting) is linked to a main production event
  meetingSummary: text("meeting_summary"), // Summary of the conversation / briefing discussion
  meetingParticipants: text("meeting_participants"), // JSON array of participants who attended
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastUpdatedByUserId: text("last_updated_by_user_id"),
  lastUpdatedByName: text("last_updated_by_name"),
});

// 4.1 Action Items & Completion Checklist per Event or Meeting
export const eventTasks = sqliteTable("event_tasks", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
  meetingId: text("meeting_id").references(() => eventMeetings.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }),
  priority: text("priority", { enum: ["baixa", "media", "alta", "urgente"] }).default("media"),
  assignedTo: text("assigned_to"),
  orderIndex: integer("order_index").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 4.2 Event Media: Idea Boards & Final Outcomes (Before/After & Execution Photos)
export const eventMedia = sqliteTable("event_media", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  type: text("type", { enum: ["idea_board", "final_outcome"] }).notNull(), // 'idea_board' | 'final_outcome'
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  images: text("images"),
  comments: text("comments"), // JSON string array of MoodboardComment
  tag: text("tag"), // e.g. "Mesa de Honra", "Iluminação", "Flores", "Mobiliário", "Lounge"
  orderIndex: integer("order_index").default(0),
  uploadedByName: text("uploaded_by_name").default("Administrador CFM"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 4.3 Moodboard Comments & Collaborative Feedback
export const moodboardComments = sqliteTable("moodboard_comments", {
  id: text("id").primaryKey(),
  mediaId: text("media_id").references(() => eventMedia.id, { onDelete: "cascade" }).notNull(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id"),
  authorName: text("author_name").notNull().default("Equipa CFM"),
  content: text("content").notNull(),
  photoId: text("photo_id"),
  photoIndex: integer("photo_index"),
  photoLabel: text("photo_label"),
  photoUrl: text("photo_url"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 5. Temporal Stock Reservations (Prevents Double-Booking)
export const eventAllocations = sqliteTable("event_allocations", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  itemId: text("item_id").references(() => inventoryItems.id).notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status", { 
    enum: ["reservado", "despachado", "devolvido", "danificado"] 
  }).default("reservado").notNull(),
  notes: text("notes"),
});

// 5.1 Event Custom Items (Single-event bespoke items, added directly to event quota/budget)
export const eventCustomItems = sqliteTable("event_custom_items", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  category: text("category").default("Personalizado").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitCost: real("unit_cost").default(0).notNull(), // Internal CFM purchase/production cost
  unitPrice: real("unit_price").default(0).notNull(), // Price charged to customer in quota
  supplier: text("supplier"), // Supplier / manufacturer
  notes: text("notes"), // Dimensions, specifications, colors
  isConsumable: integer("is_consumable", { mode: "boolean" }).default(false).notNull(),
  boughtStatus: text("bought_status", { enum: ["pending", "bought"] }).default("pending").notNull(), // "pending" = por comprar, "bought" = adquirido & adicionado ao inventário
  convertedItemId: text("converted_item_id"), // ID of item created in inventory
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// 6. Commercial Quotes / Orçamentos
export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  quoteNumber: text("quote_number").unique().notNull(), // e.g. "ORC-2026-104"
  eventId: text("event_id").references(() => events.id),
  clientId: text("client_id").references(() => clients.id),
  accessToken: text("access_token").unique().notNull(), // Secret UUID for public approval URL
  status: text("status", { 
    enum: ["rascunho", "enviado", "aprovado", "recusado", "expirado"] 
  }).default("rascunho").notNull(),
  validityDays: integer("validity_days").default(15).notNull(),
  vatRate: real("vat_rate").default(23.0).notNull(), // Standard 23% in Portugal
  subtotal: real("subtotal").notNull(),
  vatAmount: real("vat_amount").notNull(),
  total: real("total").notNull(),
  signedAt: integer("signed_at", { mode: "timestamp" }),
  signatureData: text("signature_data"),
  approvedByIp: text("approved_by_ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastUpdatedByUserId: text("last_updated_by_user_id"),
  lastUpdatedByName: text("last_updated_by_name"),
});

// 7. Quote Itemized Lines
export const quoteLines = sqliteTable("quote_lines", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").references(() => quotes.id, { onDelete: "cascade" }).notNull(),
  itemId: text("item_id").references(() => inventoryItems.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

// 8. Financial Cash Flow Ledger (Movimentos)
export const financialMovements = sqliteTable("financial_movements", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["entrada", "saida", "investimento"] }).notNull(),
  category: text("category").notNull(), // "Evento", "Material / Stock", "Transporte", etc.
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  eventId: text("event_id").references(() => events.id),
  clientId: text("client_id").references(() => clients.id),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 9. Document & Media Attachments
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  eventId: text("event_id").references(() => events.id),
  clientId: text("client_id").references(() => clients.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 10. Quote Template Customization (Brand Settings)
export const quoteTemplates = sqliteTable("quote_templates", {
  id: text("id").primaryKey(),
  companyName: text("company_name").default("CFM EVENTS").notNull(),
  tagline: text("tagline").default("Produção & decoração de eventos"),
  contactInfo: text("contact_info").default("geral@cfmeventos.pt · +351 912 345 678"),
  paymentTerms: text("payment_terms").default("50% adjudicação · 50% na desmontagem"),
  footerNotes: text("footer_notes").default("Obrigado pela preferência."),
  brandColor: text("brand_color").default("#111111").notNull(),
  logoUrl: text("logo_url"),
});

// 11. Audit Logs / Histórico de Alterações
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type", { enum: ["event", "inventory", "quote", "user"] }).notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // "criado" | "atualizado" | "alterou_estado" | "triagem" | "alocou_material" | "removeu_material" | "tarefa" | "aprovado"
  title: text("title").notNull(),
  details: text("details"),
  userId: text("user_id").references(() => users.id),
  userName: text("user_name").notNull().default("Administrador CFM"),
  userEmail: text("user_email"),
  userRole: text("user_role"),
  changes: text("changes"), // JSON string
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 12. System Alerts & Notifications (Operational Intelligence & Snooze Engine)
export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint").unique().notNull(), // Unique rule identity: `${type}:${entityType}:${entityId}`
  type: text("type", { 
    enum: [
      "low_stock", 
      "damaged_stock", 
      "event_unprepared", 
      "payment_due", 
      "missing_completed_payment"
    ] 
  }).notNull(),
  entityType: text("entity_type", { 
    enum: ["inventory", "event", "quote", "client"] 
  }).notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity", { 
    enum: ["info", "warning", "urgent", "critical"] 
  }).default("warning").notNull(),
  status: text("status", { 
    enum: ["active", "snoozed", "acknowledged", "resolved"] 
  }).default("active").notNull(),
  metadata: text("metadata"), // JSON payload with contextual properties
  snoozedUntil: integer("snoozed_until", { mode: "timestamp" }),
  lastTriggeredAt: integer("last_triggered_at", { mode: "timestamp" }).notNull(),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
  acknowledgedByUserId: text("acknowledged_by_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 13. Third-party Integrations & OAuth Tokens (Calendly, etc.)
export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(), // e.g. "calendly"
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  userUri: text("user_uri"),
  organizationUri: text("organization_uri"),
  ownerName: text("owner_name"),
  ownerEmail: text("owner_email"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  syncStatus: text("sync_status"), // "idle" | "syncing" | "success" | "error"
  syncError: text("sync_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 14. Event Meetings (Google Meet & In-Person meetings with clients/stakeholders)
export const eventMeetings = sqliteTable("event_meetings", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id),
  title: text("title").notNull(),
  type: text("type", { enum: ["google_meet", "presencial", "outro"] }).default("google_meet").notNull(),
  status: text("status", { enum: ["agendada", "realizada", "cancelada"] }).default("agendada").notNull(),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }),
  location: text("location"), // In-person venue / address
  meetUrl: text("meet_url"),   // Google Meet link (e.g. "https://meet.google.com/cfm-xxx-yyy")
  notes: text("notes"),        // Agenda / discussion notes
  hostUserId: text("host_user_id").references(() => users.id),
  hostName: text("host_name").default("Equipa CFM"),
  clientContactName: text("client_contact_name"),
  clientContactEmail: text("client_contact_email"),
  clientContactPhone: text("client_contact_phone"),
  source: text("source", { enum: ["manual", "calendly", "linked"] }).default("manual").notNull(),
  calendlyUri: text("calendly_uri"),
  linkedEventRowId: text("linked_event_row_id"),
  meetingSummary: text("meeting_summary"),
  meetingParticipants: text("meeting_participants"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// 15. App Uploads Storage (for file uploads across serverless and local dev)
export const appUploads = sqliteTable("app_uploads", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  size: integer("size").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});


