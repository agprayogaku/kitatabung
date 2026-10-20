/**
 * ============================================================================
 * KitaTabung — Google Apps Script Backend Database (Code.gs)
 * Arsitektur Database Google Spreadsheet untuk Aplikasi Tabungan Bersama
 * 
 * Panduan Pemasangan:
 * 1. Buka Google Spreadsheet baru di browser Anda.
 * 2. Klik menu "Ekstensi" -> pilih "Apps Script".
 * 3. Hapus seluruh kode bawaan, lalu tempelkan kode ini.
 * 4. Klik tombol Simpan (ikon disket).
 * 5. Klik tombol biru "Terapkan" (Deploy) -> pilih "Deployment baru".
 * 6. Pilih jenis deployment: "Aplikasi Web" (Web App).
 * 7. Konfigurasi:
 *    - Jalankan sebagai: "Saya (Me)"
 *    - Akses: "Siapa saja (Anyone)"
 * 8. Klik "Terapkan", beri izin akses Google jika diminta.
 * 9. Salin URL Aplikasi Web (berakhiran /exec) dan tempel ke modal
 *    sinkronisasi di aplikasi KitaTabung.
 * ============================================================================
 */

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsExist_(ss);

    var roomId = (e && e.parameter && e.parameter.roomId) ? e.parameter.roomId : 'tabungan-bersama';
    var state = readStateFromSheets_(ss, roomId);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, state: state }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsExist_(ss);

    var rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = JSON.parse(rawBody);
    var state = payload.state;

    if (!state) {
      throw new Error('Payload state kosong');
    }

    writeStateToSheets_(ss, state);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, updatedAt: state.updatedAt, state: state }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function ensureSheetsExist_(ss) {
  var configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    configSheet = ss.insertSheet('Config');
    configSheet.getRange('A1:C1').setValues([['Kunci Konfigurasi', 'Nilai', 'Keterangan (Bisa Diedit Langsung)']]);
    configSheet.getRange('A1:C1').setFontWeight('bold');
    configSheet.getRange('A2:C13').setValues([
      ['roomId', 'tabungan-bersama', 'Kode ruang sinkronisasi tabungan'],
      ['brandTitle', 'KitaTabung', 'Nama aplikasi di header'],
      ['brandInitials', 'KT', 'Inisial logo aplikasi (maksimal 3 huruf)'],
      ['goalTitle', 'Target Tabungan Bersama', 'Judul sasaran/target tabungan bersama'],
      ['targetAmount', 0, 'Target nominal tabungan dalam Rupiah (0 = fleksibel)'],
      ['targetDate', '', 'Tenggat waktu sasaran (format YYYY-MM-DD)'],
      ['splitMode', 'flexible', 'Mode porsi kontribusi: flexible atau custom'],
      ['splitRatio', 50, 'Persentase porsi Partner 1 (0 - 100)'],
      ['member1Name', 'Partner 1', 'Nama Kontributor Pertama'],
      ['member2Name', 'Partner 2', 'Nama Kontributor Kedua'],
      ['quickAmounts', '100000,250000,500000,1000000,2500000', '5 nominal pintasan cepat tombol setor'],
      ['updatedAt', new Date().toISOString(), 'Waktu pembaruan data terakhir (ISO)']
    ]);
    configSheet.autoResizeColumns(1, 3);
  }

  var txSheet = ss.getSheetByName('Transactions');
  if (!txSheet) {
    txSheet = ss.insertSheet('Transactions');
    txSheet.getRange('A1:G1').setValues([[
      'ID Transaksi', 'Tanggal', 'ID Kontributor', 'Nama Kontributor', 'Tipe (deposit/withdrawal)', 'Nominal', 'Catatan'
    ]]);
    txSheet.getRange('A1:G1').setFontWeight('bold');
    txSheet.autoResizeColumns(1, 7);
  }
}

