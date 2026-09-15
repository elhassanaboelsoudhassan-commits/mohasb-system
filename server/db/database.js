const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
let dbPath = path.join(__dirname, '../../mohasb.db');

if (isVercel) {
  try {
    const tmpDbPath = path.join('/tmp', 'mohasb.db');
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, tmpDbPath);
    }
    if (fs.existsSync(tmpDbPath)) {
      dbPath = tmpDbPath;
    }
  } catch (e) {
    console.warn('Vercel DB copy warning:', e.message);
  }
}

let Database;
let db;
try {
  Database = require('better-sqlite3');
  db = new Database(dbPath);
  // تمكين المفاتيح الأجنبية ونمط الكتابة السريع
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('SQLite init warning (fallback mode):', err.message);
  db = {
    prepare: () => ({
      get: () => null,
      all: () => [],
      run: () => ({ changes: 0, lastInsertRowid: 0 })
    }),
    pragma: () => {},
    transaction: (fn) => fn,
    exec: () => {}
  };
}

function initDatabase() {
  const schema = `
    -- 1. جدول الشركات المشتركة (Multi-Tenant SaaS)
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'trial', -- trial, active, locked
      trial_ends_at TEXT,
      owner_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      cr_number TEXT,
      vat_number TEXT,
      enable_zatca INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. جدول المستخدمين والصلاحيات والكاشيرات
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE, -- NULL للمسؤول المطلق
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL, -- super_admin, tenant_owner, accountant, cashier
      branch_id INTEGER,
      is_active INTEGER DEFAULT 1,
      permissions TEXT, -- JSON: can_discount, max_discount, can_void, etc.
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. الفروع ومراكز التكلفة
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      cr_number TEXT,
      vat_number TEXT,
      address TEXT,
      city TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. المستودعات والمشاتل
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. شجرة الحسابات المرنة
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      type TEXT NOT NULL, -- asset, liability, equity, revenue, expense
      category TEXT NOT NULL,
      parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      is_sub INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. جهات التعامل (عملاء وموردين)
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- customer, vendor
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      vat_number TEXT,
      cr_number TEXT,
      address TEXT,
      balance REAL DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. دفتر القيود اليومية الآلية
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      entry_number TEXT NOT NULL,
      date TEXT NOT NULL,
      branch_id INTEGER REFERENCES branches(id),
      reference_type TEXT, -- sales, purchase, expense, salary, damage, annual_count, manual, transfer
      reference_id INTEGER,
      narration TEXT,
      total_debit REAL NOT NULL DEFAULT 0.00,
      total_credit REAL NOT NULL DEFAULT 0.00,
      created_by TEXT DEFAULT 'محرك القيود الآلي',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- سطور القيود
    CREATE TABLE IF NOT EXISTS journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES accounts(id),
      branch_id INTEGER REFERENCES branches(id),
      debit REAL NOT NULL DEFAULT 0.00,
      credit REAL NOT NULL DEFAULT 0.00,
      description TEXT
    );

    -- 8. الأصناف والمنتجات الزراعية والمشاتل
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      barcode TEXT,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      category TEXT, -- شتلات زهور، أشجار مثمرة، أسمدة، شبكات ري، أدوات
      unit TEXT DEFAULT 'شتلة',
      cost_price REAL NOT NULL DEFAULT 0.00,
      retail_price REAL NOT NULL DEFAULT 0.00,
      wholesale_price REAL NOT NULL DEFAULT 0.00,
      selling_price REAL NOT NULL DEFAULT 0.00, -- Default selling price
      tax_rate REAL DEFAULT 0.15,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- أرصدة المخزون
    CREATE TABLE IF NOT EXISTS inventory_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
      branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 0.00,
      min_alert_quantity REAL DEFAULT 5.00,
      UNIQUE(product_id, warehouse_id)
    );

    -- حركات المخزون
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      branch_id INTEGER REFERENCES branches(id),
      warehouse_id INTEGER REFERENCES warehouses(id),
      product_id INTEGER REFERENCES products(id),
      type TEXT NOT NULL, -- in, out, transfer_in, transfer_out, damage, adjustment, annual_count
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      reference_id TEXT,
      notes TEXT
    );

    -- 9. جلسات الجرد السنوي لمطابقة الفعلي بالدفتري
    CREATE TABLE IF NOT EXISTS inventory_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      count_number TEXT NOT NULL,
      branch_id INTEGER REFERENCES branches(id),
      warehouse_id INTEGER REFERENCES warehouses(id),
      count_date TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'draft', -- draft, posted
      total_variance_qty REAL DEFAULT 0.00,
      total_variance_cost REAL DEFAULT 0.00,
      journal_entry_number TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- بنود الجرد السنوي
    CREATE TABLE IF NOT EXISTS inventory_count_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_id INTEGER REFERENCES inventory_counts(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      book_quantity REAL NOT NULL,
      actual_quantity REAL NOT NULL,
      variance_quantity REAL NOT NULL, -- actual - book
      unit_cost REAL NOT NULL,
      variance_cost REAL NOT NULL, -- variance_qty * unit_cost
      notes TEXT
    );

    -- 10. فواتير المبيعات ونقاط البيع (POS & ZATCA 2)
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      invoice_type TEXT NOT NULL DEFAULT 'simplified_invoice', -- tax_invoice, simplified_invoice
      branch_id INTEGER REFERENCES branches(id),
      warehouse_id INTEGER REFERENCES warehouses(id),
      customer_id INTEGER REFERENCES contacts(id),
      cashier_id INTEGER REFERENCES users(id),
      issue_date TEXT NOT NULL,
      issue_time TEXT NOT NULL,
      payment_method TEXT DEFAULT 'cash', -- cash, card, transfer, credit
      price_tier TEXT DEFAULT 'retail', -- retail (تجزئة) or wholesale (جملة)
      subtotal REAL NOT NULL DEFAULT 0.00,
      discount REAL DEFAULT 0.00,
      vat_total REAL NOT NULL DEFAULT 0.00,
      grand_total REAL NOT NULL DEFAULT 0.00,
      zatca_status TEXT DEFAULT 'draft', -- draft, reported, cleared, rejected
      zatca_uuid TEXT,
      zatca_hash TEXT,
      zatca_qr TEXT,
      zatca_xml TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER REFERENCES sales_invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0.00,
      vat_rate REAL DEFAULT 0.15,
      vat_amount REAL NOT NULL,
      line_total REAL NOT NULL
    );

    -- 11. فواتير المشتريات
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      branch_id INTEGER REFERENCES branches(id),
      warehouse_id INTEGER REFERENCES warehouses(id),
      vendor_id INTEGER REFERENCES contacts(id),
      invoice_date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'credit',
      subtotal REAL NOT NULL,
      vat_total REAL NOT NULL,
      grand_total REAL NOT NULL,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      vat_rate REAL DEFAULT 0.15,
      vat_amount REAL NOT NULL,
      line_total REAL NOT NULL
    );

    -- 12. المصروفات وتتبع الصرف
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      expense_number TEXT NOT NULL,
      branch_id INTEGER REFERENCES branches(id),
      account_id INTEGER REFERENCES accounts(id),
      cost_center_id INTEGER REFERENCES cost_centers(id),
      expense_type TEXT NOT NULL, -- operating, admin, general
      amount REAL NOT NULL,
      vat_amount REAL DEFAULT 0.00,
      total_amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      paid_to TEXT,
      responsible_person TEXT NOT NULL,
      date TEXT NOT NULL,
      receipt_ref TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. تذاكر الدعم الفني والشكاوى
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      ticket_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT DEFAULT 'technical', -- technical, billing, inquiry, complaint
      priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
      status TEXT DEFAULT 'open', -- open, in_progress, resolved, closed
      created_by_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ticket_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL, -- tenant, super_admin
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. مراكز التكلفة
    CREATE TABLE IF NOT EXISTS cost_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      type TEXT DEFAULT 'greenhouse', -- greenhouse, branch, department, project
      budget REAL DEFAULT 0.00,
      parent_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. شؤون الموظفين والرواتب
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      branch_id INTEGER REFERENCES branches(id),
      employee_number TEXT NOT NULL,
      name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      national_id TEXT,
      phone TEXT,
      email TEXT,
      basic_salary REAL NOT NULL DEFAULT 0.00,
      housing_allowance REAL DEFAULT 0.00,
      transport_allowance REAL DEFAULT 0.00,
      other_allowances REAL DEFAULT 0.00,
      bank_name TEXT,
      iban TEXT,
      status TEXT DEFAULT 'active', -- active, on_leave, terminated
      join_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payroll_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      title TEXT NOT NULL,
      total_basic REAL DEFAULT 0.00,
      total_allowances REAL DEFAULT 0.00,
      total_deductions REAL DEFAULT 0.00,
      total_net REAL DEFAULT 0.00,
      journal_entry_number TEXT,
      status TEXT DEFAULT 'draft', -- draft, approved, paid
      payment_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payroll_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
      employee_id INTEGER REFERENCES employees(id),
      basic_salary REAL NOT NULL,
      allowances REAL DEFAULT 0.00,
      deductions REAL DEFAULT 0.00,
      net_salary REAL NOT NULL,
      notes TEXT
    );

    -- 16. طلبات التوصيل والشحن
    CREATE TABLE IF NOT EXISTS delivery_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      invoice_id INTEGER REFERENCES sales_invoices(id),
      branch_id INTEGER REFERENCES branches(id),
      order_number TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      recipient_city TEXT NOT NULL,
      recipient_address TEXT NOT NULL,
      delivery_fee REAL DEFAULT 0.00,
      courier_name TEXT,
      tracking_number TEXT,
      status TEXT DEFAULT 'preparing', -- preparing, out_for_delivery, delivered, cancelled
      notes TEXT,
      delivered_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. التصنيع وتكلفة الإنتاج (BOM)
    CREATE TABLE IF NOT EXISTS bom_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      output_product_id INTEGER REFERENCES products(id),
      recipe_code TEXT NOT NULL,
      name TEXT NOT NULL,
      output_quantity REAL DEFAULT 1.0,
      labor_cost REAL DEFAULT 0.00,
      overhead_cost REAL DEFAULT 0.00,
      total_unit_cost REAL DEFAULT 0.00,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bom_recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER REFERENCES bom_recipes(id) ON DELETE CASCADE,
      input_product_id INTEGER REFERENCES products(id),
      quantity_required REAL NOT NULL,
      unit TEXT,
      unit_cost REAL DEFAULT 0.00
    );

    CREATE TABLE IF NOT EXISTS production_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      order_number TEXT NOT NULL,
      recipe_id INTEGER REFERENCES bom_recipes(id),
      output_product_id INTEGER REFERENCES products(id),
      target_quantity REAL NOT NULL,
      produced_quantity REAL DEFAULT 0.0,
      warehouse_id INTEGER REFERENCES warehouses(id),
      cost_center_id INTEGER REFERENCES cost_centers(id),
      total_cost REAL DEFAULT 0.00,
      unit_cost REAL DEFAULT 0.00,
      journal_entry_number TEXT,
      status TEXT DEFAULT 'draft', -- draft, in_progress, completed, cancelled
      start_date TEXT,
      completed_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. النسخ الاحتياطي
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      backup_type TEXT DEFAULT 'manual', -- automated_daily, manual
      checksum TEXT,
      status TEXT DEFAULT 'success',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. سجل حركات الدخول والتنبيهات الحية للمسؤول السوبر
    CREATE TABLE IF NOT EXISTS login_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      tenant_id INTEGER,
      tenant_name TEXT,
      ip_address TEXT,
      user_agent TEXT,
      login_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 20. العملاء وبيانات الاتصال والضريبة
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      vat_number TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 21. التحويلات المخزنية بين الفروع والمستودعات
    CREATE TABLE IF NOT EXISTS inventory_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      transfer_number TEXT NOT NULL,
      source_branch_id INTEGER REFERENCES branches(id),
      source_warehouse_id INTEGER REFERENCES warehouses(id),
      dest_branch_id INTEGER REFERENCES branches(id),
      dest_warehouse_id INTEGER REFERENCES warehouses(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT,
      quantity REAL NOT NULL,
      status TEXT DEFAULT 'in_transit', -- in_transit, received, cancelled
      driver_name TEXT,
      vehicle_plate TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      received_at DATETIME
    );

    -- 22. ورديات الكاشير وجرد الخزينة (POS Shifts)
    CREATE TABLE IF NOT EXISTS pos_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      branch_id INTEGER REFERENCES branches(id),
      cashier_id INTEGER REFERENCES users(id),
      cashier_name TEXT NOT NULL,
      shift_number TEXT NOT NULL,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      opening_balance REAL DEFAULT 0.00,
      cash_sales REAL DEFAULT 0.00,
      card_sales REAL DEFAULT 0.00,
      credit_sales REAL DEFAULT 0.00,
      total_sales REAL DEFAULT 0.00,
      expenses_amount REAL DEFAULT 0.00,
      expected_cash REAL DEFAULT 0.00,
      actual_cash REAL DEFAULT 0.00,
      difference REAL DEFAULT 0.00,
      status TEXT DEFAULT 'open', -- open, closed
      notes TEXT
    );

    -- 23. السندات المالية (سندات القبض والصرف)
    CREATE TABLE IF NOT EXISTS financial_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      branch_id INTEGER REFERENCES branches(id),
      voucher_number TEXT NOT NULL,
      type TEXT NOT NULL, -- payment (صرف), receipt (قبض)
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      party_name TEXT NOT NULL, -- اسم المستلم / المدفوع له
      category TEXT NOT NULL, -- إيجارات، كهرباء، سداد مورد، صيانة، إلخ
      payment_method TEXT DEFAULT 'cash', -- cash, bank_transfer, mada
      debit_account_id INTEGER REFERENCES accounts(id),
      credit_account_id INTEGER REFERENCES accounts(id),
      journal_entry_id INTEGER REFERENCES journal_entries(id),
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(schema);

  // تحديثات الأعمدة في حال كانت قاعدة البيانات منشأة مسبقاً
  const safeMigrations = [
    "ALTER TABLE tenants ADD COLUMN bank_account TEXT DEFAULT '3165002243921500013'",
    "ALTER TABLE tenants ADD COLUMN zatca_env TEXT DEFAULT 'sandbox'",
    "ALTER TABLE tenants ADD COLUMN zatca_csid TEXT",
    "ALTER TABLE tenants ADD COLUMN zatca_status TEXT DEFAULT 'ready'",
    "ALTER TABLE sales_invoices ADD COLUMN customer_name TEXT",
    "ALTER TABLE sales_invoices ADD COLUMN customer_phone TEXT",
    "ALTER TABLE sales_invoices ADD COLUMN customer_vat TEXT",
    "ALTER TABLE sales_invoices ADD COLUMN bank_account_used TEXT",
    "ALTER TABLE sales_invoices ADD COLUMN shift_id INTEGER",
    "ALTER TABLE products ADD COLUMN is_central INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN image_url TEXT",
    "ALTER TABLE branches ADD COLUMN manager_name TEXT",
    "ALTER TABLE branches ADD COLUMN is_main INTEGER DEFAULT 0"
  ];
  for (const sql of safeMigrations) {
    try { db.exec(sql); } catch(e) {}
  }

  seedInitialData();

  const allTenants = db.prepare('SELECT id FROM tenants').all();
  for (const t of allTenants) {
    let b = db.prepare('SELECT id FROM branches WHERE tenant_id = ? LIMIT 1').get(t.id);
    let w = db.prepare('SELECT id FROM warehouses WHERE tenant_id = ? LIMIT 1').get(t.id);
    if (!b) {
      const insB = db.prepare("INSERT INTO branches (tenant_id, code, name_ar, city) VALUES (?, 'BR-MAIN', 'فرع المشتل الرئيسي', 'الرياض')");
      b = { id: insB.run(t.id).lastInsertRowid };
    }
    if (!w) {
      const insW = db.prepare("INSERT INTO warehouses (tenant_id, branch_id, code, name_ar) VALUES (?, ?, 'WH-MAIN', 'المستودع الرئيسي للشتلات')");
      w = { id: insW.run(t.id, b.id).lastInsertRowid };
    }
    seedEnterpriseData(t.id, b.id, w.id);
  }
}

function seedInitialData() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get();
  if (userCount.count > 0) return;

  // 1. زرع حساب المسؤول المطلق (Super Admin) الوحيد للنظام
  const insertUser = db.prepare(`
    INSERT INTO users (tenant_id, name, email, username, password, role, is_active, permissions)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  insertUser.run(
    null, // لا يتبع شركة معينة بل يدير كل المنظومة
    'الحسن السعودي (المسؤول المطلق)',
    'elhassanelsoudy@gmail.com',
    'elhassanelsoudy@gmail.com',
    'hassan@2016',
    'super_admin',
    JSON.stringify({ all: true, super_admin: true })
  );

  // 2. زرع الشركة النموذجية الأولى (شركة ومشاتل الصويان الزراعية)
  const insertTenant = db.prepare(`
    INSERT INTO tenants (name_ar, name_en, code, status, trial_ends_at, owner_name, email, phone, cr_number, vat_number, enable_zatca)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const t1 = insertTenant.run(
    'شركة ومشاتل الصويان الزراعية',
    'Al-Suwayan Agricultural & Nurseries Co.',
    'AL-SUWAYAN',
    'active',
    '2030-12-31',
    'فهد الصويان',
    'owner@al-suwayan.sa',
    '0501234567',
    '1010892341',
    '310984752000003',
    1
  ).lastInsertRowid;

  // شركة ثانية تحت التجربة لاختبار إدارة المشتركين
  const t2 = insertTenant.run(
    'مؤسسة واحة النخيل للتنمية الزراعية',
    'Palm Oasis Agricultural Est.',
    'PALM-OASIS',
    'trial',
    '2026-09-30',
    'سلطان الغامدي',
    'sultan@palmoasis.sa',
    '0558889900',
    '4030554433',
    '310555777800003',
    0
  ).lastInsertRowid;

  // 3. حسابات مستخدمي الشركة 1 (مالك، محاسب، كاشيرات)
  insertUser.run(
    t1,
    'فهد الصويان (مالك المنشأة)',
    'owner@al-suwayan.sa',
    'fahad_owner',
    'hassan@2016',
    'tenant_owner',
    JSON.stringify({ can_edit_settings: true, can_view_reports: true, can_manage_pos: true })
  );

  // كاشير 1 (صالة عرض الرياض)
  const cashier1Id = insertUser.run(
    t1,
    'محمد الشمري (كاشير صالة الرياض)',
    'cashier1@al-suwayan.sa',
    'cashier1',
    'hassan@2016',
    'cashier',
    JSON.stringify({ can_discount: true, max_discount: 10, can_void: false })
  ).lastInsertRowid;

  // كاشير 2 (مشتل جدة)
  insertUser.run(
    t1,
    'سالم الحربي (كاشير مشتل جدة)',
    'cashier2@al-suwayan.sa',
    'cashier2',
    'hassan@2016',
    'cashier',
    JSON.stringify({ can_discount: true, max_discount: 5, can_void: false })
  );

  // حساب مالك الشركة التجريبية (واحة النخيل)
  insertUser.run(
    t2,
    'سلطان الغامدي (مالك واحة النخيل)',
    'sultan@palmoasis.sa',
    'sultan_owner',
    'hassan@2016',
    'tenant_owner',
    JSON.stringify({ can_edit_settings: true, can_view_reports: true, can_manage_pos: true })
  );

  // 4. الفروع والمستودعات للشركة 1
  const insertBranch = db.prepare(`
    INSERT INTO branches (tenant_id, code, name_ar, name_en, cr_number, vat_number, address, city, phone, email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const b1 = insertBranch.run(t1, 'BR-101', 'مشتل وصالة الرياض الرئيسية', 'Riyadh Main Nursery', '1010892341', '310984752000003', 'طريق الملك فهد، العليا', 'الرياض', '0112345678', 'riyadh@al-suwayan.sa').lastInsertRowid;
  const b2 = insertBranch.run(t1, 'BR-102', 'مشتل جدة الإقليمي', 'Jeddah Regional Nursery', '4030789123', '310984752000003', 'طريق مكة القديم، كيلو 14', 'جدة', '0129876543', 'jeddah@al-suwayan.sa').lastInsertRowid;
  const b3 = insertBranch.run(t1, 'BR-103', 'مشتل الدمام والشرقية', 'Dammam Nursery', '2050123456', '310984752000003', 'طريق أبو حدرية، سيهات', 'الدمام', '0138765432', 'dammam@al-suwayan.sa').lastInsertRowid;

  // ربط الكاشير 1 بفرع الرياض
  db.prepare('UPDATE users SET branch_id = ? WHERE id = ?').run(b1, cashier1Id);

  const insertWarehouse = db.prepare(`
    INSERT INTO warehouses (tenant_id, branch_id, code, name_ar, address)
    VALUES (?, ?, ?, ?, ?)
  `);

  const w1 = insertWarehouse.run(t1, b1, 'WH-RYD-01', 'مستودع المشتل المركزي - الرياض', 'طريق صلبوخ، الرياض').lastInsertRowid;
  const w2 = insertWarehouse.run(t1, b1, 'WH-RYD-02', 'مستودع صالة البيع السريع - العليا', 'صالة العرض').lastInsertRowid;
  const w3 = insertWarehouse.run(t1, b2, 'WH-JED-01', 'مستودع مشتل جدة', 'طريق مكة القديم').lastInsertRowid;
  const w4 = insertWarehouse.run(t1, b3, 'WH-DMM-01', 'مستودع مشتل الدمام', 'سيهات').lastInsertRowid;

  // 5. شجرة الحسابات للشركة 1
  const insertAccount = db.prepare(`
    INSERT INTO accounts (tenant_id, code, name_ar, name_en, type, category, parent_id, is_sub)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // الأصول
  const a1 = insertAccount.run(t1, '1', 'الأصول', 'Assets', 'asset', 'root', null, 0).lastInsertRowid;
  const a11 = insertAccount.run(t1, '11', 'الأصول المتداولة', 'Current Assets', 'asset', 'current_asset', a1, 0).lastInsertRowid;
  const a111 = insertAccount.run(t1, '111', 'النقد وما في حكمه (صناديق الكاشير)', 'Cash and Cash Equivalents', 'asset', 'current_asset', a11, 0).lastInsertRowid;
  insertAccount.run(t1, '1111', 'صندوق كاشير صالة الرياض', 'Riyadh POS Cash', 'asset', 'current_asset', a111, 1);
  insertAccount.run(t1, '1112', 'صندوق كاشير مشتل جدة', 'Jeddah POS Cash', 'asset', 'current_asset', a111, 1);
  insertAccount.run(t1, '1113', 'صندوق كاشير مشتل الدمام', 'Dammam POS Cash', 'asset', 'current_asset', a111, 1);

  const a112 = insertAccount.run(t1, '112', 'البنوك والشبكات (مدى)', 'Banks & POS Terminals', 'asset', 'current_asset', a11, 0).lastInsertRowid;
  insertAccount.run(t1, '1121', 'مصرف الراجحي - شبكات نقاط البيع', 'Al Rajhi POS Bank', 'asset', 'current_asset', a112, 1);
  insertAccount.run(t1, '1122', 'البنك الأهلي السعودي - الحساب الجاري', 'SNB Current Account', 'asset', 'current_asset', a112, 1);

  const a113 = insertAccount.run(t1, '113', 'المدينون والعملاء (حسابات القبض)', 'Accounts Receivable', 'asset', 'current_asset', a11, 1).lastInsertRowid;

  const a114 = insertAccount.run(t1, '114', 'المخزون السلعي والنباتي', 'Nursery & Goods Inventory', 'asset', 'current_asset', a11, 0).lastInsertRowid;
  insertAccount.run(t1, '1141', 'مخزون شتلات ومزروعات الرياض', 'Riyadh Nursery Stock', 'asset', 'current_asset', a114, 1);
  insertAccount.run(t1, '1142', 'مخزون مشتل جدة', 'Jeddah Nursery Stock', 'asset', 'current_asset', a114, 1);
  insertAccount.run(t1, '1143', 'مخزون مشتل الدمام', 'Dammam Nursery Stock', 'asset', 'current_asset', a114, 1);

  insertAccount.run(t1, '115', 'ضريبة القيمة المضافة المدخلات (المشتريات)', 'Input VAT', 'asset', 'current_asset', a11, 1);

  const a12 = insertAccount.run(t1, '12', 'الأصول غير المتداولة (الثابتة)', 'Fixed Assets', 'asset', 'fixed_asset', a1, 0).lastInsertRowid;
  insertAccount.run(t1, '121', 'البيوت المحمية وشبكات الري الزراعية', 'Greenhouses & Irrigation Systems', 'asset', 'fixed_asset', a12, 1);
  insertAccount.run(t1, '122', 'شاحنات نقل وتوزيع المزروعات', 'Nursery Trucks', 'asset', 'fixed_asset', a12, 1);

  // الخصوم
  const a2 = insertAccount.run(t1, '2', 'الخصوم والالتزامات', 'Liabilities', 'liability', 'root', null, 0).lastInsertRowid;
  const a21 = insertAccount.run(t1, '21', 'الخصوم المتداولة', 'Current Liabilities', 'liability', 'current_liability', a2, 0).lastInsertRowid;
  insertAccount.run(t1, '211', 'الدائنون والموردون (موردي الشتلات والأسمدة)', 'Accounts Payable', 'liability', 'current_liability', a21, 1);
  insertAccount.run(t1, '212', 'ضريبة القيمة المضافة المخرجات (المبيعات)', 'Output VAT', 'liability', 'current_liability', a21, 1);
  insertAccount.run(t1, '213', 'مستحقات رواتب عمال المشاتل', 'Accrued Wages', 'liability', 'current_liability', a21, 1);

  // حقوق الملكية
  const a3 = insertAccount.run(t1, '3', 'حقوق الملكية', 'Equity', 'equity', 'root', null, 0).lastInsertRowid;
  insertAccount.run(t1, '31', 'رأس المال المدفوع للمشتل', 'Paid-in Capital', 'equity', 'equity', a3, 1);
  insertAccount.run(t1, '32', 'الأرباح المحتجزة / المبقاة', 'Retained Earnings', 'equity', 'equity', a3, 1);

  // الإيرادات
  const a4 = insertAccount.run(t1, '4', 'الإيرادات', 'Revenue', 'revenue', 'root', null, 0).lastInsertRowid;
  const a41 = insertAccount.run(t1, '41', 'إيرادات المبيعات الزراعية', 'Agricultural Sales Revenue', 'revenue', 'operating_revenue', a4, 0).lastInsertRowid;
  insertAccount.run(t1, '4101', 'مبيعات كاشير صالة الرياض', 'Sales Riyadh POS', 'revenue', 'operating_revenue', a41, 1);
  insertAccount.run(t1, '4102', 'مبيعات كاشير مشتل جدة', 'Sales Jeddah POS', 'revenue', 'operating_revenue', a41, 1);
  insertAccount.run(t1, '4103', 'مبيعات كاشير مشتل الدمام', 'Sales Dammam POS', 'revenue', 'operating_revenue', a41, 1);
  insertAccount.run(t1, '42', 'مردودات مبيعات الشتلات', 'Plant Sales Returns', 'revenue', 'operating_revenue', a4, 1);

  // المصروفات
  const a5 = insertAccount.run(t1, '5', 'المصروفات', 'Expenses', 'expense', 'root', null, 0).lastInsertRowid;
  insertAccount.run(t1, '51', 'تكلفة البضاعة والشتلات المباعة (COGS)', 'Cost of Plants Sold', 'expense', 'cogs', a5, 1);
  
  const a52 = insertAccount.run(t1, '52', 'المصروفات التشغيلية للمشاتل', 'Nursery Operating Expenses', 'expense', 'operating_expense', a5, 0).lastInsertRowid;
  insertAccount.run(t1, '5201', 'إيجارات أراضي المشاتل والمستودعات', 'Land & Greenhouse Rent', 'expense', 'operating_expense', a52, 1);
  insertAccount.run(t1, '5202', 'مياه ري الآبار والكهرباء الزراعية', 'Irrigation Water & Power', 'expense', 'operating_expense', a52, 1);
  insertAccount.run(t1, '5203', 'مبيدات حشرية وفطرية ووقاية نبات', 'Pesticides & Plant Care', 'expense', 'operating_expense', a52, 1);

  const a53 = insertAccount.run(t1, '53', 'المصروفات الإدارية والعمومية', 'General & Admin Expenses', 'expense', 'admin_expense', a5, 0).lastInsertRowid;
  insertAccount.run(t1, '5301', 'رواتب المهندسين الزراعيين والعمال', 'Salaries & Labor Wages', 'expense', 'admin_expense', a53, 1);
  insertAccount.run(t1, '5302', 'الاستضافة السحابية وتراخيص النظام', 'Cloud SaaS Subscription', 'expense', 'admin_expense', a53, 1);
  insertAccount.run(t1, '54', 'توالف وموت الشتلات (عجز المخزون)', 'Plant Spoilage & Shrinkage Loss', 'expense', 'operating_expense', a5, 1);
  insertAccount.run(t1, '55', 'فروقات وفائض الجرد السنوي', 'Annual Inventory Reconciliation Variance', 'revenue', 'operating_revenue', a4, 1);

  // 6. عملاء وموردين للمشتل
  const insertContact = db.prepare(`
    INSERT INTO contacts (tenant_id, type, name, phone, email, vat_number, cr_number, address, balance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertContact.run(t1, 'customer', 'مؤسسة الحدائق الخضراء للمقاولات', '0501112233', 'info@green-gardens.sa', '310123456700003', '1010567890', 'حي النخيل، الرياض', 18500.00);
  insertContact.run(t1, 'customer', 'شركة روابي نجد للتشجير', '0554445566', 'sales@rawabi-najd.sa', '310987654300003', '1010678901', 'طريق التخصصي، الرياض', 12300.00);
  insertContact.run(t1, 'customer', 'عميل نقدي تجزئة (POS)', '0590000000', null, null, null, 'مبيعات الكاشير المباشرة', 0.00);

  insertContact.run(t1, 'vendor', 'شركة البذور والأسمدة الهولندية الحديثة', '0114567890', 'orders@seeds-fertilizer.sa', '310222333400003', '1010345678', 'المدينة الصناعية الثانية', -45000.00);
  insertContact.run(t1, 'vendor', 'مزارع أصول الجنوب لإنتاج الشتلات', '0126789012', 'sales@south-plants.sa', '310555666700003', '4030234567', 'جازان - بيش', -28000.00);

  // 7. الأصناف الزراعية المتخصصة للمشاتل (تكويد كامل مع أسعار الجملة والتجزئة)
  const insertProduct = db.prepare(`
    INSERT INTO products (tenant_id, sku, barcode, name_ar, name_en, category, unit, cost_price, retail_price, wholesale_price, selling_price, tax_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.15)
  `);

  const p1 = insertProduct.run(t1, 'PLANT-101', '6282001001', 'شتلة بتونيا هولندية مزهرة ألوان مشكلة', 'Dutch Petunia Seedling Flower', 'شتلات زهور', 'شتلة', 3.50, 8.00, 5.50, 8.00).lastInsertRowid;
  const p2 = insertProduct.run(t1, 'PLANT-102', '6282001002', 'شتلة ياسمين عراقي عطري متسلق أصيص 25 سم', 'Climbing Fragrant Jasmine Plant', 'نباتات متسلقة', 'شتلة', 15.00, 35.00, 25.00, 35.00).lastInsertRowid;
  const p3 = insertProduct.run(t1, 'PLANT-103', '6282001003', 'شتلة زيتون إسباني مروي نخب أول طول مترين', 'Spanish Olive Tree Seedling 2m', 'أشجار مثمرة', 'شجرة', 120.00, 250.00, 190.00, 250.00).lastInsertRowid;
  const p4 = insertProduct.run(t1, 'PLANT-104', '6282001004', 'شتلة لافندر فرنسي عطري طارد للحشرات', 'French Lavender Herb Plant', 'نباتات عطرية', 'شتلة', 8.00, 18.00, 12.00, 18.00).lastInsertRowid;
  const p5 = insertProduct.run(t1, 'FERT-201', '6282002001', 'سماد داب مركب نتروجين/فوسفات 18-46-0 كيس 50 كجم', 'DAP Compound Fertilizer 18-46-0 50kg', 'أسمدة ومخصبات', 'كيس', 140.00, 220.00, 180.00, 220.00).lastInsertRowid;
  const p6 = insertProduct.run(t1, 'SOIL-301', '6282003001', 'بيتموس عضوي مخصب نخب أول بالة 300 لتر', 'Organic Peat Moss Bale 300L', 'تربة زراعية', 'بالة', 65.00, 110.00, 85.00, 110.00).lastInsertRowid;
  const p7 = insertProduct.run(t1, 'IRR-401', '6282004001', 'لفة لي تنقيط زراعي GR مقاس 16 مم طول 400 متر', 'GR Drip Irrigation Pipe 16mm 400m', 'شبكات ري', 'لفة', 110.00, 175.00, 145.00, 175.00).lastInsertRowid;
  const p8 = insertProduct.run(t1, 'TOOL-501', '6282005001', 'مقص تقليم وتطعيم أشجار فولاذي ياباني أصلي Pro', 'Professional Japanese Pruning Shears', 'أدوات زراعية', 'قطعة', 45.00, 85.00, 65.00, 85.00).lastInsertRowid;

  // إيداع كميات المخزون في مستودعات ومشتل الرياض وجدة والدمام
  const insertInv = db.prepare(`
    INSERT INTO inventory_levels (tenant_id, product_id, warehouse_id, branch_id, quantity, min_alert_quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertInv.run(t1, p1, w1, b1, 650, 50);
  insertInv.run(t1, p1, w2, b1, 120, 20);
  insertInv.run(t1, p1, w3, b2, 350, 40);

  insertInv.run(t1, p2, w1, b1, 280, 30);
  insertInv.run(t1, p2, w2, b1, 60, 15);
  insertInv.run(t1, p2, w3, b2, 140, 20);

  insertInv.run(t1, p3, w1, b1, 95, 10);
  insertInv.run(t1, p3, w3, b2, 45, 5);
  insertInv.run(t1, p3, w4, b3, 30, 5);

  insertInv.run(t1, p4, w1, b1, 400, 40);
  insertInv.run(t1, p4, w2, b1, 90, 15);

  insertInv.run(t1, p5, w1, b1, 150, 25);
  insertInv.run(t1, p5, w3, b2, 60, 15);

  insertInv.run(t1, p6, w1, b1, 180, 20);
  insertInv.run(t1, p6, w2, b1, 40, 10);

  insertInv.run(t1, p7, w1, b1, 85, 10);
  insertInv.run(t1, p8, w2, b1, 45, 8);

  // 8. قيود افتتاحية موزونة للمشتل
  const insertJE = db.prepare(`
    INSERT INTO journal_entries (tenant_id, entry_number, date, branch_id, reference_type, narration, total_debit, total_credit, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertJL = db.prepare(`
    INSERT INTO journal_lines (tenant_id, entry_id, account_id, branch_id, debit, credit, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const je1 = insertJE.run(t1, 'JE-2026-0001', '2026-01-01', b1, 'manual', 'إثبات رأس المال التأسيسي للمشتل وتغذية الصناديق والبنوك', 600000.00, 600000.00, 'المدير المالي').lastInsertRowid;
  
  const accRajhi = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1121'").get(t1).id;
  const accCash1 = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1111'").get(t1).id;
  const accCash2 = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1112'").get(t1).id;
  const accCapital = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '31'").get(t1).id;

  insertJL.run(t1, je1, accRajhi, b1, 450000.00, 0.00, 'إيداع بنكي - مصرف الراجحي');
  insertJL.run(t1, je1, accCash1, b1, 75000.00, 0.00, 'تغذية صندوق كاشير صالة الرياض');
  insertJL.run(t1, je1, accCash2, b2, 75000.00, 0.00, 'تغذية صندوق كاشير مشتل جدة');
  insertJL.run(t1, je1, accCapital, b1, 0.00, 600000.00, 'رأس مال مشاتل الصويان المصرح به');

  seedEnterpriseData(t1, b1, w1);
}

function seedEnterpriseData(t1, b1, w1) {
  // مراكز التكلفة
  const ccCount = db.prepare('SELECT count(*) as cnt FROM cost_centers WHERE tenant_id = ?').get(t1).cnt;
  if (ccCount === 0) {
    const insCC = db.prepare('INSERT INTO cost_centers (tenant_id, code, name_ar, name_en, type, budget) VALUES (?, ?, ?, ?, ?, ?)');
    insCC.run(t1, 'CC-101', 'صوبة الشتلات والزهور الملكية', 'Royal Flower Greenhouse', 'greenhouse', 85000.00);
    insCC.run(t1, 'CC-102', 'مشتل أشجار الظل والنخيل', 'Palm & Shade Trees Nursery', 'greenhouse', 120000.00);
    insCC.run(t1, 'CC-103', 'خط التجهيز والتغليف الزراعي', 'Agricultural Packaging Line', 'project', 45000.00);
  }

  // الموظفين والرواتب
  const empCount = db.prepare('SELECT count(*) as cnt FROM employees WHERE tenant_id = ?').get(t1).cnt;
  if (empCount === 0) {
    const insEmp = db.prepare(`
      INSERT INTO employees (tenant_id, branch_id, employee_number, name, role_title, national_id, phone, email, basic_salary, housing_allowance, transport_allowance, bank_name, iban, status, join_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '2025-01-15')
    `);
    insEmp.run(t1, b1, 'EMP-01', 'م. عبد الرحمن التميمي', 'مدير المشاتل والإنتاج', '1088776655', '0501112233', 'tamimi@al-suwayan.sa', 8500.00, 2125.00, 850.00, 'مصرف الراجحي', 'SA0380000123456789012345');
    insEmp.run(t1, b1, 'EMP-02', 'خالد العتيبي', 'محاسب مالي معتمد', '1099887766', '0502223344', 'otibi@al-suwayan.sa', 6500.00, 1625.00, 650.00, 'البنك الأهلي', 'SA0310000987654321098765');
    insEmp.run(t1, b1, 'EMP-03', 'محمد الشمري', 'مسؤول كاشير ومبيعات', '1077665544', '0503334455', 'shammari@al-suwayan.sa', 4500.00, 1125.00, 450.00, 'مصرف الإنماء', 'SA0305000555444333222111');
  }

  // تركيب الأصناف (BOM) وأوامر الإنتاج
  const bomCount = db.prepare('SELECT count(*) as cnt FROM bom_recipes WHERE tenant_id = ?').get(t1).cnt;
  if (bomCount === 0) {
    const insBOM = db.prepare(`
      INSERT INTO bom_recipes (tenant_id, output_product_id, recipe_code, name, output_quantity, labor_cost, overhead_cost, total_unit_cost, notes)
      VALUES (?, 1, 'BOM-PET-100', 'إنتاج صينية 100 شتلة بتونيا هولندية مزهرة', 100, 20.00, 10.00, 1.45, 'تتضمن استهلاك بذور وهرمون تجذير وتربة بيتموس وسماد')
    `);
    const recipeId = insBOM.run(t1).lastInsertRowid;

    const insBOMItem = db.prepare(`
      INSERT INTO bom_recipe_items (recipe_id, input_product_id, quantity_required, unit, unit_cost)
      VALUES (?, ?, ?, ?, ?)
    `);
    insBOMItem.run(recipeId, 4, 0.25, 'بالة بيتموس', 65.00); // بيتموس
    insBOMItem.run(recipeId, 3, 0.5, 'كجم سماد NPK', 5.20);  // سماد
  }

  // تذاكر الدعم الفني
  const ticketCount = db.prepare('SELECT count(*) as cnt FROM support_tickets WHERE tenant_id = ?').get(t1).cnt;
  if (ticketCount === 0) {
    const insTicket = db.prepare(`
      INSERT INTO support_tickets (tenant_id, ticket_number, title, description, category, priority, status, created_by_name)
      VALUES (?, 'TICK-2026-001', 'طلب ربط إضافي مع أجهزة نقاط البيع اللاسلكية', 'نود تفعيل خاصية الطباعة عبر البلوتوث لأجهزة التابلت المتنقلة داخل المشتل.', 'technical', 'medium', 'open', 'فهد الصويان')
    `);
    const ticketId = insTicket.run(t1).lastInsertRowid;

    db.prepare(`
      INSERT INTO ticket_replies (ticket_id, sender_type, sender_name, message)
      VALUES (?, 'super_admin', 'الحسن السعودي (الدعم الفني المركزي)', 'مرحباً أستاذ فهد، تم استلام الطلب وميزة نقاط البيع باللمس تدعم الطباعة الحرارية المباشرة عبر البلوتوث وشبكة Wi-Fi.')
    `).run(ticketId);
  }

  // طلبات التوصيل
  const delvCount = db.prepare('SELECT count(*) as cnt FROM delivery_orders WHERE tenant_id = ?').get(t1).cnt;
  if (delvCount === 0) {
    db.prepare(`
      INSERT INTO delivery_orders (tenant_id, branch_id, order_number, recipient_name, recipient_phone, recipient_city, recipient_address, delivery_fee, courier_name, tracking_number, status, notes)
      VALUES (?, ?, 'DELV-2026-0001', 'د. ناصر السبيعي', '0509988776', 'الرياض', 'حي الياسمين، شارع أنس بن مالك، فيلا 14', 35.00, 'مندوب الصويان السريع', 'TRK-984752', 'preparing', 'شحنة شتلات زهور وأسمدة عضوية - يرجى التعامل بحذر')
    `).run(t1, b1);
  }

  // العملاء وبيانات التواصل والضريبة
  const custCount = db.prepare('SELECT count(*) as cnt FROM customers WHERE tenant_id = ?').get(t1).cnt;
  if (custCount === 0) {
    const insCust = db.prepare('INSERT INTO customers (tenant_id, name, phone, vat_number, address) VALUES (?, ?, ?, ?, ?)');
    insCust.run(t1, 'سليمان الراجحي للمشاريع الزراعية', '0505551234', '300111222300003', 'الرياض - حي الملز');
    insCust.run(t1, 'عبدالرحمن العثمان (عميل نقدي دائم)', '0551122334', '', 'الخرج - طريق المشاتل');
    insCust.run(t1, 'شركة الحدائق العصرية للمقاولات', '0544332211', '310999888700003', 'الرياض - حي النرجس');
  }
}

initDatabase();

module.exports = { db, initDatabase };
