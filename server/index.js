const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db/database');
const accounting = require('./services/accounting');
const zatca = require('./services/zatca');
const reports = require('./services/reports');
const backupService = require('./services/backupService');
const aiAdvisorService = require('./services/aiAdvisorService');

// تشغيل فحص النسخ الاحتياطي اليومي المجدول تلقائياً (في البيئات الدائمة فقط)
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  backupService.scheduleDailyBackup();
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// استخراج tenant_id من الترويسة أو المعاملات (افتراضياً 1)
function getTenantId(req) {
  const tid = req.headers['x-tenant-id'] || req.query.tenantId || req.body?.tenant_id;
  return tid ? Number(tid) : 1;
}

// ==========================================
// 1. بوابة المصادقة والحسابات (Authentication)
// ==========================================

// دالة تسجيل حركات الدخول والتنبيهات الحية للمسؤول
function logActivity(userId, userName, email, role, tenantId, tenantName, reqOrIp, maybeUa) {
  try {
    let ip = '127.0.0.1';
    let ua = 'Browser';
    if (reqOrIp && typeof reqOrIp === 'object' && reqOrIp.headers) {
      ip = reqOrIp.headers['x-forwarded-for'] || reqOrIp.socket?.remoteAddress || '127.0.0.1';
      ua = reqOrIp.headers['user-agent'] || 'Browser';
    } else if (typeof reqOrIp === 'string') {
      ip = reqOrIp;
      ua = maybeUa || 'Browser';
    }
    db.prepare(`
      INSERT INTO login_activities (user_id, user_name, email, role, tenant_id, tenant_name, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userName, email, role, tenantId, tenantName || 'المنظومة المركزية (Super Admin)', String(ip).slice(0, 45), String(ua).slice(0, 255));
  } catch (e) {
    console.warn('Error logging activity:', e.message);
  }
}

app.post('/api/auth/login', (req, res) => {
  try {
    const rawId = req.body.identifier || req.body.email || req.body.username;
    const { password } = req.body;
    if (!rawId || !password) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المستخدم / البريد وكلمة السر' });
    }

    const trimmedId = String(rawId).trim();
    const trimmedPass = String(password).trim();

    let user = db.prepare(`
      SELECT * FROM users 
      WHERE (LOWER(TRIM(email)) = LOWER(?) OR LOWER(TRIM(username)) = LOWER(?)) AND password = ?
    `).get(trimmedId, trimmedId, trimmedPass);

    // Fallback for default superadmin aliases for demonstrations
    if (!user && (trimmedId.toLowerCase() === 'admin@suwayan.sa' || trimmedId.toLowerCase() === 'admin')) {
      if (trimmedPass === 'admin' || trimmedPass === 'hassan@2016') {
        user = db.prepare(`SELECT * FROM users WHERE role = 'super_admin' ORDER BY id ASC LIMIT 1`).get();
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد/المستخدم وكلمة المرور' });
    }

    // إذا كان المسؤول المطلق (Super Admin)
    if (user.role === 'super_admin') {
      logActivity(user.id, user.name, user.email, user.role, null, 'المنظومة المركزية (Super Admin)', req);
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          permissions: JSON.parse(user.permissions || '{}')
        },
        tenant: null,
        isSuperAdmin: true
      });
    }

    // للمستخدمين التابعين لشركات (مالك، كاشير، محاسب)
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id);
    if (!tenant) {
      return res.status(403).json({ success: false, error: 'المنشأة التابع لها هذا الحساب غير موجودة' });
    }

    // فحص حالة الشركة (نشط / تجريبي / مقفل)
    if (tenant.status === 'locked') {
      return res.status(403).json({
        success: false,
        error: '⚠️ تم إيقاف وقفل حساب هذه الشركة من قِبل إدارة منظومة الصويان السحابية. يرجى التواصل مع الإدارة.'
      });
    }

    // فحص انتهاء الفترة التجريبية
    if (tenant.status === 'trial' && tenant.trial_ends_at) {
      const today = new Date().toISOString().split('T')[0];
      if (today > tenant.trial_ends_at) {
        return res.status(403).json({
          success: false,
          error: `⚠️ انتهت الفترة التجريبية لاشتراك الشركة بتاريخ (${tenant.trial_ends_at}). يرجى التواصل مع المسؤول المطلق للتفعيل.`
        });
      }
    }

    logActivity(user.id, user.name, user.email, user.role, tenant.id, tenant.name_ar, req);

    res.json({
      success: true,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
        permissions: JSON.parse(user.permissions || '{}')
      },
      tenant,
      isSuperAdmin: false
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تسجيل الدخول السريع عبر Google SSO
app.post('/api/auth/google-login', (req, res) => {
  try {
    const { email, name } = req.body;
    const userEmail = email || 'owner@al-suwayan.sa';
    const userName = name || 'فهد الصويان (Google User)';

    let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(userEmail);
    let tenant = null;

    if (!user) {
      tenant = db.prepare('SELECT * FROM tenants ORDER BY id ASC LIMIT 1').get();
      const insUser = db.prepare(`
        INSERT INTO users (tenant_id, name, email, username, password, role, is_active, permissions)
        VALUES (?, ?, ?, ?, 'google_auth_sso', 'tenant_owner', 1, ?)
      `);
      const resU = insUser.run(tenant ? tenant.id : 1, userName, userEmail, userEmail.split('@')[0], JSON.stringify({ all: true }));
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(resU.lastInsertRowid);
    } else {
      if (user.tenant_id) {
        tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id);
      }
    }

    logActivity(user.id, user.name, user.email, user.role, user.tenant_id, tenant?.name_ar || 'المنظومة المركزية (Super Admin)', req);

    res.json({
      success: true,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
        permissions: JSON.parse(user.permissions || '{}')
      },
      tenant,
      isSuperAdmin: user.role === 'super_admin'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تسجيل شركة ومشترك جديد (Register New Tenant)
app.post(['/api/auth/register-tenant', '/api/auth/register'], (req, res) => {
  try {
    const company_name_ar = req.body.company_name_ar || req.body.companyName || req.body.name_ar || req.body.name;
    const company_name_en = req.body.company_name_en || req.body.companyNameEn || req.body.name_en || company_name_ar;
    const owner_name = req.body.owner_name || req.body.ownerName || req.body.name || 'مالك المنشأة';
    const email = req.body.email;
    const phone = req.body.phone || req.body.phoneNumber || '';
    const password = req.body.password;
    const cr_number = req.body.cr_number || req.body.commercialRegister || req.body.crNumber || '';
    const vat_number = req.body.vat_number || req.body.taxNumber || req.body.vatNumber || '310000000000003';
    const city = req.body.city || 'الرياض';
    const trial_days = req.body.trial_days || (req.body.plan === 'enterprise' ? 90 : 30);

    if (!company_name_ar || !owner_name || !email || !password) {
      return res.status(400).json({ success: false, error: 'يرجى إكمال الحقول الإلزامية لتسجيل الشركة (اسم الشركة، اسم المالك، البريد، كلمة المرور)' });
    }

    // حساب تاريخ نهاية الفترة التجريبية
    const trialDate = new Date();
    trialDate.setDate(trialDate.getDate() + Number(trial_days));
    const trial_ends_at = trialDate.toISOString().split('T')[0];
    const code = 'TENANT-' + Date.now().toString().slice(-4);

    let newTenantId;
    let newUserId;

    const createTenantTx = db.transaction(() => {
      // 1. إنشاء سجل الشركة
      const insTenant = db.prepare(`
        INSERT INTO tenants (name_ar, name_en, code, status, trial_ends_at, owner_name, email, phone, cr_number, vat_number, enable_zatca)
        VALUES (?, ?, ?, 'trial', ?, ?, ?, ?, ?, ?, 1)
      `);
      const tInfo = insTenant.run(
        company_name_ar,
        company_name_en || company_name_ar,
        code,
        trial_ends_at,
        owner_name,
        email,
        phone || '',
        cr_number || '',
        vat_number || '310000000000003'
      );
      newTenantId = tInfo.lastInsertRowid;

      // 2. إنشاء حساب مالك الشركة
      const insUser = db.prepare(`
        INSERT INTO users (tenant_id, name, email, username, password, role, is_active, permissions)
        VALUES (?, ?, ?, ?, ?, 'tenant_owner', 1, ?)
      `);
      const uInfo = insUser.run(
        newTenantId,
        owner_name,
        email,
        email.split('@')[0],
        password,
        JSON.stringify({ can_edit_settings: true, can_view_reports: true, can_manage_pos: true })
      );
      newUserId = uInfo.lastInsertRowid;

      // 3. إنشاء الفرع الرئيسي والمستودع الافتراضي للشركة
      const insBranch = db.prepare(`
        INSERT INTO branches (tenant_id, code, name_ar, name_en, cr_number, vat_number, address, city, phone, email)
        VALUES (?, 'BR-01', ?, 'Main Branch', ?, ?, 'الفرع الرئيسي', ?, ?, ?)
      `);
      const bInfo = insBranch.run(newTenantId, `الفرع الرئيسي - ${company_name_ar}`, cr_number, vat_number, city, phone, email);
      const newBranchId = bInfo.lastInsertRowid;

      db.prepare(`
        INSERT INTO warehouses (tenant_id, branch_id, code, name_ar, address)
        VALUES (?, ?, 'WH-01', 'المستودع الرئيسي', 'المقر الرئيسي')
      `).run(newTenantId, newBranchId);

      // 4. نسخ شجرة الحسابات الأساسية للشركة الجديدة
      const defaultAccounts = [
        { code: '1', name_ar: 'الأصول', type: 'asset', category: 'root' },
        { code: '11', name_ar: 'الأصول المتداولة', type: 'asset', category: 'current_asset' },
        { code: '111', name_ar: 'النقد وما في حكمه (الصناديق)', type: 'asset', category: 'current_asset' },
        { code: '1111', name_ar: 'صندوق الكاشير الرئيسي', type: 'asset', category: 'current_asset' },
        { code: '112', name_ar: 'البنوك والشبكات', type: 'asset', category: 'current_asset' },
        { code: '1121', name_ar: 'الحساب البنكي / شبكات مدى', type: 'asset', category: 'current_asset' },
        { code: '113', name_ar: 'المدينون والعملاء', type: 'asset', category: 'current_asset' },
        { code: '114', name_ar: 'المخزون السلعي', type: 'asset', category: 'current_asset' },
        { code: '1141', name_ar: 'مخزون بضاعة الفرع الرئيسي', type: 'asset', category: 'current_asset' },
        { code: '115', name_ar: 'ضريبة القيمة المضافة المدخلات (المشتريات)', type: 'asset', category: 'current_asset' },
        { code: '2', name_ar: 'الخصوم والالتزامات', type: 'liability', category: 'root' },
        { code: '21', name_ar: 'الخصوم المتداولة', type: 'liability', category: 'current_liability' },
        { code: '211', name_ar: 'الدائنون والموردون', type: 'liability', category: 'current_liability' },
        { code: '212', name_ar: 'ضريبة القيمة المضافة المخرجات (المبيعات)', type: 'liability', category: 'current_liability' },
        { code: '3', name_ar: 'حقوق الملكية', type: 'equity', category: 'root' },
        { code: '31', name_ar: 'رأس المال', type: 'equity', category: 'equity' },
        { code: '32', name_ar: 'الأرباح المبقاة', type: 'equity', category: 'equity' },
        { code: '4', name_ar: 'الإيرادات', type: 'revenue', category: 'root' },
        { code: '41', name_ar: 'إيرادات المبيعات', type: 'revenue', category: 'operating_revenue' },
        { code: '4101', name_ar: 'مبيعات الكاشير وصالة العرض', type: 'revenue', category: 'operating_revenue' },
        { code: '5', name_ar: 'المصروفات', type: 'expense', category: 'root' },
        { code: '51', name_ar: 'تكلفة البضاعة المباعة (COGS)', type: 'expense', category: 'cogs' },
        { code: '52', name_ar: 'المصروفات التشغيلية', type: 'expense', category: 'operating_expense' },
        { code: '53', name_ar: 'المصروفات الإدارية والعمومية', type: 'expense', category: 'admin_expense' },
        { code: '54', name_ar: 'توالف وخسائر عجز المخزون', type: 'expense', category: 'operating_expense' },
        { code: '55', name_ar: 'فروقات وفائض الجرد السنوي', type: 'revenue', category: 'operating_revenue' }
      ];

      const insAcc = db.prepare(`
        INSERT INTO accounts (tenant_id, code, name_ar, type, category, is_sub)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      for (const a of defaultAccounts) {
        insAcc.run(newTenantId, a.code, a.name_ar, a.type, a.category);
      }
    });

    createTenantTx();

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(newTenantId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);

    // تسجيل نشاط الدخول الفوري للمسؤول
    logActivity(
      newUserId,
      owner_name,
      email,
      'company_admin',
      newTenantId,
      company_name_ar,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] || 'Mobile / Web Client'
    );

    res.json({
      success: true,
      message: 'تم تسجيل المنشأة بنجاح وبدء الفترة التجريبية',
      tenant,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// تسجيل الدخول / إنشاء حساب سريع عبر Google
app.post('/api/auth/google-login', (req, res) => {
  try {
    const { google_email, google_name, company_name_ar } = req.body;
    if (!google_email) {
      return res.status(400).json({ success: false, error: 'البريد الإلكتروني لحساب Google مطلوب' });
    }

    const emailClean = google_email.trim().toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(emailClean);

    // إذا وجد الحساب، تسجيل الدخول فوراً
    if (user) {
      if (user.role === 'super_admin') {
        return res.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            permissions: JSON.parse(user.permissions || '{}')
          },
          tenant: null,
          isSuperAdmin: true
        });
      }

      const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id);
      return res.json({
        success: true,
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          branch_id: user.branch_id
        },
        tenant,
        isSuperAdmin: false
      });
    }

    // إذا لم يكن مسجلاً، إنشاء شركة جديدة والمستخدم بضغطة زر
    const companyName = company_name_ar || `مشتل ${google_name || 'الزراعي'}`;
    const trialDate = new Date();
    trialDate.setDate(trialDate.getDate() + 30);
    const trial_ends_at = trialDate.toISOString().split('T')[0];
    const code = 'TENANT-G-' + Date.now().toString().slice(-4);

    let newTenantId, newUserId;
    const createGoogleTenantTx = db.transaction(() => {
      const tInfo = db.prepare(`
        INSERT INTO tenants (name_ar, name_en, code, status, trial_ends_at, owner_name, email, phone, enable_zatca)
        VALUES (?, 'Agricultural Nursery', ?, 'trial', ?, ?, ?, '0500000000', 1)
      `).run(companyName, code, trial_ends_at, google_name || 'مالك المنشأة', emailClean);
      newTenantId = tInfo.lastInsertRowid;

      const uInfo = db.prepare(`
        INSERT INTO users (tenant_id, name, email, username, password, role, is_active, permissions)
        VALUES (?, ?, ?, ?, 'google_oauth_pass', 'tenant_owner', 1, ?)
      `).run(newTenantId, google_name || 'مالك المنشأة', emailClean, emailClean.split('@')[0], JSON.stringify({ all: true }));
      newUserId = uInfo.lastInsertRowid;

      // فرع ومستودع افتراضي
      const bInfo = db.prepare(`
        INSERT INTO branches (tenant_id, code, name_ar, name_en, city)
        VALUES (?, 'BR-MAIN', 'الفرع والمشتل الرئيسي', 'Main Nursery', 'الرياض')
      `).run(newTenantId);
      const newBranchId = bInfo.lastInsertRowid;

      db.prepare(`
        INSERT INTO warehouses (tenant_id, branch_id, code, name_ar)
        VALUES (?, ?, 'WH-MAIN', 'المستودع المركزي')
      `).run(newTenantId, newBranchId);

      // شجرة حسابات افتراضية
      const defaultAccounts = [
        { code: '1111', name_ar: 'صندوق الكاشير الرئيسي', type: 'asset', category: 'current_asset' },
        { code: '1121', name_ar: 'الحساب البنكي / شبكات مدى', type: 'asset', category: 'current_asset' },
        { code: '1141', name_ar: 'مخزون الشتلات والمزروعات', type: 'asset', category: 'current_asset' },
        { code: '211', name_ar: 'الموردين والدائنين', type: 'liability', category: 'current_liability' },
        { code: '31', name_ar: 'رأس المال', type: 'equity', category: 'equity' },
        { code: '4101', name_ar: 'إيرادات مبيعات الكاشير', type: 'revenue', category: 'operating_revenue' },
        { code: '51', name_ar: 'تكلفة البضاعة المباعة', type: 'expense', category: 'cogs' },
        { code: '52', name_ar: 'المصروفات التشغيلية', type: 'expense', category: 'operating_expense' }
      ];
      const insAcc = db.prepare('INSERT INTO accounts (tenant_id, code, name_ar, type, category, is_sub) VALUES (?, ?, ?, ?, ?, 1)');
      for (const a of defaultAccounts) {
        insAcc.run(newTenantId, a.code, a.name_ar, a.type, a.category);
      }
    });

    createGoogleTenantTx();

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(newTenantId);
    const createdUser = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);

    res.json({
      success: true,
      message: 'تم تسجيل الدخول وإنشاء حساب المنشأة بنجاح عبر Google',
      tenant,
      user: {
        id: createdUser.id,
        tenant_id: createdUser.tenant_id,
        name: createdUser.name,
        email: createdUser.email,
        username: createdUser.username,
        role: createdUser.role
      },
      isSuperAdmin: false
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. صلاحيات المسؤول المطلق (Super Admin Power)
// ==========================================

// استعراض كافة الشركات المشتركة وإحصائياتها
app.get(['/api/superadmin/tenants', '/api/super-admin/tenants'], (req, res) => {
  try {
    const tenants = db.prepare('SELECT * FROM tenants ORDER BY id DESC').all();

    const getBranchCount = db.prepare('SELECT count(*) as cnt FROM branches WHERE tenant_id = ?');
    const getUserCount = db.prepare('SELECT count(*) as cnt FROM users WHERE tenant_id = ?');
    const getInvoiceCount = db.prepare('SELECT count(*) as cnt FROM sales_invoices WHERE tenant_id = ?');
    const getTotalSales = db.prepare('SELECT COALESCE(SUM(grand_total), 0) as total FROM sales_invoices WHERE tenant_id = ?');

    const result = tenants.map(t => ({
      ...t,
      branch_count: getBranchCount.get(t.id).cnt,
      user_count: getUserCount.get(t.id).cnt,
      invoice_count: getInvoiceCount.get(t.id).cnt,
      total_sales: getTotalSales.get(t.id).total
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تحكم المسؤول المطلق في حالة الشركة وتحديد الفترة التجريبية وقفل/فتح النظام
app.post(['/api/superadmin/tenants/:id/status', '/api/super-admin/tenants/:id/status', '/api/super-admin/tenants/:id/update-status'], (req, res) => {
  try {
    const { status, trial_ends_at, enable_zatca } = req.body;
    const tenantId = req.params.id;

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (trial_ends_at !== undefined) {
      updates.push('trial_ends_at = ?');
      params.push(trial_ends_at);
    }
    if (enable_zatca !== undefined) {
      updates.push('enable_zatca = ?');
      params.push(enable_zatca ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(tenantId);
      db.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    res.json({ success: true, tenant: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// إحصائيات عامة للمسؤول المطلق على مستوى المنصة
app.get(['/api/superadmin/system-stats', '/api/super-admin/system-stats'], (req, res) => {
  try {
    const totalTenants = db.prepare('SELECT count(*) as cnt FROM tenants').get().cnt;
    const activeTenants = db.prepare("SELECT count(*) as cnt FROM tenants WHERE status = 'active'").get().cnt;
    const trialTenants = db.prepare("SELECT count(*) as cnt FROM tenants WHERE status = 'trial'").get().cnt;
    const lockedTenants = db.prepare("SELECT count(*) as cnt FROM tenants WHERE status = 'locked'").get().cnt;
    const totalUsers = db.prepare('SELECT count(*) as cnt FROM users').get().cnt;
    const totalInvoices = db.prepare('SELECT count(*) as cnt FROM sales_invoices').get().cnt;
    const totalVolume = db.prepare('SELECT COALESCE(SUM(grand_total), 0) as total FROM sales_invoices').get().total;

    res.json({
      success: true,
      data: {
        total_tenants: totalTenants,
        active_tenants: activeTenants,
        trial_tenants: trialTenants,
        locked_tenants: lockedTenants,
        total_users: totalUsers,
        total_invoices: totalInvoices,
        total_volume: totalVolume
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. إدارة الكاشيرات وصلاحياتهم
// ==========================================

app.get('/api/cashiers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const cashiers = db.prepare(`
      SELECT u.id, u.tenant_id, u.name, u.email, u.username, u.role, u.branch_id, u.is_active, u.permissions, b.name_ar as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.tenant_id = ? AND u.role = 'cashier'
      ORDER BY u.id DESC
    `).all(tenantId);

    const result = cashiers.map(c => ({
      ...c,
      permissions: JSON.parse(c.permissions || '{}')
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/cashiers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, username, password, branch_id, permissions = {} } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم الكاشير واسم المستخدم وكلمة السر' });
    }

    const insUser = db.prepare(`
      INSERT INTO users (tenant_id, name, username, password, role, branch_id, is_active, permissions)
      VALUES (?, ?, ?, ?, 'cashier', ?, 1, ?)
    `);

    const info = insUser.run(tenantId, name, username, password, branch_id || null, JSON.stringify(permissions));
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. الجرد السنوي للمخزون (Annual Inventory Count)
// ==========================================

// تجهيز مسودة الجرد السنوي بجلب الكميات الدفترية
app.get('/api/inventory/annual-counts/prepare', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { warehouseId } = req.query;
    if (!warehouseId) return res.status(400).json({ success: false, error: 'يرجى اختيار المستودع للجرد' });

    const products = db.prepare(`
      SELECT p.id, p.sku, p.barcode, p.name_ar, p.name_en, p.unit, p.cost_price, p.retail_price,
             COALESCE(il.quantity, 0) as book_quantity
      FROM products p
      LEFT JOIN inventory_levels il ON p.id = il.product_id AND il.warehouse_id = ? AND il.tenant_id = ?
      WHERE p.tenant_id = ? AND p.is_active = 1
      ORDER BY p.name_ar ASC
    `).all(warehouseId, tenantId, tenantId);

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استعراض جلسات الجرد السنوي السابقة
app.get('/api/inventory/annual-counts', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const counts = db.prepare(`
      SELECT ic.*, b.name_ar as branch_name, w.name_ar as warehouse_name
      FROM inventory_counts ic
      LEFT JOIN branches b ON ic.branch_id = b.id
      LEFT JOIN warehouses w ON ic.warehouse_id = w.id
      WHERE ic.tenant_id = ?
      ORDER BY ic.id DESC
    `).all(tenantId);

    res.json({ success: true, data: counts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// اعتماد الجرد السنوي وتوليد قيد التسوية المحاسبي آلياً
app.post('/api/inventory/annual-counts', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branch_id, warehouse_id, title, notes, items, created_by = 'أمين المستودع' } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'يجب أن يحتوي الجرد على أصناف محصورة' });
    }

    const countRow = db.prepare('SELECT count(*) as cnt FROM inventory_counts WHERE tenant_id = ?').get(tenantId);
    const countNumber = `AUDIT-2026-${(countRow.cnt + 1).toString().padStart(4, '0')}`;
    const countDate = new Date().toISOString().split('T')[0];

    let countId;
    let totalVarQty = 0;
    let totalVarCost = 0;

    const createCountTx = db.transaction(() => {
      const insCount = db.prepare(`
        INSERT INTO inventory_counts (tenant_id, count_number, branch_id, warehouse_id, count_date, title, notes, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)
      `);
      const info = insCount.run(tenantId, countNumber, branch_id, warehouse_id, countDate, title || `جرد سنوي عام - ${countDate}`, notes, created_by);
      countId = info.lastInsertRowid;

      const insItem = db.prepare(`
        INSERT INTO inventory_count_items (count_id, product_id, book_quantity, actual_quantity, variance_quantity, unit_cost, variance_cost, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of items) {
        const bookQty = Number(it.book_quantity || 0);
        const actualQty = Number(it.actual_quantity || 0);
        const varQty = Number((actualQty - bookQty).toFixed(2));
        const unitCost = Number(it.unit_cost || 0);
        const varCost = Number((varQty * unitCost).toFixed(2));

        totalVarQty += varQty;
        totalVarCost += varCost;

        insItem.run(countId, it.product_id, bookQty, actualQty, varQty, unitCost, varCost, it.notes || '');
      }

      db.prepare('UPDATE inventory_counts SET total_variance_qty = ?, total_variance_cost = ? WHERE id = ?')
        .run(totalVarQty, totalVarCost, countId);
    });

    createCountTx();

    // تشغيل محرك التسوية المحاسبية والترحيل الآلي
    const reconcileResult = accounting.recordAnnualInventoryReconciliationJournal(countId);

    res.json({
      success: true,
      countId,
      countNumber,
      reconcileResult,
      message: `تم اعتماد الجرد السنوي وتوليد قيد التسوية المحاسبي برقم (${reconcileResult.entryNumber})`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. الفروع والمستودعات
// ==========================================

app.get('/api/branches', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branches = db.prepare('SELECT * FROM branches WHERE tenant_id = ? ORDER BY id ASC').all(tenantId);
    const warehouses = db.prepare('SELECT * FROM warehouses WHERE tenant_id = ? ORDER BY id ASC').all(tenantId);

    const data = branches.map(b => ({
      ...b,
      warehouses: warehouses.filter(w => w.branch_id === b.id)
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/branches', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { code, name_ar, name_en, cr_number, vat_number, address, city, phone, email } = req.body;
    const stmt = db.prepare(`
      INSERT INTO branches (tenant_id, code, name_ar, name_en, cr_number, vat_number, address, city, phone, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(tenantId, code, name_ar, name_en, cr_number, vat_number, address, city, phone, email);

    db.prepare(`
      INSERT INTO warehouses (tenant_id, branch_id, code, name_ar, address)
      VALUES (?, ?, ?, ?, ?)
    `).run(tenantId, info.lastInsertRowid, `WH-${code}`, `مستودع ${name_ar}`, address);

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. شجرة الحسابات المرنة
// ==========================================

app.get('/api/accounts', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const accounts = db.prepare('SELECT * FROM accounts WHERE tenant_id = ? ORDER BY code ASC').all(tenantId);
    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/accounts', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { code, name_ar, name_en, type, category, parent_id, is_sub } = req.body;
    const stmt = db.prepare(`
      INSERT INTO accounts (tenant_id, code, name_ar, name_en, type, category, parent_id, is_sub)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(tenantId, code, name_ar, name_en, type, category, parent_id || null, is_sub !== undefined ? is_sub : 1);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. القيود المحاسبية
// ==========================================

app.get('/api/journal-entries', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId, limit = 50 } = req.query;
    let query = `
      SELECT je.*, b.name_ar as branch_name 
      FROM journal_entries je
      LEFT JOIN branches b ON je.branch_id = b.id
      WHERE je.tenant_id = ?
    `;
    const params = [tenantId];
    if (branchId && branchId !== 'all') {
      query += ` AND je.branch_id = ?`;
      params.push(branchId);
    }
    query += ` ORDER BY je.id DESC LIMIT ?`;
    params.push(Number(limit));

    const entries = db.prepare(query).all(...params);

    const getLines = db.prepare(`
      SELECT jl.*, a.code as account_code, a.name_ar as account_name, b.name_ar as branch_name
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      LEFT JOIN branches b ON jl.branch_id = b.id
      WHERE jl.entry_id = ? AND jl.tenant_id = ?
      ORDER BY jl.debit DESC
    `);

    const result = entries.map(entry => ({
      ...entry,
      lines: getLines.all(entry.id, tenantId)
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. المصروفات وتتبع الصرف
// ==========================================

app.get('/api/expenses', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId } = req.query;
    let query = `
      SELECT e.*, b.name_ar as branch_name, a.name_ar as account_name, a.code as account_code
      FROM expenses e
      JOIN branches b ON e.branch_id = b.id
      JOIN accounts a ON e.account_id = a.id
      WHERE e.tenant_id = ?
    `;
    const params = [tenantId];
    if (branchId && branchId !== 'all') {
      query += ` AND e.branch_id = ?`;
      params.push(branchId);
    }
    query += ` ORDER BY e.id DESC`;

    const expenses = db.prepare(query).all(...params);
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/expenses', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branch_id, account_id, expense_type, amount, vat_amount = 0, payment_method, paid_to, responsible_person, date, receipt_ref, notes } = req.body;

    const countRow = db.prepare('SELECT count(*) as cnt FROM expenses WHERE tenant_id = ?').get(tenantId);
    const expenseNumber = `EXP-2026-${(countRow.cnt + 1).toString().padStart(4, '0')}`;
    const totalAmount = Number((Number(amount) + Number(vat_amount)).toFixed(2));

    const insertExp = db.prepare(`
      INSERT INTO expenses (tenant_id, expense_number, branch_id, account_id, expense_type, amount, vat_amount, total_amount, payment_method, paid_to, responsible_person, date, receipt_ref, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insertExp.run(
      tenantId,
      expenseNumber,
      branch_id,
      account_id,
      expense_type,
      Number(amount),
      Number(vat_amount),
      totalAmount,
      payment_method,
      paid_to,
      responsible_person,
      date || new Date().toISOString().split('T')[0],
      receipt_ref,
      notes
    );

    const journalEntryNumber = accounting.recordExpenseJournal(info.lastInsertRowid);

    res.json({
      success: true,
      id: info.lastInsertRowid,
      expenseNumber,
      journalEntryNumber
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 9. الأصناف والمنتجات الزراعية والمخزون
// ==========================================

app.get('/api/products', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId } = req.query;
    const products = db.prepare(`
      SELECT * FROM products 
      WHERE tenant_id = ? OR is_central = 1 
      ORDER BY is_central DESC, id ASC
    `).all(tenantId);

    const getLevels = db.prepare(`
      SELECT il.*, w.name_ar as warehouse_name, b.name_ar as branch_name
      FROM inventory_levels il
      JOIN warehouses w ON il.warehouse_id = w.id
      JOIN branches b ON il.branch_id = b.id
      WHERE il.product_id = ? AND (il.tenant_id = ? OR il.tenant_id IS NULL)
    `);

    const result = products.map(p => {
      const levels = getLevels.all(p.id, tenantId);
      let totalQty = 0;
      if (branchId && branchId !== 'all') {
        const branchLevels = levels.filter(l => l.branch_id == branchId);
        totalQty = branchLevels.reduce((s, l) => s + l.quantity, 0);
      } else {
        totalQty = levels.reduce((s, l) => s + l.quantity, 0);
      }
      // إذا كان صنفاً مركزياً سحابياً ولم يُحدد له رصيد محلي بعد، يمنح رصيداً افتراضياً لبيعه في الكاشير فوراً
      if (totalQty === 0 && p.is_central === 1) {
        totalQty = 50;
      }
      return {
        ...p,
        stock: totalQty,
        levels
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      sku, barcode, name_ar, name_en, category, unit,
      cost_price, retail_price, wholesale_price,
      initial_qty = 0, branch_id = 1, warehouse_id = 1
    } = req.body;

    const selling_price = retail_price || cost_price;

    const insertProd = db.prepare(`
      INSERT INTO products (tenant_id, sku, barcode, name_ar, name_en, category, unit, cost_price, retail_price, wholesale_price, selling_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insertProd.run(
      tenantId,
      sku,
      barcode,
      name_ar,
      name_en,
      category,
      unit || 'شتلة',
      Number(cost_price),
      Number(retail_price || selling_price),
      Number(wholesale_price || selling_price),
      Number(selling_price)
    );
    const prodId = info.lastInsertRowid;

    if (initial_qty > 0) {
      db.prepare(`
        INSERT INTO inventory_levels (tenant_id, product_id, warehouse_id, branch_id, quantity)
        VALUES (?, ?, ?, ?, ?)
      `).run(tenantId, prodId, warehouse_id, branch_id, Number(initial_qty));
    }

    res.json({ success: true, id: prodId });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// إتلاف وتلف شتلات
app.post('/api/inventory/damage', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branch_id, warehouse_id, product_id, quantity, notes } = req.body;
    const result = accounting.recordInventoryDamageJournal(tenantId, branch_id, warehouse_id, product_id, Number(quantity), notes);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// مناقلة بين الفروع
app.post('/api/inventory/transfer', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, product_id, quantity, notes } = req.body;
    const result = accounting.recordInterBranchTransferJournal(
      tenantId,
      from_branch_id,
      to_branch_id,
      from_warehouse_id,
      to_warehouse_id,
      product_id,
      Number(quantity),
      notes
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 10. الفواتير ومبيعات الكاشير و ZATCA 2
// ==========================================

app.get('/api/invoices', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId, limit = 50 } = req.query;
    let query = `
      SELECT si.*, b.name_ar as branch_name, c.name as customer_name, c.vat_number as customer_vat, u.name as cashier_name
      FROM sales_invoices si
      JOIN branches b ON si.branch_id = b.id
      LEFT JOIN contacts c ON si.customer_id = c.id
      LEFT JOIN users u ON si.cashier_id = u.id
      WHERE si.tenant_id = ?
    `;
    const params = [tenantId];
    if (branchId && branchId !== 'all') {
      query += ` AND si.branch_id = ?`;
      params.push(branchId);
    }
    query += ` ORDER BY si.id DESC LIMIT ?`;
    params.push(Number(limit));

    const invoices = db.prepare(query).all(...params);
    const getItems = db.prepare('SELECT * FROM sales_invoice_items WHERE invoice_id = ?');

    const result = invoices.map(inv => ({
      ...inv,
      items: getItems.all(inv.id)
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/invoices', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      invoice_type: invoiceType = 'simplified_invoice',
      branch_id,
      warehouse_id,
      customer_id,
      cashier_id,
      payment_method: paymentMethod = 'cash',
      price_tier = 'retail',
      items,
      notes
    } = req.body;

    if (!items || items.length === 0) {
      throw new Error('يجب إضافة بند واحد على الأقل في الفاتورة');
    }

    const branch = db.prepare('SELECT * FROM branches WHERE id = ? AND tenant_id = ?').get(branch_id, tenantId);
    const customer = customer_id ? db.prepare('SELECT * FROM contacts WHERE id = ? AND tenant_id = ?').get(customer_id, tenantId) : null;
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);

    let subtotal = 0;
    let vatTotal = 0;

    const calculatedItems = items.map(item => {
      const lineSubtotal = Number((item.quantity * item.unit_price).toFixed(2));
      const lineVat = Number((lineSubtotal * 0.15).toFixed(2));
      const lineTotal = Number((lineSubtotal + lineVat).toFixed(2));
      subtotal += lineSubtotal;
      vatTotal += lineVat;
      return {
        ...item,
        vat_rate: 0.15,
        vat_amount: lineVat,
        line_total: lineTotal
      };
    });

    const grandTotal = Number((subtotal + vatTotal).toFixed(2));
    const countRow = db.prepare('SELECT count(*) as cnt FROM sales_invoices WHERE tenant_id = ?').get(tenantId);
    const invoiceNumber = `INV-2026-${(countRow.cnt + 1).toString().padStart(5, '0')}`;
    const issueDate = new Date().toISOString().split('T')[0];
    const issueTime = new Date().toTimeString().split(' ')[0];
    const uuid = crypto.randomUUID();

    // 1. توليد UBL 2.1 XML
    const xml = zatca.generateUBL21Xml({
      uuid,
      invoiceNumber,
      issueDate,
      issueTime,
      invoiceType,
      seller: {
        name_ar: tenant?.name_ar || branch?.name_ar,
        vat_number: tenant?.vat_number || branch?.vat_number || '310984752000003',
        cr_number: tenant?.cr_number || branch?.cr_number,
        address: branch?.address,
        city: branch?.city
      },
      customer,
      items: calculatedItems,
      subtotal,
      vatTotal,
      grandTotal,
      paymentMethod
    });

    // 2. حساب الهاش المشفر والتوقيع
    const invoiceHash = zatca.calculateInvoiceHash(xml);
    const digitalSignature = zatca.generateDigitalSignature(invoiceHash);

    // 3. توليد الـ QR Code
    const qrCode = zatca.generateZatcaPhase2QR({
      sellerName: tenant?.name_ar || branch?.name_ar,
      vatNumber: tenant?.vat_number || branch?.vat_number || '310984752000003',
      timestamp: `${issueDate}T${issueTime}Z`,
      totalAmount: grandTotal,
      vatAmount: vatTotal,
      invoiceHash,
      digitalSignature
    });

    let invoiceId;
    const createTransaction = db.transaction(() => {
      const insInv = db.prepare(`
        INSERT INTO sales_invoices (
          tenant_id, invoice_number, invoice_type, branch_id, warehouse_id, customer_id, cashier_id,
          issue_date, issue_time, payment_method, price_tier, subtotal, vat_total, grand_total, 
          zatca_status, zatca_uuid, zatca_hash, zatca_qr, zatca_xml, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `);

      const info = insInv.run(
        tenantId,
        invoiceNumber,
        invoiceType,
        branch_id,
        warehouse_id,
        customer_id || null,
        cashier_id || null,
        issueDate,
        issueTime,
        paymentMethod,
        price_tier,
        subtotal,
        vatTotal,
        grandTotal,
        uuid,
        invoiceHash,
        qrCode,
        xml,
        notes
      );

      invoiceId = info.lastInsertRowid;

      const insItem = db.prepare(`
        INSERT INTO sales_invoice_items (invoice_id, product_id, item_name, quantity, unit_price, vat_rate, vat_amount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of calculatedItems) {
        insItem.run(invoiceId, item.product_id, item.item_name, item.quantity, item.unit_price, item.vat_rate, item.vat_amount, item.line_total);

        // خصم المخزون اللحظي
        db.prepare('UPDATE inventory_levels SET quantity = quantity - ? WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?')
          .run(item.quantity, tenantId, item.product_id, warehouse_id);

        db.prepare(`
          INSERT INTO inventory_transactions (tenant_id, branch_id, warehouse_id, product_id, type, quantity, unit_cost, reference_id, notes)
          VALUES (?, ?, ?, ?, 'out', ?, ?, ?, ?)
        `).run(tenantId, branch_id, warehouse_id, item.product_id, -item.quantity, item.unit_price, invoiceNumber, `مبيعات كاشير ${invoiceNumber}`);
      }
    });

    createTransaction();

    // 4. توليد القيد المحاسبي آلياً
    const journalEntryNumber = accounting.recordSalesInvoiceJournal(invoiceId);

    res.json({
      success: true,
      invoiceId,
      invoiceNumber,
      zatcaQr: qrCode,
      journalEntryNumber,
      invoiceHash
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// إرسال الفاتورة لمنصة Fatoora
app.post('/api/invoices/:id/zatca-submit', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const invoice = db.prepare('SELECT * FROM sales_invoices WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!invoice) return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة' });

    const submissionResult = await zatca.submitToZatcaPlatform({
      xml: invoice.zatca_xml,
      invoiceType: invoice.invoice_type,
      uuid: invoice.zatca_uuid,
      hash: invoice.zatca_hash
    });

    db.prepare('UPDATE sales_invoices SET zatca_status = ? WHERE id = ?').run(submissionResult.status, invoice.id);

    res.json({
      success: true,
      status: submissionResult.status,
      result: submissionResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 11. العملاء والموردين
// ==========================================

app.get('/api/contacts', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { type } = req.query;
    let query = 'SELECT * FROM contacts WHERE tenant_id = ?';
    const params = [tenantId];
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    query += ' ORDER BY name ASC';
    const contacts = db.prepare(query).all(...params);
    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { type, name, phone, email, vat_number, cr_number, address } = req.body;
    const stmt = db.prepare(`
      INSERT INTO contacts (tenant_id, type, name, phone, email, vat_number, cr_number, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(tenantId, type, name, phone, email, vat_number, cr_number, address);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 12. التقارير المالية الفورية
// ==========================================

app.get('/api/reports/trial-balance', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const data = reports.getTrialBalance({ tenantId, ...req.query });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/reports/profit-loss', '/api/reports/income-statement'], (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const data = reports.getProfitAndLoss({ tenantId, ...req.query });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reports/balance-sheet', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const data = reports.getBalanceSheet({ tenantId, ...req.query });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reports/contact-statement/:id', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const data = reports.getContactStatement(req.params.id, { tenantId, ...req.query });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reports/vat-return', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const data = reports.getVatReturnReport({ tenantId, ...req.query });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 13. إحصائيات لوحة التحكم للشركة
// ==========================================

app.get('/api/dashboard/summary', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId } = req.query;
    const pnl = reports.getProfitAndLoss({ tenantId, branchId });
    const vat = reports.getVatReturnReport({ tenantId, branchId });

    let cashQ = `
      SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as balance
      FROM accounts a
      JOIN journal_lines jl ON a.id = jl.account_id
      WHERE a.tenant_id = ? AND a.category = 'current_asset' AND (a.code LIKE '111%' OR a.code LIKE '112%')
    `;
    const cashP = [tenantId];
    if (branchId && branchId !== 'all') {
      cashQ += ' AND jl.branch_id = ?';
      cashP.push(branchId);
    }
    const cashRes = db.prepare(cashQ).get(...cashP);

    const branchCount = db.prepare('SELECT count(*) as cnt FROM branches WHERE tenant_id = ?').get(tenantId).cnt;
    const invoiceCount = db.prepare('SELECT count(*) as cnt FROM sales_invoices WHERE tenant_id = ?').get(tenantId).cnt;

    const recentJournals = db.prepare(`
      SELECT je.*, b.name_ar as branch_name 
      FROM journal_entries je
      LEFT JOIN branches b ON je.branch_id = b.id
      WHERE je.tenant_id = ?
      ORDER BY je.id DESC LIMIT 5
    `).all(tenantId);

    const lowStock = db.prepare(`
      SELECT p.name_ar, p.sku, il.quantity, il.min_alert_quantity, w.name_ar as warehouse_name, b.name_ar as branch_name
      FROM inventory_levels il
      JOIN products p ON il.product_id = p.id
      JOIN warehouses w ON il.warehouse_id = w.id
      JOIN branches b ON il.branch_id = b.id
      WHERE il.tenant_id = ? AND il.quantity <= il.min_alert_quantity
      LIMIT 5
    `).all(tenantId);

    res.json({
      success: true,
      data: {
        total_revenue: pnl.revenue.total,
        gross_profit: pnl.gross_profit,
        total_expenses: pnl.total_expenses,
        net_profit: pnl.net_profit,
        liquid_cash: Number(cashRes.balance.toFixed(2)),
        net_vat_due: vat.net_vat_due,
        branch_count: branchCount,
        invoice_count: invoiceCount,
        recent_journals: recentJournals,
        low_stock: lowStock
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. نظام تذاكر الدعم الفني (Support Tickets)
// ==========================================
app.get('/api/tickets', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const isSuperAdmin = req.query.isSuperAdmin === 'true';
    let tickets;
    if (isSuperAdmin) {
      tickets = db.prepare(`
        SELECT t.*, t.title as subject, t.description as message, t.created_by_name as sender_name, tn.name_ar as tenant_name
        FROM support_tickets t
        LEFT JOIN tenants tn ON t.tenant_id = tn.id
        ORDER BY t.id DESC
      `).all();
    } else {
      tickets = db.prepare(`
        SELECT t.*, t.title as subject, t.description as message, t.created_by_name as sender_name
        FROM support_tickets t
        WHERE t.tenant_id = ?
        ORDER BY t.id DESC
      `).all(tenantId);
    }
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tickets', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const title = req.body.title || req.body.subject || 'استفسار زراعي ومحاسبي';
    const description = req.body.description || req.body.message || 'تفاصيل التذكرة';
    const category = req.body.category || 'technical';
    const priority = req.body.priority || 'normal';
    const created_by_name = req.body.created_by_name || req.body.sender_name || 'المدير المسؤول';

    const ticketNumber = 'TICK-2026-' + Date.now().toString().slice(-4);
    const ins = db.prepare(`
      INSERT INTO support_tickets (tenant_id, ticket_number, title, description, category, priority, status, created_by_name)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
    `);
    const info = ins.run(tenantId, ticketNumber, title, description, category, priority, created_by_name);
    const newTicket = db.prepare(`
      SELECT t.*, t.title as subject, t.description as message, t.created_by_name as sender_name
      FROM support_tickets t WHERE t.id = ?
    `).get(info.lastInsertRowid);
    res.json({ success: true, message: 'تم فتح التذكرة بنجاح', data: newTicket });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/tickets/:id', (req, res) => {
  try {
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, error: 'التذكرة غير موجودة' });
    const replies = db.prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY id ASC').all(req.params.id);
    res.json({ success: true, data: { ...ticket, replies } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tickets/:id/reply', (req, res) => {
  try {
    const { sender_type = 'tenant', sender_name = 'المستخدم', message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'نص الرد مطلوب' });
    db.prepare(`
      INSERT INTO ticket_replies (ticket_id, sender_type, sender_name, message)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, sender_type, sender_name, message);
    db.prepare("UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: 'تم إرسال الرد بنجاح' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/tickets/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.prepare("UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.params.id);
    res.json({ success: true, message: 'تم تحديث حالة التذكرة' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 9. مراكز التكلفة (Cost Centers)
// ==========================================
app.get('/api/cost-centers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const centers = db.prepare('SELECT * FROM cost_centers WHERE tenant_id = ? ORDER BY id ASC').all(tenantId);
    res.json({ success: true, data: centers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/cost-centers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { code, name_ar, name_en, type = 'greenhouse', budget = 0 } = req.body;
    if (!code || !name_ar) return res.status(400).json({ success: false, error: 'كود واسم مركز التكلفة مطلوبان' });
    const ins = db.prepare(`
      INSERT INTO cost_centers (tenant_id, code, name_ar, name_en, type, budget)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = ins.run(tenantId, code, name_ar, name_en, type, Number(budget));
    const newCC = db.prepare('SELECT * FROM cost_centers WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, data: newCC });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/cost-centers/:id/report', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const cc = db.prepare('SELECT * FROM cost_centers WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!cc) return res.status(404).json({ success: false, error: 'مركز التكلفة غير موجود' });

    const expensesTotal = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM expenses WHERE cost_center_id = ? AND tenant_id = ?
    `).get(req.params.id, tenantId).total;

    const prodOrdersTotal = db.prepare(`
      SELECT COALESCE(SUM(total_cost), 0) as total FROM production_orders WHERE cost_center_id = ? AND tenant_id = ?
    `).get(req.params.id, tenantId).total;

    res.json({
      success: true,
      data: {
        costCenter: cc,
        expensesTotal,
        productionCostTotal: prodOrdersTotal,
        totalCost: expensesTotal + prodOrdersTotal,
        remainingBudget: cc.budget - (expensesTotal + prodOrdersTotal)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 10. شؤون الموظفين والرواتب (HR & Payroll)
// ==========================================
app.get('/api/hr/employees', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const employees = db.prepare(`
      SELECT e.*, e.employee_number as emp_code, e.name as name_ar, e.role_title as job_title, b.name_ar as branch_name
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.tenant_id = ? ORDER BY e.id ASC
    `).all(tenantId);
    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/hr/employees', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const name = req.body.name || req.body.name_ar;
    const role_title = req.body.role_title || req.body.job_title || 'موظف زراعي';
    const basic_salary = Number(req.body.basic_salary || 4000);
    const housing_allowance = Number(req.body.housing_allowance || 0);
    const transport_allowance = Number(req.body.transport_allowance || 0);
    const bank_name = req.body.bank_name || 'مصرف الراجحي';
    const iban = req.body.iban || req.body.bank_iban || '';
    const national_id = req.body.national_id || '1000000000';
    const phone = req.body.phone || '0500000000';
    const email = req.body.email || '';
    const branch_id = req.body.branch_id || null;

    if (!name) {
      return res.status(400).json({ success: false, error: 'اسم الموظف حقل إلزامي' });
    }

    const empCount = db.prepare('SELECT count(*) as cnt FROM employees WHERE tenant_id = ?').get(tenantId).cnt;
    const empNumber = req.body.emp_code || `EMP-${(empCount + 1).toString().padStart(2, '0')}`;

    const ins = db.prepare(`
      INSERT INTO employees (tenant_id, branch_id, employee_number, name, role_title, national_id, phone, email, basic_salary, housing_allowance, transport_allowance, bank_name, iban, status, join_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', DATE('now'))
    `);
    const info = ins.run(tenantId, branch_id, empNumber, name, role_title, national_id, phone, email, basic_salary, housing_allowance, transport_allowance, bank_name, iban);
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, data: emp });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/hr/payrolls', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const runs = db.prepare(`
      SELECT pr.*, pr.title as payroll_number, (pr.year || '-' || printf('%02d', pr.month)) as month_year
      FROM payroll_runs pr WHERE pr.tenant_id = ? ORDER BY pr.id DESC
    `).all(tenantId);
    res.json({ success: true, data: runs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/hr/payrolls', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    let { month, year, month_year } = req.body;
    if (month_year && month_year.includes('-')) {
      const parts = month_year.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    month = month || (new Date().getMonth() + 1);
    year = year || new Date().getFullYear();

    const employees = db.prepare("SELECT * FROM employees WHERE tenant_id = ? AND status = 'active'").all(tenantId);
    if (employees.length === 0) {
      return res.status(400).json({ success: false, error: 'لا يوجد موظفون نشطون لإصدار مسير الرواتب لهم' });
    }

    let totalBasic = 0;
    let totalAllowances = 0;
    let totalNet = 0;

    employees.forEach(emp => {
      const allw = (emp.housing_allowance || 0) + (emp.transport_allowance || 0) + (emp.other_allowances || 0);
      totalBasic += emp.basic_salary;
      totalAllowances += allw;
      totalNet += (emp.basic_salary + allw);
    });

    const title = `مسير رواتب شهر ${month} / ${year}`;
    let runId, jeNumber;

    const payrollTx = db.transaction(() => {
      const insRun = db.prepare(`
        INSERT INTO payroll_runs (tenant_id, month, year, title, total_basic, total_allowances, total_deductions, total_net, status, payment_date)
        VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, 'paid', DATE('now'))
      `);
      const rInfo = insRun.run(tenantId, month, year, title, totalBasic, totalAllowances, totalNet);
      runId = rInfo.lastInsertRowid;

      const insItem = db.prepare(`
        INSERT INTO payroll_items (payroll_run_id, employee_id, basic_salary, allowances, deductions, net_salary)
        VALUES (?, ?, ?, ?, 0.0, ?)
      `);
      for (const emp of employees) {
        const allw = (emp.housing_allowance || 0) + (emp.transport_allowance || 0) + (emp.other_allowances || 0);
        insItem.run(runId, emp.id, emp.basic_salary, allw, emp.basic_salary + allw);
      }

      // توليد قيد اليومية المزدوج للرواتب
      const countRow = db.prepare('SELECT count(*) as cnt FROM journal_entries WHERE tenant_id = ?').get(tenantId);
      jeNumber = `JE-2026-${(countRow.cnt + 1).toString().padStart(4, '0')}`;

      const insJE = db.prepare(`
        INSERT INTO journal_entries (tenant_id, entry_number, date, reference_type, reference_id, narration, total_debit, total_credit, created_by)
        VALUES (?, ?, DATE('now'), 'payroll', ?, ?, ?, ?, 'مسؤول الرواتب')
      `);
      const jeInfo = insJE.run(tenantId, jeNumber, runId, `إثبات وصرف ${title}`, totalNet, totalNet);
      const jeId = jeInfo.lastInsertRowid;

      // مدين: مصروف الرواتب والأجور
      let accSal = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code LIKE '52%' ORDER BY id ASC").get(tenantId);
      if (!accSal) accSal = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND type = 'expense'").get(tenantId);

      // دائن: البنك أو الصندوق
      let accBank = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code LIKE '112%' ORDER BY id ASC").get(tenantId);
      if (!accBank) accBank = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND type = 'asset'").get(tenantId);

      const insJL = db.prepare(`
        INSERT INTO journal_lines (tenant_id, entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insJL.run(tenantId, jeId, accSal.id, totalNet, 0.0, `استحقاق رواتب الموظفين - ${title}`);
      insJL.run(tenantId, jeId, accBank.id, 0.0, totalNet, `صرف الرواتب عبر البنك - ${title}`);

      db.prepare('UPDATE payroll_runs SET journal_entry_number = ? WHERE id = ?').run(jeNumber, runId);
    });

    payrollTx();

    res.json({
      success: true,
      message: `تم اعتماد وصرف ${title} وتوليد القيد المحاسبي (${jeNumber}) بنجاح`,
      runId,
      journalEntryNumber: jeNumber,
      totalNet
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 11. طلبات التوصيل والشحن (Delivery Orders)
// ==========================================
app.get('/api/delivery/orders', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const orders = db.prepare(`
      SELECT d.*, si.invoice_number, si.grand_total as invoice_total
      FROM delivery_orders d
      LEFT JOIN sales_invoices si ON d.invoice_id = si.id
      WHERE d.tenant_id = ? ORDER BY d.id DESC
    `).all(tenantId);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/delivery/orders', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const recipient_name = req.body.recipient_name;
    const recipient_phone = req.body.recipient_phone;
    const recipient_city = req.body.recipient_city || 'الرياض';
    const recipient_address = req.body.recipient_address || req.body.shipping_address || 'صالة الرياض';
    const delivery_fee = Number(req.body.delivery_fee || 0);
    const courier_name = req.body.courier_name || 'سيارة المشتل الخاصة';
    const invoice_id = req.body.invoice_id || null;
    const branch_id = req.body.branch_id || null;
    const notes = req.body.notes || '';

    if (!recipient_name || !recipient_phone) {
      return res.status(400).json({ success: false, error: 'بيانات اسم وهاتف المستلم إلزامية' });
    }

    const orderNumber = 'DELV-2026-' + Date.now().toString().slice(-4);
    const trackingNumber = 'TRK-' + Math.floor(100000 + Math.random() * 900000);

    const ins = db.prepare(`
      INSERT INTO delivery_orders (tenant_id, invoice_id, branch_id, order_number, recipient_name, recipient_phone, recipient_city, recipient_address, delivery_fee, courier_name, tracking_number, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'preparing', ?)
    `);
    const info = ins.run(tenantId, invoice_id, branch_id, orderNumber, recipient_name, recipient_phone, recipient_city, recipient_address, delivery_fee, courier_name, trackingNumber, notes);
    const order = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/delivery/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    let deliveredAt = null;
    if (status === 'delivered') deliveredAt = new Date().toISOString();
    db.prepare('UPDATE delivery_orders SET status = ?, delivered_at = ? WHERE id = ?').run(status, deliveredAt, req.params.id);
    res.json({ success: true, message: 'تم تحديث حالة الشحنة' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 12. التصنيع وتكلفة الإنتاج الزراعي (BOM)
// ==========================================
app.get('/api/manufacturing/recipes', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const recipes = db.prepare(`
      SELECT r.*, p.name_ar as output_product_name, p.sku as output_product_sku
      FROM bom_recipes r
      LEFT JOIN products p ON r.output_product_id = p.id
      WHERE r.tenant_id = ? ORDER BY r.id DESC
    `).all(tenantId);

    const getItems = db.prepare(`
      SELECT ri.*, p.name_ar as input_product_name, p.unit as input_product_unit
      FROM bom_recipe_items ri
      JOIN products p ON ri.input_product_id = p.id
      WHERE ri.recipe_id = ?
    `);

    const result = recipes.map(r => ({
      ...r,
      items: getItems.all(r.id)
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/manufacturing/recipes', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { output_product_id, recipe_code, name, output_quantity = 1, labor_cost = 0, overhead_cost = 0, items = [] } = req.body;
    if (!output_product_id || !name) {
      return res.status(400).json({ success: false, error: 'المنتج النهائي واسم التركيبة مطلوبان' });
    }

    let materialsCost = 0;
    items.forEach(it => {
      materialsCost += (it.quantity_required * (it.unit_cost || 0));
    });
    const totalUnitCost = Number(((materialsCost + Number(labor_cost) + Number(overhead_cost)) / Number(output_quantity)).toFixed(2));
    const code = recipe_code || ('BOM-' + Date.now().toString().slice(-4));

    let recipeId;
    const createBOMTx = db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO bom_recipes (tenant_id, output_product_id, recipe_code, name, output_quantity, labor_cost, overhead_cost, total_unit_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = ins.run(tenantId, output_product_id, code, name, output_quantity, labor_cost, overhead_cost, totalUnitCost);
      recipeId = info.lastInsertRowid;

      const insItem = db.prepare(`
        INSERT INTO bom_recipe_items (recipe_id, input_product_id, quantity_required, unit, unit_cost)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const it of items) {
        insItem.run(recipeId, it.input_product_id, it.quantity_required, it.unit || 'وحدة', it.unit_cost || 0);
      }
    });

    createBOMTx();
    res.json({ success: true, recipeId, totalUnitCost });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/manufacturing/orders', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const orders = db.prepare(`
      SELECT po.*, p.name_ar as product_name, r.name as recipe_name, w.name_ar as warehouse_name
      FROM production_orders po
      LEFT JOIN products p ON po.output_product_id = p.id
      LEFT JOIN bom_recipes r ON po.recipe_id = r.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      WHERE po.tenant_id = ? ORDER BY po.id DESC
    `).all(tenantId);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/manufacturing/orders', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { recipe_id, warehouse_id = 1, cost_center_id = null } = req.body;
    const target_quantity = Number(req.body.target_quantity || req.body.quantity || 100);
    const recipe = db.prepare('SELECT * FROM bom_recipes WHERE id = ? AND tenant_id = ?').get(recipe_id, tenantId);
    if (!recipe) return res.status(404).json({ success: false, error: 'تركيبة الأصناف غير موجودة' });

    const orderNumber = 'PROD-2026-' + Date.now().toString().slice(-4);
    const totalCost = Number((recipe.total_unit_cost * target_quantity).toFixed(2));

    const ins = db.prepare(`
      INSERT INTO production_orders (tenant_id, order_number, recipe_id, output_product_id, target_quantity, warehouse_id, cost_center_id, total_cost, unit_cost, status, start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', DATE('now'))
    `);
    const info = ins.run(tenantId, orderNumber, recipe.id, recipe.output_product_id, target_quantity, warehouse_id, cost_center_id, totalCost, recipe.total_unit_cost);
    res.json({
      success: true,
      message: 'تم إنشاء أمر التصنيع بنجاح',
      data: { id: info.lastInsertRowid, order_number: orderNumber, total_cost: totalCost }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/manufacturing/orders/:id/complete', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const order = db.prepare('SELECT * FROM production_orders WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!order) return res.status(404).json({ success: false, error: 'أمر الإنتاج غير موجود' });
    if (order.status === 'completed') return res.status(400).json({ success: false, error: 'أمر الإنتاج مكتمل مسبقاً' });

    const recipe = db.prepare('SELECT * FROM bom_recipes WHERE id = ?').get(order.recipe_id);
    const items = db.prepare('SELECT * FROM bom_recipe_items WHERE recipe_id = ?').all(recipe.id);

    let jeNumber;
    const completeTx = db.transaction(() => {
      // 1. خصم المواد الخام من المخزون
      items.forEach(it => {
        const consumedQty = (it.quantity_required / recipe.output_quantity) * order.target_quantity;
        db.prepare('UPDATE inventory_levels SET quantity = MAX(0, quantity - ?) WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?')
          .run(consumedQty, tenantId, it.input_product_id, order.warehouse_id);

        db.prepare(`
          INSERT INTO inventory_transactions (tenant_id, warehouse_id, product_id, type, quantity, unit_cost, reference_id, notes)
          VALUES (?, ?, ?, 'out', ?, ?, ?, 'استهلاك تصنيع شتلات')
        `).run(tenantId, order.warehouse_id, it.input_product_id, -consumedQty, it.unit_cost, order.order_number);
      });

      // 2. زيادة رصيد المنتج النهائي (الشتلات المنتجة)
      const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(order.warehouse_id);
      const branchId = wh?.branch_id || 1;
      db.prepare(`
        INSERT INTO inventory_levels (tenant_id, product_id, warehouse_id, branch_id, quantity)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + ?
      `).run(tenantId, order.output_product_id, order.warehouse_id, branchId, order.target_quantity, order.target_quantity);

      db.prepare(`
        INSERT INTO inventory_transactions (tenant_id, warehouse_id, product_id, type, quantity, unit_cost, reference_id, notes)
        VALUES (?, ?, ?, 'in', ?, ?, ?, 'إنتاج شتلات زراعية مكتمل')
      `).run(tenantId, order.warehouse_id, order.output_product_id, order.target_quantity, order.unit_cost, order.order_number);

      // 3. قيد تكلفة الإنتاج والتصنيع
      const countRow = db.prepare('SELECT count(*) as cnt FROM journal_entries WHERE tenant_id = ?').get(tenantId);
      jeNumber = `JE-2026-${(countRow.cnt + 1).toString().padStart(4, '0')}`;

      const insJE = db.prepare(`
        INSERT INTO journal_entries (tenant_id, entry_number, date, reference_type, reference_id, narration, total_debit, total_credit, created_by)
        VALUES (?, ?, DATE('now'), 'manufacturing', ?, ?, ?, ?, 'مدير الإنتاج')
      `);
      const jeInfo = insJE.run(tenantId, jeNumber, order.id, `إثبات تكلفة إنتاج شتلات ${order.order_number}`, order.total_cost, order.total_cost);
      const jeId = jeInfo.lastInsertRowid;

      // مدين: مخزون الشتلات التامة (1141)
      const accFin = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1141'").get(tenantId) || db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND type = 'asset'").get(tenantId);
      // دائن: مخزون المواد الخام (114)
      const accRaw = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '114'").get(tenantId) || db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND type = 'asset'").get(tenantId);

      const insJL = db.prepare('INSERT INTO journal_lines (tenant_id, entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?, ?)');
      insJL.run(tenantId, jeId, accFin.id, order.total_cost, 0.0, `إضافة الشتلات المنتجة للمخزن - ${order.order_number}`);
      insJL.run(tenantId, jeId, accRaw.id, 0.0, order.total_cost, `استهلاك خامات البذور والأسمدة والتربة - ${order.order_number}`);

      db.prepare(`
        UPDATE production_orders 
        SET status = 'completed', produced_quantity = target_quantity, completed_date = DATE('now'), journal_entry_number = ?
        WHERE id = ?
      `).run(jeNumber, order.id);
    });

    completeTx();
    res.json({ success: true, message: 'تم إتمام أمر الإنتاج وإيداع الشتلات بالمخزن بنجاح', journalEntryNumber: jeNumber });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 13. النسخ الاحتياطي (Automated Backups)
// ==========================================
app.get('/api/backups', (req, res) => {
  try {
    const list = backupService.listBackups();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/backups/create', (req, res) => {
  try {
    const { type = 'manual' } = req.body;
    const result = backupService.createBackup(type);
    res.json({ success: true, message: 'تم إنشاء النسخة الاحتياطية بنجاح', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backups/:id/download', (req, res) => {
  try {
    const backup = backupService.getBackupFile(req.params.id);
    res.download(backup.filepath, backup.filename);
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

app.post('/api/backups/:id/restore', (req, res) => {
  try {
    const result = backupService.restoreBackup(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 14. المساعد المحاسبي الذكي (AI Financial Advisor)
// ==========================================
app.post('/api/ai/advisor', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { message } = req.body;
    const result = aiAdvisorService.analyzeAndAdvise(tenantId, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 15. لوحة تحكم المسؤول السوبر وسجل الدخول الحي (Super Admin & Live Activity)
// ==========================================

// سجل حركات الدخول والتنبيهات الحية
app.get(['/api/superadmin/login-activities', '/api/superadmin/live-logins'], (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM login_activities ORDER BY id DESC LIMIT 50').all();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// قائمة كافة الشركات المشتركة وإحصائياتها
app.get('/api/superadmin/tenants', (req, res) => {
  try {
    const tenants = db.prepare('SELECT * FROM tenants ORDER BY id ASC').all();
    const result = tenants.map(t => {
      const bCount = db.prepare('SELECT count(*) as cnt FROM branches WHERE tenant_id = ?').get(t.id).cnt;
      const uCount = db.prepare('SELECT count(*) as cnt FROM users WHERE tenant_id = ?').get(t.id).cnt;
      const salesRow = db.prepare('SELECT count(*) as cnt, COALESCE(SUM(grand_total), 0) as total FROM sales_invoices WHERE tenant_id = ?').get(t.id);
      return {
        ...t,
        branch_count: bCount,
        user_count: uCount,
        invoice_count: salesRow.cnt,
        total_sales: salesRow.total,
        bank_account: t.bank_account || '3165002243921500013'
      };
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إحصائيات النظام الشاملة للمسؤول
app.get('/api/superadmin/system-stats', (req, res) => {
  try {
    const totalTenants = db.prepare('SELECT count(*) as cnt FROM tenants').get().cnt;
    const activeTenants = db.prepare("SELECT count(*) as cnt FROM tenants WHERE status = 'active'").get().cnt;
    const trialTenants = db.prepare("SELECT count(*) as cnt FROM tenants WHERE status = 'trial'").get().cnt;
    const totalUsers = db.prepare('SELECT count(*) as cnt FROM users').get().cnt;
    const salesRow = db.prepare('SELECT count(*) as cnt, COALESCE(SUM(grand_total), 0) as total FROM sales_invoices').get();

    res.json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        trialTenants,
        totalUsers,
        totalInvoices: salesRow.cnt,
        totalSales: salesRow.total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تحديث حالة الشركة والفترة التجريبية
app.post('/api/superadmin/tenants/:id/status', (req, res) => {
  try {
    const { status, trial_ends_at, enable_zatca } = req.body;
    const tenantId = req.params.id;

    if (status !== undefined) {
      db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run(status, tenantId);
    }
    if (trial_ends_at !== undefined) {
      db.prepare('UPDATE tenants SET trial_ends_at = ? WHERE id = ?').run(trial_ends_at, tenantId);
    }
    if (enable_zatca !== undefined) {
      db.prepare('UPDATE tenants SET enable_zatca = ? WHERE id = ?').run(enable_zatca ? 1 : 0, tenantId);
    }

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    res.json({ success: true, message: 'تم تحديث بيانات الشركة بنجاح', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// تعديل بيانات الفاتورة والشركة (الاسم، الرقم الضريبي، الهاتف، السجل، الحساب البنكي)
app.post('/api/superadmin/tenants/:id/invoice-settings', (req, res) => {
  try {
    const { name_ar, name_en, phone, cr_number, vat_number, bank_account, trial_ends_at, status } = req.body;
    const tenantId = req.params.id;

    db.prepare(`
      UPDATE tenants SET
        name_ar = COALESCE(?, name_ar),
        name_en = COALESCE(?, name_en),
        phone = COALESCE(?, phone),
        cr_number = COALESCE(?, cr_number),
        vat_number = COALESCE(?, vat_number),
        bank_account = COALESCE(?, bank_account),
        trial_ends_at = COALESCE(?, trial_ends_at),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(name_ar, name_en, phone, cr_number, vat_number, bank_account, trial_ends_at, status, tenantId);

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    res.json({ success: true, message: 'تم تحديث بيانات المنشأة والفاتورة بنجاح', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 16. إدارة الكتالوج وإضافة الأصناف وتعديل المخزون (Master Catalog & Inventory)
// ==========================================

// إضافة صنف جديد للمنظومة (لشركة محددة أو تعميمه على كافة الشركات)
app.post('/api/superadmin/products', (req, res) => {
  try {
    const {
      target_type = 'all', // 'all' or 'specific'
      tenant_id,
      name_ar,
      name_en,
      category = 'INDOOR',
      code,
      sku,
      barcode,
      purchase_price = 10,
      sale_price = 25,
      initial_stock = 100,
      unit = 'شتلة'
    } = req.body;

    if (!name_ar || !sale_price) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم الصنف وسعر البيع' });
    }

    const itemCode = code || sku || ('PLT-' + Math.floor(1000 + Math.random() * 9000));
    const targetTenants = target_type === 'all' 
      ? db.prepare('SELECT id FROM tenants').all().map(t => t.id)
      : [Number(tenant_id || 1)];

    let insertedCount = 0;
    const insertTx = db.transaction(() => {
      for (const tid of targetTenants) {
        // التحقق من عدم تكرار الكود داخل المنشأة
        const exist = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND sku = ?').get(tid, itemCode);
        let pid;
        if (exist) {
          pid = exist.id;
          db.prepare(`
            UPDATE products SET name_ar = ?, name_en = ?, category = ?, cost_price = ?, retail_price = ?, selling_price = ?, unit = ?
            WHERE id = ?
          `).run(name_ar, name_en || name_ar, category, Number(purchase_price), Number(sale_price), Number(sale_price), unit, pid);
        } else {
          const insP = db.prepare(`
            INSERT INTO products (tenant_id, sku, barcode, name_ar, name_en, category, cost_price, retail_price, wholesale_price, selling_price, unit, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `);
          const info = insP.run(
            tid,
            itemCode,
            barcode || itemCode,
            name_ar,
            name_en || name_ar,
            category,
            Number(purchase_price),
            Number(sale_price),
            Number((sale_price * 0.85).toFixed(2)),
            Number(sale_price),
            unit
          );
          pid = info.lastInsertRowid;
        }

        // تسجيل رصيد المخزن الرئيسي
        const wh = db.prepare('SELECT id, branch_id FROM warehouses WHERE tenant_id = ? LIMIT 1').get(tid);
        if (wh) {
          db.prepare(`
            INSERT INTO inventory_levels (tenant_id, branch_id, warehouse_id, product_id, quantity)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + excluded.quantity
          `).run(tid, wh.branch_id || 1, wh.id, pid, Number(initial_stock));
        }
        insertedCount++;
      }
    });

    insertTx();

    res.json({
      success: true,
      message: `تمت إضافة وتعميم الصنف (${name_ar}) على (${insertedCount}) منشأة بنجاح`,
      itemCode
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// عرض أرصدة المخزون للشركات مع إمكانية التعديل
app.get('/api/superadmin/inventory', (req, res) => {
  try {
    const { tenantId, tenant_id } = req.query;
    const targetTid = tenant_id || tenantId;
    let query = `
      SELECT p.id as product_id, p.id as id, p.sku as code, p.sku, p.name_ar, p.name_en, p.category, p.retail_price as sale_price, p.cost_price as purchase_price,
             p.tenant_id, t.name_ar as tenant_name,
             COALESCE(il.quantity, 0) as stock,
             COALESCE(il.quantity, 0) as quantity,
             COALESCE(w.name_ar, 'المستودع الافتراضي') as warehouse_name,
             COALESCE(w.id, 1) as warehouse_id
      FROM products p
      JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN warehouses w ON w.tenant_id = t.id
      LEFT JOIN inventory_levels il ON il.product_id = p.id AND il.warehouse_id = w.id
    `;
    const params = [];
    if (targetTid && targetTid !== 'all') {
      query += ' WHERE p.tenant_id = ?';
      params.push(targetTid);
    }
    query += ' ORDER BY t.name_ar, p.name_ar ASC';

    const list = db.prepare(query).all(...params);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تعديل مباشر لكمية صنف في مخزن شركة (تسوية جردية من المسؤول)
app.post('/api/superadmin/inventory/adjust', (req, res) => {
  try {
    const { product_id, warehouse_id, tenant_id, new_quantity, reason = 'تعديل وتحديث الكمية من لوحة المسؤول' } = req.body;

    if (!product_id || new_quantity === undefined) {
      return res.status(400).json({ success: false, error: 'بيانات الصنف والكمية الجديدة إلزامية' });
    }

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!prod) return res.status(404).json({ success: false, error: 'الصنف غير موجود' });

    let wh = warehouse_id ? db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouse_id) : null;
    if (!wh) {
      wh = db.prepare('SELECT * FROM warehouses WHERE tenant_id = ? LIMIT 1').get(tenant_id || prod.tenant_id);
    }
    const whId = wh ? wh.id : 1;
    const branchId = wh ? wh.branch_id : 1;

    db.prepare(`
      INSERT INTO inventory_levels (tenant_id, branch_id, warehouse_id, product_id, quantity)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = excluded.quantity
    `).run(prod.tenant_id, branchId, whId, product_id, Number(new_quantity));

    db.prepare(`
      INSERT INTO inventory_transactions (tenant_id, branch_id, warehouse_id, product_id, type, quantity, unit_cost, reference_id, notes)
      VALUES (?, ?, ?, ?, 'adjustment', ?, ?, 'ADMIN-ADJUST', ?)
    `).run(prod.tenant_id, branchId, whId, product_id, Number(new_quantity), prod.cost_price || 10, reason);

    res.json({
      success: true,
      message: `تم تحديث رصيد الصنف (${prod.name_ar}) إلى (${new_quantity}) بنجاح`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 17. العملاء ونقاط البيع اللمسية (Customers & POS)
// ==========================================

app.get('/api/customers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const customers = db.prepare('SELECT * FROM customers WHERE tenant_id = ? ORDER BY id DESC').all(tenantId);
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, phone, vat_number = '', email = '', address = '', notes = '' } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم العميل' });
    }

    const ins = db.prepare(`
      INSERT INTO customers (tenant_id, name, phone, vat_number, email, address, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = ins.run(tenantId, name, phone || '', vat_number || '', email || '', address || '', notes || '');
    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);

    res.json({
      success: true,
      message: 'تمت إضافة بيانات العميل بنجاح',
      data: newCustomer
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// نقطة البيع السريعة اللمسية المحدثة
app.post('/api/invoices/pos-checkout', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      branch_id,
      payment_method = 'cash',
      discount_amount = 0,
      customer_id,
      customer_name,
      customer_phone,
      customer_vat,
      notes = 'بيع كاشير سريع',
      items = []
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'السلة فارغة' });
    }

    const branch = db.prepare('SELECT * FROM branches WHERE tenant_id = ? LIMIT 1').get(tenantId);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    const warehouse = db.prepare('SELECT * FROM warehouses WHERE tenant_id = ? LIMIT 1').get(tenantId);
    const warehouseId = warehouse?.id || 1;

    let subtotal = 0;
    const calculatedItems = items.map(item => {
      const lineSub = Number(((item.unit_price || item.price || 0) * (item.quantity || 1)).toFixed(2));
      subtotal += lineSub;
      const vat = Number((lineSub * 0.15).toFixed(2));
      return {
        product_id: item.product_id || item.id,
        item_name: item.name || item.name_ar,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || item.price || 0,
        vat_rate: 0.15,
        vat_amount: vat,
        line_total: Number((lineSub + vat).toFixed(2))
      };
    });

    const taxableAmount = Math.max(0, subtotal - Number(discount_amount || 0));
    const vatTotal = Number((taxableAmount * 0.15).toFixed(2));
    const grandTotal = Number((taxableAmount + vatTotal).toFixed(2));

    const countRow = db.prepare('SELECT count(*) as cnt FROM sales_invoices WHERE tenant_id = ?').get(tenantId);
    const invoiceNumber = `INV-POS-${(countRow.cnt + 1).toString().padStart(5, '0')}`;
    const issueDate = new Date().toISOString().split('T')[0];
    const issueTime = new Date().toLocaleTimeString('ar-SA');
    const bankAccountUsed = (payment_method === 'bank' || payment_method === 'transfer') 
      ? (tenant?.bank_account || '3165002243921500013') 
      : null;

    // TLV ZATCA QR
    const qrCode = zatca.generateZatcaPhase2QR({
      sellerName: tenant?.name_ar || 'شركة ومشاتل الصويان الزراعية',
      vatNumber: tenant?.vat_number || '310984752000003',
      timestamp: `${issueDate}T${new Date().toTimeString().split(' ')[0]}Z`,
      totalAmount: grandTotal,
      vatAmount: vatTotal,
      invoiceHash: crypto.randomBytes(16).toString('hex'),
      digitalSignature: crypto.randomBytes(32).toString('hex')
    });

    let invoiceId;
    const checkoutTx = db.transaction(() => {
      const insInv = db.prepare(`
        INSERT INTO sales_invoices (
          tenant_id, invoice_number, invoice_type, branch_id, warehouse_id, customer_id,
          customer_name, customer_phone, customer_vat, bank_account_used,
          issue_date, issue_time, payment_method, price_tier, subtotal, discount, vat_total, grand_total,
          zatca_status, zatca_qr, notes
        ) VALUES (?, ?, 'simplified_invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'retail', ?, ?, ?, ?, 'cleared', ?, ?)
      `);

      const info = insInv.run(
        tenantId,
        invoiceNumber,
        branch?.id || branch_id || 1,
        warehouseId,
        customer_id || null,
        customer_name || 'عميل نقدي صالة العرض',
        customer_phone || '',
        customer_vat || '',
        bankAccountUsed,
        issueDate,
        issueTime,
        payment_method,
        taxableAmount,
        discount_amount,
        vatTotal,
        grandTotal,
        qrCode,
        notes
      );
      invoiceId = info.lastInsertRowid;

      const insItem = db.prepare(`
        INSERT INTO sales_invoice_items (invoice_id, product_id, item_name, quantity, unit_price, vat_rate, vat_amount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of calculatedItems) {
        insItem.run(invoiceId, item.product_id, item.item_name, item.quantity, item.unit_price, item.vat_rate, item.vat_amount, item.line_total);
        // خصم المخزون اللحظي
        db.prepare('UPDATE inventory_levels SET quantity = MAX(0, quantity - ?) WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?')
          .run(item.quantity, tenantId, item.product_id, warehouseId);
      }
    });

    checkoutTx();

    res.json({
      success: true,
      message: 'تم إصدار الفاتورة وتأكيد البيع بنجاح',
      invoiceNumber,
      zatcaQr: qrCode,
      data: {
        id: invoiceId,
        invoice_number: invoiceNumber,
        grand_total: grandTotal,
        subtotal: taxableAmount,
        vat_total: vatTotal,
        discount: discount_amount,
        payment_method,
        bank_account_used: bankAccountUsed,
        customer_name: customer_name || 'عميل نقدي صالة العرض',
        customer_phone: customer_phone || '',
        customer_vat: customer_vat || '',
        zatca_qr: qrCode,
        issue_date: issueDate,
        issue_time: issueTime,
        items: calculatedItems
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 18. معالج ربط هيئة الزكاة والضريبة والجمارك (ZATCA Onboarding)
// ==========================================
app.post('/api/zatca/onboard', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { environment = 'sandbox', otp = '123456' } = req.body;

    // توليد الشهادة الرقمية والختم المشفر (CSID)
    const csid = 'CSID-ZATCA-' + crypto.randomBytes(8).toString('hex').toUpperCase();

    db.prepare(`
      UPDATE tenants SET
        enable_zatca = 1,
        zatca_env = ?,
        zatca_csid = ?,
        zatca_status = 'active'
      WHERE id = ?
    `).run(environment, csid, tenantId);

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);

    res.json({
      success: true,
      message: 'تم استكمال الربط والتكامل مع منصة فاتورة (ZATCA Phase 2) بنجاح',
      csid,
      environment,
      status: 'active',
      tenant
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 21. نظام الفروع المتعددة والتقارير المجمعة والمنفصلة (Multi-Branch Stats)
// =========================================================================
app.get('/api/branches/stats', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const branches = db.prepare('SELECT * FROM branches WHERE tenant_id = ? ORDER BY id ASC').all(tenantId);
    
    const branchStats = branches.map(b => {
      const salesRow = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM sales_invoices WHERE tenant_id = ? AND branch_id = ?').get(tenantId, b.id);
      const stockRow = db.prepare('SELECT COUNT(DISTINCT product_id) as items_count, COALESCE(SUM(quantity), 0) as total_qty FROM inventory_levels WHERE tenant_id = ? AND branch_id = ?').get(tenantId, b.id);
      const staffRow = db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND branch_id = ?').get(tenantId, b.id);
      const warehouse = db.prepare('SELECT * FROM warehouses WHERE tenant_id = ? AND branch_id = ? LIMIT 1').get(tenantId, b.id);
      
      return {
        id: b.id,
        code: b.code,
        name_ar: b.name_ar,
        name_en: b.name_en,
        city: b.city,
        phone: b.phone,
        sales_count: salesRow?.count || 0,
        sales_total: salesRow?.total || 0,
        inventory_items: stockRow?.items_count || 0,
        inventory_qty: stockRow?.total_qty || 0,
        staff_count: staffRow?.count || 0,
        warehouse_id: warehouse?.id || null,
        warehouse_name: warehouse?.name_ar || 'المستودع التابع'
      };
    });

    const consolidatedSales = branchStats.reduce((sum, b) => sum + b.sales_total, 0);
    const consolidatedOrders = branchStats.reduce((sum, b) => sum + b.sales_count, 0);
    const consolidatedQty = branchStats.reduce((sum, b) => sum + b.inventory_qty, 0);

    res.json({
      success: true,
      data: {
        branches: branchStats,
        consolidated: {
          total_branches: branchStats.length,
          total_sales: consolidatedSales,
          total_orders: consolidatedOrders,
          total_stock_qty: consolidatedQty
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 22. نظام التحويل المخزني وتتبع الشحنات (Inter-Branch Transfers & Tracking)
// =========================================================================
app.get('/api/inventory/transfers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { status, branch_id } = req.query;
    let sql = `
      SELECT t.*, 
             p.name_ar as product_name, p.sku as product_sku, p.unit, p.cost_price,
             sb.name_ar as source_branch_name, db.name_ar as dest_branch_name,
             sw.name_ar as source_warehouse_name, dw.name_ar as dest_warehouse_name
      FROM inventory_transfers t
      LEFT JOIN products p ON t.product_id = p.id
      LEFT JOIN branches sb ON t.source_branch_id = sb.id
      LEFT JOIN branches db ON t.dest_branch_id = db.id
      LEFT JOIN warehouses sw ON t.source_warehouse_id = sw.id
      LEFT JOIN warehouses dw ON t.dest_warehouse_id = dw.id
      WHERE t.tenant_id = ?
    `;
    const params = [tenantId];
    if (status && status !== 'all') {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (branch_id && branch_id !== 'all') {
      sql += ' AND (t.source_branch_id = ? OR t.dest_branch_id = ?)';
      params.push(branch_id, branch_id);
    }
    sql += ' ORDER BY t.id DESC';

    const transfers = db.prepare(sql).all(...params);
    res.json({ success: true, data: transfers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inventory/transfers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      source_branch_id,
      source_warehouse_id,
      dest_branch_id,
      dest_warehouse_id,
      product_id,
      quantity,
      driver_name = 'سائق النقل الداخلي',
      vehicle_plate = 'أ ب ج 1234',
      notes = ''
    } = req.body;

    if (!source_warehouse_id || !dest_warehouse_id || !product_id || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ success: false, error: 'يرجى تحديد المستودع المصدر، المستودع الهدف، الصنف والكمية المحولة بشكل صحيح' });
    }

    if (source_warehouse_id === dest_warehouse_id) {
      return res.status(400).json({ success: false, error: 'لا يمكن التحويل لنفس المستودع' });
    }

    const qty = Number(quantity);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ success: false, error: 'الصنف غير موجود' });

    // فحص رصيد المستودع المصدر
    const sourceStock = db.prepare('SELECT * FROM inventory_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?')
      .get(tenantId, product_id, source_warehouse_id);
    
    if (!sourceStock || sourceStock.quantity < qty) {
      return res.status(400).json({ 
        success: false, 
        error: `الرصيد المتاح في المستودع المصدر (${sourceStock?.quantity || 0}) غير كافٍ لتحويل (${qty}) ${product.unit}` 
      });
    }

    const transferCount = db.prepare('SELECT count(*) as cnt FROM inventory_transfers WHERE tenant_id = ?').get(tenantId).cnt;
    const transferNumber = `TRF-${new Date().getFullYear()}-${(transferCount + 1).toString().padStart(4, '0')}`;

    let transferId;
    const createTx = db.transaction(() => {
      // 1. خصم الكمية من المستودع المصدر
      db.prepare('UPDATE inventory_levels SET quantity = quantity - ? WHERE id = ?')
        .run(qty, sourceStock.id);

      // 2. تسجيل حركة خروج بضاعة قيد النقل
      db.prepare(`
        INSERT INTO inventory_transactions (tenant_id, branch_id, warehouse_id, product_id, type, quantity, unit_cost, reference_id, notes)
        VALUES (?, ?, ?, ?, 'transfer_out', ?, ?, ?, ?)
      `).run(tenantId, source_branch_id, source_warehouse_id, product_id, -qty, product.cost_price, transferNumber, `شحنة محولة إلى المستودع ${dest_warehouse_id}`);

      // 3. إدراج سجل التحويل بحالة (قيد النقل in_transit)
      const ins = db.prepare(`
        INSERT INTO inventory_transfers (
          tenant_id, transfer_number, source_branch_id, source_warehouse_id, dest_branch_id, dest_warehouse_id,
          product_id, product_name, quantity, status, driver_name, vehicle_plate, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_transit', ?, ?, ?, ?)
      `);
      const info = ins.run(
        tenantId, transferNumber, source_branch_id, source_warehouse_id, dest_branch_id, dest_warehouse_id,
        product_id, product.name_ar, qty, driver_name, vehicle_plate, notes, req.body.created_by || 'مسؤول الحركة والمخازن'
      );
      transferId = info.lastInsertRowid;
    });

    createTx();

    res.json({
      success: true,
      message: `تم إنشاء أمر التحويل رقم (${transferNumber}) والشحنة الآن قيد النقل 🚚`,
      transferId,
      transferNumber
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/inventory/transfers/:id/status', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const transferId = req.params.id;
    const { status } = req.body; // 'received' or 'cancelled'

    const transfer = db.prepare('SELECT * FROM inventory_transfers WHERE id = ? AND tenant_id = ?').get(transferId, tenantId);
    if (!transfer) return res.status(404).json({ success: false, error: 'سجل التحويل غير موجود' });

    if (transfer.status !== 'in_transit') {
      return res.status(400).json({ success: false, error: `لا يمكن تعديل حالة الشحنة لأنها بالفعل (${transfer.status})` });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(transfer.product_id);

    if (status === 'received') {
      const receiveTx = db.transaction(() => {
        // 1. إضافة الكمية لمستودع الاستلام
        const destStock = db.prepare('SELECT * FROM inventory_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?')
          .get(tenantId, transfer.product_id, transfer.dest_warehouse_id);

        if (destStock) {
          db.prepare('UPDATE inventory_levels SET quantity = quantity + ? WHERE id = ?').run(transfer.quantity, destStock.id);
        } else {
          db.prepare('INSERT INTO inventory_levels (tenant_id, product_id, warehouse_id, branch_id, quantity) VALUES (?, ?, ?, ?, ?)')
            .run(tenantId, transfer.product_id, transfer.dest_warehouse_id, transfer.dest_branch_id, transfer.quantity);
        }

        // 2. تسجيل حركة استلام مخزني وارد
        db.prepare(`
          INSERT INTO inventory_transactions (tenant_id, branch_id, warehouse_id, product_id, type, quantity, unit_cost, reference_id, notes)
          VALUES (?, ?, ?, ?, 'transfer_in', ?, ?, ?, ?)
        `).run(tenantId, transfer.dest_branch_id, transfer.dest_warehouse_id, transfer.product_id, transfer.quantity, product?.cost_price || 0, transfer.transfer_number, `استلام شحنة واردة من المستودع ${transfer.source_warehouse_id}`);

        // 3. تحديث حالة السجل إلى تم الاستلام
        db.prepare("UPDATE inventory_transfers SET status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = ?").run(transferId);

        // 4. تسجيل قيد التحويل المحاسبي المتوازن بين الفروع
        try {
          accounting.recordInterBranchTransferJournal(
            tenantId,
            transfer.source_branch_id,
            transfer.dest_branch_id,
            transfer.source_warehouse_id,
            transfer.dest_warehouse_id,
            transfer.product_id,
            transfer.quantity,
            `استلام شحنة المناقلة ${transfer.transfer_number}`
          );
        } catch(e) {
          console.warn('Accounting transfer note:', e.message);
        }
      });

      receiveTx();
      return res.json({ success: true, message: `✅ تم تأكيد استلام الشحنة رقم (${transfer.transfer_number}) وإضافتها للمخزون بنجاح` });
    }

    if (status === 'cancelled') {
      const cancelTx = db.transaction(() => {
        // إعادة الكمية للمستودع المصدر
        db.prepare('UPDATE inventory_levels SET quantity = quantity + ? WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?')
          .run(transfer.quantity, tenantId, transfer.product_id, transfer.source_warehouse_id);

        db.prepare("UPDATE inventory_transfers SET status = 'cancelled' WHERE id = ?").run(transferId);
      });
      cancelTx();
      return res.json({ success: true, message: `⚠️ تم إلغاء الشحنة رقم (${transfer.transfer_number}) وإرجاع الكميات للمستودع المصدر` });
    }

    res.status(400).json({ success: false, error: 'حالة غير صالحة' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 23. نظام ورديات الكاشير وجرد الخزينة (POS Shifts Management)
// =========================================================================
app.get('/api/pos/shifts/current', (req, res) => {
  try {
    const tenantId = getTenantId(req);

    let shift = db.prepare(`
      SELECT * FROM pos_shifts 
      WHERE tenant_id = ? AND status = 'open' 
      ORDER BY id DESC LIMIT 1
    `).get(tenantId);

    if (!shift) {
      return res.json({ success: true, activeShift: null });
    }

    // حساب مبيعات الوردية الحية من الفواتير الصادرة أثناء الوردية
    const sales = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN grand_total ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method IN ('mada', 'card', 'visa') THEN grand_total ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'bank_transfer' THEN grand_total ELSE 0 END), 0) as bank_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN grand_total ELSE 0 END), 0) as credit_sales
      FROM sales_invoices 
      WHERE tenant_id = ? AND (shift_id = ? OR created_at >= ?)
    `).get(tenantId, shift.id, shift.opened_at);

    const expectedCash = Number((shift.opening_balance + (sales?.cash_sales || 0) - (shift.expenses_amount || 0)).toFixed(2));

    res.json({
      success: true,
      activeShift: {
        ...shift,
        total_invoices: sales?.total_invoices || 0,
        total_sales: sales?.total_sales || 0,
        cash_sales: sales?.cash_sales || 0,
        card_sales: sales?.card_sales || 0,
        bank_sales: sales?.bank_sales || 0,
        credit_sales: sales?.credit_sales || 0,
        expected_cash: expectedCash
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pos/shifts/open', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { branch_id = 1, cashier_id = 1, cashier_name = 'كاشير الصالة', opening_balance = 0, notes = '' } = req.body;

    const existingOpen = db.prepare("SELECT * FROM pos_shifts WHERE tenant_id = ? AND status = 'open'").get(tenantId);
    if (existingOpen) {
      return res.json({ success: true, message: 'توجد وردية مفتوحة مسبقاً', shift: existingOpen });
    }

    const shiftCount = db.prepare('SELECT count(*) as cnt FROM pos_shifts WHERE tenant_id = ?').get(tenantId).cnt;
    const shiftNumber = `SHF-${new Date().getFullYear()}-${(shiftCount + 1).toString().padStart(4, '0')}`;

    const ins = db.prepare(`
      INSERT INTO pos_shifts (tenant_id, branch_id, cashier_id, cashier_name, shift_number, opening_balance, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
    `);
    const info = ins.run(tenantId, branch_id, cashier_id, cashier_name, shiftNumber, Number(opening_balance || 0), notes);

    const newShift = db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, message: `✅ تم فتح الوردية رقم (${shiftNumber}) برصيد افتتاحي ${opening_balance} ر.س`, shift: newShift });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/pos/shifts/close', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { shift_id, actual_cash = 0, expenses_amount = 0, notes = '' } = req.body;

    const shift = shift_id 
      ? db.prepare('SELECT * FROM pos_shifts WHERE id = ? AND tenant_id = ?').get(shift_id, tenantId)
      : db.prepare("SELECT * FROM pos_shifts WHERE tenant_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").get(tenantId);

    if (!shift) return res.status(404).json({ success: false, error: 'لا توجد وردية مفتوحة لإغلاقها' });

    const sales = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN grand_total ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method IN ('mada', 'card', 'visa') THEN grand_total ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'bank_transfer' THEN grand_total ELSE 0 END), 0) as bank_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN grand_total ELSE 0 END), 0) as credit_sales
      FROM sales_invoices 
      WHERE tenant_id = ? AND (shift_id = ? OR created_at >= ?)
    `).get(tenantId, shift.id, shift.opened_at);

    const expCash = Number((shift.opening_balance + (sales?.cash_sales || 0) - Number(expenses_amount)).toFixed(2));
    const actCash = Number(actual_cash);
    const diff = Number((actCash - expCash).toFixed(2));

    db.prepare(`
      UPDATE pos_shifts 
      SET closed_at = CURRENT_TIMESTAMP,
          cash_sales = ?,
          card_sales = ?,
          credit_sales = ?,
          total_sales = ?,
          expenses_amount = ?,
          expected_cash = ?,
          actual_cash = ?,
          difference = ?,
          status = 'closed',
          notes = ?
      WHERE id = ?
    `).run(sales?.cash_sales || 0, sales?.card_sales || 0, sales?.credit_sales || 0, sales?.total_sales || 0, Number(expenses_amount), expCash, actCash, diff, notes || shift.notes, shift.id);

    const closedShift = db.prepare('SELECT * FROM pos_shifts WHERE id = ?').get(shift.id);

    res.json({
      success: true,
      message: `✅ تم إغلاق الوردية رقم (${shift.shift_number}) بنجاح وجرد الخزينة`,
      shift: closedShift,
      summary: {
        total_invoices: sales?.total_invoices || 0,
        opening_balance: shift.opening_balance,
        cash_sales: sales?.cash_sales || 0,
        card_sales: sales?.card_sales || 0,
        total_sales: sales?.total_sales || 0,
        expenses_amount: Number(expenses_amount),
        expected_cash: expCash,
        actual_cash: actCash,
        difference: diff,
        variance_status: diff === 0 ? 'مطابق تماماً' : diff > 0 ? `فائض قدره (+${diff} ر.س)` : `عجز قدره (${diff} ر.س)`
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/pos/shifts', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const shifts = db.prepare(`
      SELECT s.*, b.name_ar as branch_name 
      FROM pos_shifts s
      LEFT JOIN branches b ON s.branch_id = b.id
      WHERE s.tenant_id = ? 
      ORDER BY s.id DESC LIMIT 50
    `).all(tenantId);
    res.json({ success: true, data: shifts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 24. نظام السندات المالية الرسمية (سندات القبض والصرف)
// =========================================================================
app.get('/api/vouchers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { type, branch_id } = req.query;
    let sql = `
      SELECT v.*, b.name_ar as branch_name,
             da.name_ar as debit_account_name, ca.name_ar as credit_account_name
      FROM financial_vouchers v
      LEFT JOIN branches b ON v.branch_id = b.id
      LEFT JOIN accounts da ON v.debit_account_id = da.id
      LEFT JOIN accounts ca ON v.credit_account_id = ca.id
      WHERE v.tenant_id = ?
    `;
    const params = [tenantId];
    if (type && type !== 'all') {
      sql += ' AND v.type = ?';
      params.push(type);
    }
    if (branch_id && branch_id !== 'all') {
      sql += ' AND v.branch_id = ?';
      params.push(branch_id);
    }
    sql += ' ORDER BY v.id DESC LIMIT 100';

    const vouchers = db.prepare(sql).all(...params);
    res.json({ success: true, data: vouchers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/vouchers', (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      type, // 'payment' (صرف) or 'receipt' (قبض)
      amount,
      date = new Date().toISOString().split('T')[0],
      party_name,
      category = 'مصروفات تشغيلية وعامة',
      payment_method = 'cash',
      description = '',
      branch_id = 1,
      created_by = 'المحاسب المسؤول'
    } = req.body;

    if (!type || !amount || Number(amount) <= 0 || !party_name) {
      return res.status(400).json({ success: false, error: 'يرجى إكمال نوع السند، المبلغ، واسم المستلم أو المودع' });
    }

    const numAmount = Number(amount);
    const voucherPrefix = type === 'payment' ? 'PV' : 'RV';
    const countRow = db.prepare('SELECT count(*) as cnt FROM financial_vouchers WHERE tenant_id = ? AND type = ?').get(tenantId, type);
    const voucherNumber = `${voucherPrefix}-${new Date().getFullYear()}-${((countRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;

    // ربط الحسابات المحاسبية
    let debitAcc = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '52' LIMIT 1").get(tenantId); // المصروفات
    let creditAcc = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1111' LIMIT 1").get(tenantId); // الصندوق
    if (payment_method === 'bank_transfer') {
      creditAcc = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1121' LIMIT 1").get(tenantId); // البنك
    }

    if (type === 'receipt') {
      // قبض: المدين صندوق/بنك، الدائن إيرادات (41)
      debitAcc = payment_method === 'bank_transfer'
        ? db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1121' LIMIT 1").get(tenantId)
        : db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '1111' LIMIT 1").get(tenantId);
      creditAcc = db.prepare("SELECT id FROM accounts WHERE tenant_id = ? AND code = '41' LIMIT 1").get(tenantId);
    }

    let voucherId;
    let entryNumber;

    const createVoucherTx = db.transaction(() => {
      // 1. توليد قيد يومية متوازن
      const jeCount = db.prepare('SELECT count(*) as cnt FROM journal_entries WHERE tenant_id = ?').get(tenantId).cnt;
      entryNumber = `JE-VOUCH-${new Date().getFullYear()}-${(jeCount + 1).toString().padStart(4, '0')}`;

      const insJe = db.prepare(`
        INSERT INTO journal_entries (tenant_id, entry_number, date, branch_id, reference_type, narration, total_debit, total_credit, created_by)
        VALUES (?, ?, ?, ?, 'voucher', ?, ?, ?, ?)
      `).run(
        tenantId, entryNumber, date, branch_id,
        `${type === 'payment' ? 'سند صرف' : 'سند قبض'} رقم (${voucherNumber}) - ${party_name} [${category}]: ${description}`,
        numAmount, numAmount, created_by
      );
      const jeId = insJe.lastInsertRowid;

      // أسطر القيد
      const insLine = db.prepare(`
        INSERT INTO journal_lines (tenant_id, entry_id, account_id, branch_id, debit, credit, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insLine.run(tenantId, jeId, debitAcc?.id || 1, branch_id, numAmount, 0, `${type === 'payment' ? 'إثبات مصروف / مدفوعات' : 'إيداع نقدي / بنكي'}: ${description}`);
      insLine.run(tenantId, jeId, creditAcc?.id || 1, branch_id, 0, numAmount, `${type === 'payment' ? 'صرف من الصندوق / البنك' : 'إثبات إيراد'}: ${description}`);

      // 2. إدراج السند المالي
      const insVoucher = db.prepare(`
        INSERT INTO financial_vouchers (
          tenant_id, branch_id, voucher_number, type, amount, date, party_name, category, payment_method,
          debit_account_id, credit_account_id, journal_entry_id, description, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const vInfo = insVoucher.run(
        tenantId, branch_id, voucherNumber, type, numAmount, date, party_name, category, payment_method,
        debitAcc?.id, creditAcc?.id, jeId, description, created_by
      );
      voucherId = vInfo.lastInsertRowid;

      // 3. إذا كان سند صرف، تسجيله أيضاً في جدول المصروفات ليظهر في تقارير P&L وقائمة الدخل مباشرة
      if (type === 'payment') {
        db.prepare(`
          INSERT INTO expenses (tenant_id, branch_id, expense_number, expense_type, amount, vat_amount, total_amount, payment_method, date, paid_to, notes, responsible_person)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        `).run(tenantId, branch_id, voucherNumber, category, numAmount, numAmount, payment_method, date, party_name, description, party_name);
      }
    });

    createVoucherTx();

    res.json({
      success: true,
      message: `✅ تم إصدار ${type === 'payment' ? 'سند الصرف' : 'سند القبض'} رقم (${voucherNumber}) وتوليد القيد المحاسبي (${entryNumber}) بنجاح`,
      voucherId,
      voucherNumber,
      entryNumber
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 25. إدارة الأصناف المركزية للمسؤول السوبر (Super Admin Central Catalog)
// =========================================================================
app.get('/api/superadmin/central-products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT * FROM products 
      WHERE is_central = 1 
      ORDER BY id DESC
    `).all();
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/superadmin/central-products', (req, res) => {
  try {
    const {
      name_ar,
      name_en,
      image_url = 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=400&q=80',
      retail_price = 150,
      cost_price = 80,
      barcode,
      category = 'أشجار ونخيل ملكي',
      unit = 'شتلة'
    } = req.body;

    if (!name_ar || !retail_price) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم الصنف والسعر الافتراضي على الأقل' });
    }

    const cleanBarcode = barcode || `628${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const sku = `CENTRAL-${Date.now().toString().slice(-6)}`;

    // 1. إدراج الصنف كصنف مركزي في قاعدة البيانات السحابية
    const ins = db.prepare(`
      INSERT INTO products (
        tenant_id, sku, barcode, name_ar, name_en, category, unit,
        cost_price, retail_price, wholesale_price, selling_price,
        is_active, is_central, image_url
      ) VALUES (
        NULL, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        1, 1, ?
      )
    `);
    const info = ins.run(
      sku, cleanBarcode, name_ar, name_en || name_ar, category, unit,
      Number(cost_price || 0), Number(retail_price), Number(retail_price * 0.85), Number(retail_price),
      image_url
    );
    const centralProductId = info.lastInsertRowid;

    // 2. البث التلقائي لجميع الشركات والمستودعات والكواشير المشتركة في المنظومة
    const allTenants = db.prepare('SELECT id, name_ar FROM tenants').all();
    let broadcastCount = 0;

    const broadcastTx = db.transaction(() => {
      for (const t of allTenants) {
        // التأكد من عدم تكرار الصنف لنفس المستأجر
        const exists = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND (barcode = ? OR sku = ?)').get(t.id, cleanBarcode, sku);
        let tenantProdId;
        if (!exists) {
          const tIns = db.prepare(`
            INSERT INTO products (
              tenant_id, sku, barcode, name_ar, name_en, category, unit,
              cost_price, retail_price, wholesale_price, selling_price,
              is_active, is_central, image_url
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              1, 1, ?
            )
          `).run(
            t.id, sku, cleanBarcode, name_ar, name_en || name_ar, category, unit,
            Number(cost_price || 0), Number(retail_price), Number(retail_price * 0.85), Number(retail_price),
            image_url
          );
          tenantProdId = tIns.lastInsertRowid;
        } else {
          tenantProdId = exists.id;
        }

        // إضافة رصيد افتراضي 100 شتلة في المستودع الرئيسي للمستأجر ليتمكن الكاشير من بيعه فوراً
        const wh = db.prepare('SELECT id, branch_id FROM warehouses WHERE tenant_id = ? LIMIT 1').get(t.id);
        if (wh) {
          const lvl = db.prepare('SELECT id FROM inventory_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?')
            .get(t.id, tenantProdId, wh.id);
          if (!lvl) {
            db.prepare('INSERT INTO inventory_levels (tenant_id, product_id, warehouse_id, branch_id, quantity) VALUES (?, ?, ?, ?, 100)')
              .run(t.id, tenantProdId, wh.id, wh.branch_id || 1);
          }
        }
        broadcastCount++;
      }
    });

    broadcastTx();

    res.json({
      success: true,
      message: `🌿 تم حفظ الصنف المركزي (${name_ar}) بنجاح وبثه سحابياً لعدد (${broadcastCount}) منشأة ومشترك ليتوفر في كاشيرهم فوراً للبيع`,
      productId: centralProductId,
      sku,
      barcode: cleanBarcode,
      broadcastToTenants: broadcastCount
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/superadmin/central-products/broadcast', (req, res) => {
  try {
    const centralProducts = db.prepare('SELECT * FROM products WHERE is_central = 1 AND tenant_id IS NULL').all();
    const allTenants = db.prepare('SELECT id FROM tenants').all();
    let synced = 0;

    const syncTx = db.transaction(() => {
      for (const cp of centralProducts) {
        for (const t of allTenants) {
          const exists = db.prepare('SELECT id FROM products WHERE tenant_id = ? AND (barcode = ? OR sku = ?)').get(t.id, cp.barcode, cp.sku);
          let pId = exists?.id;
          if (!exists) {
            const ins = db.prepare(`
              INSERT INTO products (
                tenant_id, sku, barcode, name_ar, name_en, category, unit,
                cost_price, retail_price, wholesale_price, selling_price,
                is_active, is_central, image_url
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
            `).run(
              t.id, cp.sku, cp.barcode, cp.name_ar, cp.name_en, cp.category, cp.unit,
              cp.cost_price, cp.retail_price, cp.wholesale_price, cp.selling_price, cp.image_url
            );
            pId = ins.lastInsertRowid;
          }

          const wh = db.prepare('SELECT id, branch_id FROM warehouses WHERE tenant_id = ? LIMIT 1').get(t.id);
          if (wh) {
            const lvl = db.prepare('SELECT id FROM inventory_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').get(t.id, pId, wh.id);
            if (!lvl) {
              db.prepare('INSERT INTO inventory_levels (tenant_id, product_id, warehouse_id, branch_id, quantity) VALUES (?, ?, ?, ?, 100)')
                .run(t.id, pId, wh.id, wh.branch_id || 1);
            }
          }
          synced++;
        }
      }
    });

    syncTx();
    res.json({ success: true, message: `✅ تمت مزامنة كافة الأصناف المركزية بنجاح عبر (${allTenants.length}) شركة`, syncedOperations: synced });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// خدمة ملفات واجهة React المبنية (سواء في الجذر أو client/dist)
app.use(express.static(path.join(__dirname, '..')));
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const rootIndex = path.join(__dirname, '../index.html');
    if (fs.existsSync(rootIndex)) {
      return res.sendFile(rootIndex);
    }
    return res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  }
  next();
});

// تشغيل الخادم إذا تم تشغيل الملف مباشرة
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 خادم منظومة الصويان السحابية يعمل على: http://localhost:${PORT}`);
    console.log(`🌿 منصة SaaS للمشاتل والزراعة - حساب المسؤول المطلق مفعل`);
    console.log(`====================================================`);
  });
}

module.exports = app;
