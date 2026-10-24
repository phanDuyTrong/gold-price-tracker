// ═══════════════════════════════════════════════════════════
// Gold Price API — Google Apps Script
// Lấy giá vàng nhẫn 999.9 từ giavang.org + XAU/USD + USD/VND
// Deploy: Web App | Execute as: Me | Who has access: Anyone
// ═══════════════════════════════════════════════════════════

function doGet(e) {
  var result = { prices: {}, world: {}, ts: new Date().toISOString() };

  // ── 1. Lấy giá các shop từ giavang.org ─────────────────
  try {
    var html = UrlFetchApp.fetch('https://giavang.org/', {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }).getContentText('UTF-8');

    // Tìm bảng vàng nhẫn 1 chỉ
    var nhanIdx = html.indexOf('Nhẫn 1 Ch');
    if (nhanIdx < 0) nhanIdx = html.indexOf('nhẫn 1 ch');
    var section = nhanIdx >= 0 ? html.substring(nhanIdx, nhanIdx + 25000) : html;

    // Map tên shop → id
    var shopMap = [
      { names: ['SJC'],                              id: 'sjc'  },
      { names: ['DOJI'],                             id: 'doji' },
      { names: ['PNJ'],                              id: 'pnj'  },
      { names: ['Bảo Tín Minh Châu', 'Bao Tin Minh Chau'], id: 'btmc' },
      { names: ['Mi Hồng', 'Mi Hong'],          id: 'mh'   },
      { names: ['Phú Quý', 'Phu Quy'],     id: 'pq'   },
      { names: ['Bảo Tín Nghĩa', 'Bảo Tín Mạnh Hải'], id: 'btn' },
    ];

    for (var si = 0; si < shopMap.length; si++) {
      var shopDef = shopMap[si];
      if (result.prices[shopDef.id]) continue;

      for (var ni = 0; ni < shopDef.names.length; ni++) {
        var shopIdx = section.indexOf(shopDef.names[ni]);
        if (shopIdx < 0) continue;

        // Lấy 400 ký tự sau tên shop, tìm 2 số giá
        var nearby = section.substring(shopIdx, shopIdx + 400);
        var matches = nearby.match(/\b(\d{2,3}[.,]\d{3})\b/g);
        if (!matches || matches.length < 2) continue;

        var nums = [];
        for (var mi = 0; mi < matches.length; mi++) {
          var n = parseFloat(matches[mi].replace(/\./g, '').replace(',', '.')) / 1000;
          if (n > 100 && n < 300) nums.push(n);
        }

        if (nums.length >= 2) {
          result.prices[shopDef.id] = {
            buy:  Math.min(nums[0], nums[1]),
            sell: Math.max(nums[0], nums[1])
          };
          break;
        }
      }
    }

    result.source = 'giavang.org';

  } catch(err) {
    result.priceError = err.message;
  }

  // ── 2. Giá vàng thế giới XAU/USD ───────────────────────
  try {
    var goldRes = UrlFetchApp.fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=1d',
      { muteHttpExceptions: true }
    );
    var goldData = JSON.parse(goldRes.getContentText());
    result.world.xauusd = goldData.chart.result[0].meta.regularMarketPrice;
  } catch(e1) {
    try {
      // Fallback: metals-api free tier
      var r2 = UrlFetchApp.fetch('https://api.metals.live/v1/spot/gold');
      var d2 = JSON.parse(r2.getContentText());
      result.world.xauusd = d2[0] ? d2[0].price : null;
    } catch(e2) {
      result.world.goldError = e2.message;
    }
  }

  // ── 3. Tỷ giá USD/VND ───────────────────────────────────
  try {
    var fxRes = UrlFetchApp.fetch(
      'https://open.er-api.com/v6/latest/USD',
      { muteHttpExceptions: true }
    );
    var fxData = JSON.parse(fxRes.getContentText());
    result.world.usdvnd = Math.round(fxData.rates.VND);
  } catch(efx) {
    result.world.fxError = efx.message;
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
