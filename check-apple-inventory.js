// check-apple-inventory.js
// Node.js script for GitHub Actions

const https = require('https');
const fs = require('fs');

async function checkAppleInventory() {
  console.log('🍎 Starting Apple M4 MacBook Air inventory check...');
  console.log('Time:', new Date().toISOString());
  
  try {
    // Apple's refurbished store (Japan)
    const appleUrl = 'https://www.apple.com/jp/shop/refurbished/mac/macbook-air';
    
    console.log('📡 Fetching Apple Japan refurbished store...');
    const html = await fetchUrl(appleUrl);
    
    console.log('🔍 Analyzing page content...');
    
    // Look for M4 MacBook Air references
    const m4MacBookAirRegex = /MacBook Air.*?M4|M4.*?MacBook Air/gi;
    const matches = html.match(m4MacBookAirRegex);
    
    // Check for product data in JSON format
    const productDataRegex = /"productTitle":\s*"([^"]*MacBook Air[^"]*)"/gi;
    const productMatches = [...html.matchAll(productDataRegex)];
    
    const m4Products = productMatches.filter(match => 
      match[1].toLowerCase().includes('m4') || 
      match[1].includes('M4')
    );

    let availableProducts = [];
    
    if (matches && matches.length > 0) {
      console.log('✅ Found M4 MacBook Air references!');
      
      // Extract product sections
      const productSectionRegex = /<div[^>]*class="[^"]*refurb[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
      const productSections = [...html.matchAll(productSectionRegex)];
      
      productSections.forEach(section => {
        const sectionHtml = section[0];
        if ((sectionHtml.toLowerCase().includes('m4') || sectionHtml.includes('M4')) && 
            sectionHtml.toLowerCase().includes('macbook air')) {
          
          // Extract product title
          const titleMatch = sectionHtml.match(/<h3[^>]*>([^<]+)<\/h3>/) || 
                            sectionHtml.match(/<h4[^>]*>([^<]+)<\/h4>/) ||
                            sectionHtml.match(/title="([^"]*MacBook Air[^"]*)"/) ||
                            sectionHtml.match(/alt="([^"]*MacBook Air[^"]*)"/) ||
                            sectionHtml.match(/>([^<]*MacBook Air[^<]*M4[^<]*)</);
          
          const title = titleMatch ? titleMatch[1].trim() : 'M4 MacBook Air';
          
          // Extract price (Japanese Yen format)
          const priceMatch = sectionHtml.match(/¥[\d,]+|￥[\d,]+/) || 
                            sectionHtml.match(/\$[\d,]+/);
          const price = priceMatch ? priceMatch[0] : 'Price not found';
          
          availableProducts.push({
            title: title.replace(/\s+/g, ' '),
            price,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // Also check for simple text mentions
    if (html.toLowerCase().includes('m4') && html.toLowerCase().includes('macbook air')) {
      console.log('📝 Found M4 MacBook Air text mentions');
      
      if (availableProducts.length === 0) {
        availableProducts.push({
          title: 'M4 MacBook Air (detected)',
          price: 'Check website for price',
          timestamp: new Date().toISOString()
        });
      }
    }

    const isAvailable = availableProducts.length > 0;

    if (isAvailable) {
      console.log('🎉 M4 MacBook Air found! Sending notifications...');
      console.log('Products found:', availableProducts);
      
      await sendNotification(availableProducts);
      
      // Log to file for debugging
      const logEntry = {
        timestamp: new Date().toISOString(),
        status: 'AVAILABLE',
        products: availableProducts
      };
      
      console.log('✅ SUCCESS: M4 MacBook Air available!');
      console.log('📧 Notification sent');
      
    } else {
      console.log('❌ No M4 MacBook Air found in refurbished store');
      console.log('🔄 Will check again in 3 hours');
    }

  } catch (error) {
    console.error('💥 Error checking Apple inventory:', error.message);
    await sendErrorNotification(error.message);
    process.exit(1);
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const userAgent = process.env.USER_AGENT || 
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    const acceptLanguage = process.env.ACCEPT_LANGUAGE || 'ja-JP,ja;q=0.9,en;q=0.8';
    
    const options = {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': acceptLanguage,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        resolve(data);
      });
      
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function sendNotification(products) {
  const notifications = [];
  
  // Discord notification
  if (process.env.DISCORD_WEBHOOK_URL) {
    notifications.push(sendDiscordNotification(products));
  }
  
  // Email notification
  if (process.env.EMAIL_API_KEY && process.env.EMAIL_TO) {
    notifications.push(sendEmailNotification(products));
  }
  
  if (notifications.length === 0) {
    console.log('⚠️  No notification methods configured');
    return;
  }
  
  await Promise.all(notifications);
}

async function sendDiscordNotification(products) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  const message = {
    content: `🍎 **M4 MacBook Air Available in Japan!** 🍎\n\n${products.map(p => `**${p.title}** - ${p.price}`).join('\n')}\n\n🔗 **Check now:** https://www.apple.com/jp/shop/refurbished/mac/macbook-air\n\n⏰ Found at: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} JST`
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(message);
    const url = new URL(webhookUrl);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => response += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Discord notification sent successfully');
          resolve();
        } else {
          console.error('❌ Discord notification failed:', res.statusCode, response);
          reject(new Error(`Discord webhook failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Discord notification error:', err);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function sendEmailNotification(products) {
  // Implementation depends on your email service
  // This is a placeholder - you can implement with your preferred service
  console.log('📧 Email notification would be sent here');
  console.log('Products:', products);
}

async function sendErrorNotification(errorMessage) {
  if (process.env.DISCORD_WEBHOOK_URL) {
    const message = {
      content: `⚠️ **Apple Monitor Error** ⚠️\n\n**Error:** ${errorMessage}\n**Time:** ${new Date().toISOString()}\n\n*Check the GitHub Actions logs for more details.*`
    };

    try {
      const data = JSON.stringify(message);
      const url = new URL(process.env.DISCORD_WEBHOOK_URL);
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });
      
      console.log('✅ Error notification sent');
    } catch (err) {
      console.error('❌ Failed to send error notification:', err);
    }
  }
}

// Run the check
checkAppleInventory();