function readStateFromSheets_(ss, requestedRoomId) {
  var configSheet = ss.getSheetByName('Config');
  var txSheet = ss.getSheetByName('Transactions');

  var configRows = configSheet ? configSheet.getDataRange().getValues() : [];
  var cfg = {};
  for (var i = 1; i < configRows.length; i++) {
    var k = String(configRows[i][0] || '').trim();
    if (k) cfg[k] = configRows[i][1];
  }

  var m1Name = String(cfg.member1Name || 'Partner 1');
  var m2Name = String(cfg.member2Name || 'Partner 2');

  var txRows = txSheet ? txSheet.getDataRange().getValues() : [];
  var transactions = [];
  for (var j = 1; j < txRows.length; j++) {
    var row = txRows[j];
    if (!row[0] && !row[5]) continue;
    var dateVal = row[1];
    if (Object.prototype.toString.call(dateVal) === '[object Date]') {
      dateVal = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }

    var rawMember = String(row[2] || 'member1').toLowerCase();
    var isMember2 = (rawMember === 'member2' || rawMember === 'm2' || rawMember === 'partner2');
    var memberId = isMember2 ? 'member2' : 'member1';

    transactions.push({
      id: String(row[0] || ('tx_sheet_' + j)),
      date: String(dateVal || ''),
      memberId: memberId,
      type: String(row[4] || 'deposit').toLowerCase() === 'withdrawal' ? 'withdrawal' : 'deposit',
      amount: Number(row[5]) || 0,
      note: String(row[6] || '')
    });
  }

  var quickArr = String(cfg.quickAmounts || '100000,250000,500000,1000000,2500000')
    .split(',')
    .map(function(n) { return parseInt(String(n).replace(/[^0-9]/g, ''), 10); })
    .filter(function(n) { return n > 0; });

  var targetDateStr = cfg.targetDate;
  if (Object.prototype.toString.call(targetDateStr) === '[object Date]') {
    targetDateStr = Utilities.formatDate(targetDateStr, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  var splitRatioVal = 50;
  if (cfg.splitRatio !== undefined && cfg.splitRatio !== '') {
    splitRatioVal = Number(cfg.splitRatio);
  }

  return {
    roomId: String(cfg.roomId || requestedRoomId || 'tabungan-bersama'),
    updatedAt: String(cfg.updatedAt || new Date().toISOString()),
    brand: {
      title: String(cfg.brandTitle || 'KitaTabung'),
      initials: String(cfg.brandInitials || 'KT')
    },
    goal: {
      title: String(cfg.goalTitle || 'Target Tabungan Bersama'),
      targetAmount: Number(cfg.targetAmount) || 0,
      targetDate: String(targetDateStr || ''),
      splitMode: String(cfg.splitMode || 'flexible'),
      splitRatio: splitRatioVal,
      quickAmounts: quickArr.length === 5 ? quickArr : [100000, 250000, 500000, 1000000, 2500000]
    },
    members: {
      member1: { id: 'member1', name: m1Name },
      member2: { id: 'member2', name: m2Name }
    },
    transactions: transactions
  };
}

function writeStateToSheets_(ss, state) {
  var configSheet = ss.getSheetByName('Config');
  var txSheet = ss.getSheetByName('Transactions');

  var m1 = (state.members && state.members.member1 && state.members.member1.name)
    ? state.members.member1.name
    : 'Partner 1';
  var m2 = (state.members && state.members.member2 && state.members.member2.name)
    ? state.members.member2.name
    : 'Partner 2';

  var quickStr = (state.goal && Array.isArray(state.goal.quickAmounts))
    ? state.goal.quickAmounts.join(',')
    : '100000,250000,500000,1000000,2500000';

  var ratioVal = (state.goal && state.goal.splitRatio !== undefined)
    ? Number(state.goal.splitRatio)
    : 50;

  var configRows = [
    ['roomId', state.roomId || 'tabungan-bersama', 'Kode ruang sinkronisasi tabungan'],
    ['brandTitle', (state.brand && state.brand.title) || 'KitaTabung', 'Nama aplikasi di header'],
    ['brandInitials', (state.brand && state.brand.initials) || 'KT', 'Inisial logo aplikasi (maksimal 3 huruf)'],
    ['goalTitle', (state.goal && state.goal.title) || 'Target Tabungan Bersama', 'Judul sasaran/target tabungan bersama'],
    ['targetAmount', Number(state.goal && state.goal.targetAmount) || 0, 'Target nominal tabungan dalam Rupiah (0 = fleksibel)'],
    ['targetDate', (state.goal && state.goal.targetDate) || '', 'Tenggat waktu sasaran (format YYYY-MM-DD)'],
    ['splitMode', (state.goal && state.goal.splitMode) || 'flexible', 'Mode porsi kontribusi: flexible atau custom'],
    ['splitRatio', ratioVal, 'Persentase porsi Partner 1 (0 - 100)'],
    ['member1Name', m1, 'Nama Kontributor Pertama'],
    ['member2Name', m2, 'Nama Kontributor Kedua'],
    ['quickAmounts', quickStr, '5 nominal pintasan cepat tombol setor'],
    ['updatedAt', state.updatedAt || new Date().toISOString(), 'Waktu pembaruan data terakhir (ISO)']
  ];
  configSheet.getRange(2, 1, configRows.length, 3).setValues(configRows);

  var lastRow = txSheet.getLastRow();
  if (lastRow > 1) {
    txSheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  }

  var txs = Array.isArray(state.transactions) ? state.transactions : [];
  if (txs.length > 0) {
    var rows = txs.map(function(t) {
      var isM2 = (t.memberId === 'member2' || t.memberId === 'm2' || t.memberId === 'partner2');
      return [
        t.id || '',
        t.date || '',
        isM2 ? 'member2' : 'member1',
        isM2 ? m2 : m1,
        t.type || 'deposit',
        Number(t.amount) || 0,
        t.note || ''
      ];
    });
    txSheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
}
