const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Kullanıcı verileri ve oturum ayarlarının her zaman korunması için userData yolunu sabitliyoruz
const primaryUserData = path.join(app.getPath('appData'), 'ortek-proposal-studio');
const secondaryUserData = path.join(app.getPath('appData'), 'Teklif Programı');
app.setPath('userData', primaryUserData);

// Windows Bildirim Başlığı (Windows Bildirimlerinde "Teklif Programı" olarak gözükmesi için)
app.setAppUserModelId('Teklif Programı');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Ortek Proposal Studio',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  // Beklenmedik çökme veya beyaz ekran durumunda arayüzü otomatik yeniden yükleme (Crash Recovery)
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process gone:', details);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  // Güncelleme kontrolü (Sadece paketlenmiş uygulamada çalışır)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: PDF Kaydetme İşlemi
ipcMain.handle('save-pdf', async (event, { companyName, pdfName, activeCompany }) => {
  try {
    const desktopPath = app.getPath('desktop');
    const baseDir = path.join(desktopPath, 'TEKLİFLERİM');
    
    const subFolderName = (activeCompany === 'phs') ? 'PHS Tekliflerim' : 'Ortek Tekliflerim';
    const subFolderDir = path.join(baseDir, subFolderName);
    
    const safeCompanyName = companyName.trim().replace(/[<>:"/\\|?*]+/g, '_').replace(/[\s.]+$/, '') || 'Bilinmeyen_Musteri';
    const safePdfName = pdfName.trim().replace(/[<>:"/\\|?*]+/g, '_').replace(/[\s.]+$/, '') || 'Teklif';
    
    const companyDir = path.join(subFolderDir, safeCompanyName);
    let pdfPath = path.join(companyDir, `${safePdfName}.pdf`);

    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
    if (!fs.existsSync(subFolderDir)) fs.mkdirSync(subFolderDir, { recursive: true });
    if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });

    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    try {
      fs.writeFileSync(pdfPath, pdfData);
    } catch (writeErr) {
      if (writeErr.code === 'EBUSY') {
        return {
          success: false,
          error: `"${safePdfName}.pdf" dosyası şu anda PDF okuyucunuzda açık olduğu için güncellenemedi. Lütfen açık olan PDF dosyasını kapatıp tekrar deneyiniz.`
        };
      }
      throw writeErr;
    }

    // PDF kaydedildikten sonra otomatik olarak PDF dosyasını aç ve bulunduğu klasörü göster
    try {
      shell.showItemInFolder(pdfPath);
      shell.openPath(pdfPath);
    } catch (openErr) {
      console.warn('Otomatik dosya/klasör açma uyarısı:', openErr);
    }

    return { success: true, path: pdfPath };
  } catch (error) {
    console.error('PDF Kaydetme Hatası:', error);
    return { success: false, error: error.message };
  }
});

// Otomatik Güncelleme Eventleri
autoUpdater.on('update-available', () => {
  console.log('Güncelleme bulundu.');
});
autoUpdater.on('update-downloaded', () => {
  console.log('Güncelleme indirildi. Kuruluyor...');
  autoUpdater.quitAndInstall();
});

// JSON Kaydetme ve Yükleme İşlemleri (localStorage Silinme Sorununa Kesin Çözüm)
ipcMain.handle('save-json', async (event, { key, data }) => {
  try {
    const primaryPath = path.join(primaryUserData, `${key}.json`);
    if (!fs.existsSync(primaryUserData)) fs.mkdirSync(primaryUserData, { recursive: true });
    fs.writeFileSync(primaryPath, JSON.stringify(data), 'utf-8');

    // İkincil dizin varsa oraya da yedek kopya at
    if (fs.existsSync(secondaryUserData)) {
      try {
        fs.writeFileSync(path.join(secondaryUserData, `${key}.json`), JSON.stringify(data), 'utf-8');
      } catch(e) {}
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-json', async (event, { key }) => {
  try {
    const primaryPath = path.join(primaryUserData, `${key}.json`);
    if (fs.existsSync(primaryPath)) {
      const data = fs.readFileSync(primaryPath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    const secondaryPath = path.join(secondaryUserData, `${key}.json`);
    if (fs.existsSync(secondaryPath)) {
      const data = fs.readFileSync(secondaryPath, 'utf-8');
      try {
        if (!fs.existsSync(primaryUserData)) fs.mkdirSync(primaryUserData, { recursive: true });
        fs.writeFileSync(primaryPath, data, 'utf-8');
      } catch(e) {}
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, error: 'File not found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: TCMB Güncel Efektif Satış Kurlarını Çekme (Banknote Selling)
ipcMain.handle('get-tcmb-rates', async () => {
  return new Promise((resolve) => {
    const req = https.get('https://www.tcmb.gov.tr/kurlar/today.xml', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Tarih ve Bülten No
          const dateMatch = data.match(/Tarih_Date\s+Tarih="([^"]+)"\s+Date="([^"]+)"/);
          const bultenMatch = data.match(/Bulten_No="([^"]+)"/);

          const dateStr = dateMatch ? dateMatch[1] : '';
          const bultenNo = bultenMatch ? bultenMatch[1] : '';

          // USD
          let usdBanknoteSelling = null;
          let usdForexSelling = null;
          const usdBlock = data.match(/<Currency[^>]*CurrencyCode="USD"[^>]*>([\s\S]*?)<\/Currency>/);
          if (usdBlock) {
            const bs = usdBlock[1].match(/<BanknoteSelling>([^<]+)<\/BanknoteSelling>/);
            const fs = usdBlock[1].match(/<ForexSelling>([^<]+)<\/ForexSelling>/);
            if (bs && bs[1].trim()) usdBanknoteSelling = parseFloat(bs[1].trim().replace(',', '.'));
            if (fs && fs[1].trim()) usdForexSelling = parseFloat(fs[1].trim().replace(',', '.'));
          }

          // EUR
          let eurBanknoteSelling = null;
          let eurForexSelling = null;
          const eurBlock = data.match(/<Currency[^>]*CurrencyCode="EUR"[^>]*>([\s\S]*?)<\/Currency>/);
          if (eurBlock) {
            const bs = eurBlock[1].match(/<BanknoteSelling>([^<]+)<\/BanknoteSelling>/);
            const fs = eurBlock[1].match(/<ForexSelling>([^<]+)<\/ForexSelling>/);
            if (bs && bs[1].trim()) eurBanknoteSelling = parseFloat(bs[1].trim().replace(',', '.'));
            if (fs && fs[1].trim()) eurForexSelling = parseFloat(fs[1].trim().replace(',', '.'));
          }

          const result = {
            success: true,
            date: dateStr,
            bulletinNo: bultenNo,
            usd: {
              banknoteSelling: usdBanknoteSelling || usdForexSelling || 0,
              forexSelling: usdForexSelling || 0
            },
            eur: {
              banknoteSelling: eurBanknoteSelling || eurForexSelling || 0,
              forexSelling: eurForexSelling || 0
            },
            fetchedAt: new Date().toISOString()
          };

          // Başarılı sonucu yerel yedek dosyaya kaydet
          try {
            const cachePath = path.join(primaryUserData, 'tcmb_rates_cache.json');
            fs.writeFileSync(cachePath, JSON.stringify(result), 'utf-8');
          } catch (e) {}

          resolve(result);
        } catch (parseErr) {
          resolve(loadCachedTcmbRates(parseErr.message));
        }
      });
    });

    req.on('error', (err) => {
      resolve(loadCachedTcmbRates(err.message));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(loadCachedTcmbRates('TCMB bağlantı zaman aşımına uğradı.'));
    });
  });
});

function loadCachedTcmbRates(errorMsg) {
  try {
    const cachePath = path.join(primaryUserData, 'tcmb_rates_cache.json');
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      cached.fromCache = true;
      cached.error = errorMsg;
      return cached;
    }
  } catch (e) {}
  return {
    success: false,
    error: errorMsg || 'TCMB kurları alınamadı.',
    usd: { banknoteSelling: 48.5325, forexSelling: 48.4598 },
    eur: { banknoteSelling: 56.3657, forexSelling: 56.2812 },
    date: '08.09.2026',
    bulletinNo: '2026/168',
    fromCache: true
  };
}

// IPC: Akbank Güncel Döviz Kurlarını Çekme (Gişe Satış Kurları)
ipcMain.handle('get-akbank-rates', async () => {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ kurTuru: "1" });
    const options = {
      hostname: 'www.akbank.com',
      port: 443,
      path: '/_layouts/15/Akbank/CalcTools/Ajax.aspx/GetDovizKurlari',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.akbank.com/mevduat-yatirim/yatirim/doviz/canli-doviz-kurlari'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const list = parsed?.d?.Data?.DovizKurlari || [];
          const usdItem = list.find(x => x.AlfaKod === 'USD');
          const eurItem = list.find(x => x.AlfaKod === 'EUR');

          const usdSatis = usdItem ? parseFloat((usdItem.EfektifSatis || usdItem.DovizSatis || '0').replace(',', '.')) : 0;
          const usdAlis = usdItem ? parseFloat((usdItem.EfektifAlis || usdItem.DovizAlis || '0').replace(',', '.')) : 0;
          const eurSatis = eurItem ? parseFloat((eurItem.EfektifSatis || eurItem.DovizSatis || '0').replace(',', '.')) : 0;
          const eurAlis = eurItem ? parseFloat((eurItem.EfektifAlis || eurItem.DovizAlis || '0').replace(',', '.')) : 0;

          const dateStr = usdItem?.KurGuncellemeZamani || eurItem?.KurGuncellemeZamani || new Date().toLocaleString('tr-TR');

          const result = {
            success: true,
            provider: 'akbank',
            date: dateStr,
            usd: {
              selling: usdSatis || 50.1250,
              buying: usdAlis || 47.6250
            },
            eur: {
              selling: eurSatis || 56.8516,
              buying: eurAlis || 54.0113
            },
            fetchedAt: new Date().toISOString()
          };

          try {
            const cachePath = path.join(primaryUserData, 'akbank_rates_cache.json');
            fs.writeFileSync(cachePath, JSON.stringify(result), 'utf-8');
          } catch (e) {}

          resolve(result);
        } catch (parseErr) {
          resolve(loadCachedAkbankRates(parseErr.message));
        }
      });
    });

    req.on('error', (err) => resolve(loadCachedAkbankRates(err.message)));
    req.on('timeout', () => {
      req.destroy();
      resolve(loadCachedAkbankRates('Akbank bağlantı zaman aşımına uğradı.'));
    });

    req.write(postData);
    req.end();
  });
});

function loadCachedAkbankRates(errorMsg) {
  try {
    const cachePath = path.join(primaryUserData, 'akbank_rates_cache.json');
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      cached.fromCache = true;
      cached.error = errorMsg;
      return cached;
    }
  } catch (e) {}
  return {
    success: false,
    provider: 'akbank',
    error: errorMsg || 'Akbank kurları alınamadı.',
    usd: { selling: 50.1250, buying: 47.6250 },
    eur: { selling: 56.8516, buying: 54.0113 },
    date: '29.09.2026',
    fromCache: true
  };
}

