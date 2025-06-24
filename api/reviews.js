const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Allow embedding and cache for 24h
  res.setHeader('X-Frame-Options','ALLOWALL');
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate');

  const GOOGLE_API_KEY         = process.env.GOOGLE_API_KEY;
  const GOOGLE_PLACE_ID        = process.env.GOOGLE_PLACE_ID;
  const TRUSTPILOT_BUSINESS_ID = process.env.TRUSTPILOT_BUSINESS_ID;

  // 1) Fetch Google Reviews
  let gData = {};
  try {
    const gRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?placeid=${GOOGLE_PLACE_ID}` +
      `&fields=reviews,rating,user_ratings_total,name,url&key=${GOOGLE_API_KEY}`
    );
    gData = (await gRes.json()).result || {};
  } catch (e) {}
  const gRevs   = gData.reviews || [];
  const gRating = gData.rating || 0;
  const gTotal  = gData.user_ratings_total || 0;
  const gLink   = gData.url || 'https://www.google.com/search?q=Alexander+Thomas+Photography+Cumbernauld';

  // 2) Scrape Trustpilot JSON-LD
  let tpRevs = [];
  try {
    const tpHtml = await fetch(`https://www.trustpilot.com/review/${TRUSTPILOT_BUSINESS_ID}`).then(r=>r.text());
    const match  = tpHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (match) {
      const ld = JSON.parse(match[1]);
      tpRevs = Array.isArray(ld.review)? ld.review : [ld.review];
    }
  } catch(e) {}

  // Helper: render one review card
  const buildCard = (name, time, rating, text, avatar) => `
    <div style="flex:1 1 300px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.05);padding:20px;margin:10px;">
      <div style="display:flex;align-items:center;gap:10px;font-weight:bold;margin-bottom:4px;">
        <img src="${avatar||'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png'}" width="32" height="32" style="border-radius:50%;" alt="">
        ${name}
      </div>
      <div style="color:#999;font-size:12px;margin-bottom:8px;">${time}</div>
      <div style="color:#fbbc04;font-size:16px;">${'★'.repeat(Math.round(rating)||0)}</div>
      <p style="font-size:14px;color:#333;margin-top:8px;">${text}</p>
    </div>`;

  // Build widget HTML
  let html = `
    <div style="font-family:Arial,sans-serif;max-width:1000px;margin:0 auto;padding:40px 20px;">
      <h2 style="text-align:center;font-size:28px;margin-bottom:30px;">What Our Customers Say</h2>
      <div style="display:flex;justify-content:space-between;align-items:center;background:#f6f6f6;border-radius:10px;padding:20px 30px;margin-bottom:30px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/32px-Google_%22G%22_Logo.svg.png" width="28" height="28" alt="G">
          <div>
            <div style="font-size:20px;font-weight:bold;">Google Reviews</div>
            <div style="font-size:16px;color:#fbbc04;">★★★★★ <span style="color:#333;">${gRating.toFixed(1)} (${gTotal})</span></div>
          </div>
        </div>
        <a href="${gLink}" target="_blank" style="background:#1a73e8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Review us on Google
        </a>
      </div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;">`;
  gRevs.slice(0,2).forEach(r => html += buildCard(r.author_name, r.relative_time_description, r.rating, r.text, r.profile_photo_url));
  tpRevs.slice(0,2).forEach(r => {
    const d = new Date(r.datePublished);
    const dateStr = `${d.getDate()} ${d.toLocaleString('en-GB',{month:'short'})}`;
    html += buildCard(r.author?.name||r.author, dateStr, r.reviewRating?.ratingValue, r.reviewBody, r.author?.image);
  });
  html += '</div></div>';

  // Cache and return
  CacheService.getScriptCache().put('combinedReviews', html, 86400);
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
};
