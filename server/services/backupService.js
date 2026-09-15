const fs = require('fs');
const path = require('path');
const { db } = require('../db/database');

const dbFile = path.join(__dirname, '../../mohasb.db');
const backupsDir = path.join(__dirname, '../../backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const backupService = {
  createBackup(backupType = 'manual') {
    try {
      if (!fs.existsSync(dbFile)) {
        throw new Error('ملف قاعدة البيانات الرئيسي غير موجود');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `mohasb_backup_${timestamp}.db`;
      const targetPath = path.join(backupsDir, filename);

      // نسخ قاعدة البيانات
      fs.copyFileSync(dbFile, targetPath);
      const stats = fs.statSync(targetPath);

      const ins = db.prepare(`
        INSERT INTO backups (filename, filepath, file_size, backup_type, status)
        VALUES (?, ?, ?, ?, 'success')
      `);
      const info = ins.run(filename, targetPath, stats.size, backupType);

      return {
        id: info.lastInsertRowid,
        filename,
        size: stats.size,
        file_size: stats.size,
        formattedSize: formatBytes(stats.size),
        backupType,
        createdAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('Backup creation error:', err);
      throw err;
    }
  },

  listBackups() {
    try {
      const rows = db.prepare('SELECT * FROM backups ORDER BY id DESC').all();
      return rows.map(r => ({
        ...r,
        formattedSize: formatBytes(r.file_size)
      }));
    } catch (err) {
      console.error('Error listing backups:', err);
      return [];
    }
  },

  getBackupFile(backupId) {
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);
    if (!backup || !fs.existsSync(backup.filepath)) {
      throw new Error('ملف النسخة الاحتياطية غير متوفر');
    }
    return backup;
  },

  restoreBackup(backupId) {
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);
    if (!backup || !fs.existsSync(backup.filepath)) {
      throw new Error('ملف النسخة الاحتياطية غير متوفر للاستعادة');
    }

    // أخذ نسخة احتياطية للحالة الحالية قبل الاستعادة
    const safetyCopy = path.join(backupsDir, `pre_restore_safety_${Date.now()}.db`);
    if (fs.existsSync(dbFile)) {
      fs.copyFileSync(dbFile, safetyCopy);
    }

    fs.copyFileSync(backup.filepath, dbFile);
    return { success: true, message: `تمت استعادة النسخة الاحتياطية بنجاح (${backup.filename})` };
  },

  scheduleDailyBackup() {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const existing = db.prepare(`
        SELECT count(*) as cnt FROM backups 
        WHERE backup_type = 'automated_daily' AND created_at LIKE ?
      `).get(`${todayStr}%`).cnt;

      if (existing === 0) {
        console.log(`[Backup Service] 📦 جاري تنفيذ النسخة الاحتياطية اليومية التلقائية...`);
        this.createBackup('automated_daily');
        console.log(`[Backup Service] ✅ تم إتمام النسخ الاحتياطي اليومي بنجاح.`);
      }
    } catch (err) {
      console.error('[Backup Service] Failed to execute scheduled daily backup:', err.message);
    }
  }
};

module.exports = backupService;
