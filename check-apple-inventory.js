// api/check-apple-inventory.js
// This is a Vercel serverless function that checks Apple's refurbished inventory

export default async function handler(req, res) {
  // Only allow POST requests from Vercel cron or manual triggers
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apple's refurbished store API endpoint (Japan store)
    const appleUrl = 'https://www.apple.com/jp/shop/refurbished/mac/macbook-air';
    
    // Fetch the Apple refurbished page
    const response = await fetch(appleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Apple website returned ${response.status}`);
    }

    const html = await response.text();
    
    // Look for M4 MacBook Air references in the HTML (Japanese and English)
    const m4MacBookAirRegex = /MacBook Air.*?M4|M4.*?MacBook Air|M4.*?MacBook Air/gi;
    const matches = html.match(m4MacBookAirRegex);
    
    // Also check for specific product data in JSON (Apple often includes product data in script tags)
    const productDataRegex = /"productTitle":\s*"([^"]*MacBook Air[^"]*)"/gi;
    const productMatches = [...html.matchAll(productDataRegex)];
    
    // Check for M4 chip references in various formats
    const m4Products = productMatches.filter(match => 
      match[1].toLowerCase().includes('m4') || 
      match[1].includes('M4') ||
      match[1].includes('m4')
    );

    let availableProducts = [];
    
    if (matches && matches.length > 0) {
      // Extract more detailed product information
      const productSectionRegex = /<div[^>]*class="[^"]*refurb-product[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
      const productSections = [...html.matchAll(productSectionRegex)];
      
      productSections.forEach(section => {
        const sectionHtml = section[0];
        if ((sectionHtml.toLowerCase().includes('m4') || sectionHtml.includes('M4')) && 
            sectionHtml.toLowerCase().includes('macbook air')) {
          // Extract product title
          const titleMatch = sectionHtml.match(/<h3[^>]*>([^<]+)<\/h3>/);
          const title = titleMatch ? titleMatch[1].trim() : 'M4 MacBook Air';
          
          // Extract price (Japanese Yen format)
          const priceMatch = sectionHtml.match(/¥[\d,]+|￥[\d,]+|\$[\d,]+/);
          const price = priceMatch ? priceMatch[0] : 'Price not found';
          
          availableProducts.push({
            title,
            price,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // Check if we found any M4 MacBook Air products
    const isAvailable = availableProducts.length > 0 || (matches && matches.length > 0);

    if (isAvailable) {
      // Send notification (you'll need to configure this)
      await sendNotification(availableProducts);
      
      return res.status(200).json({
        status: 'success',
        available: true,
        products: availableProducts,
        message: 'M4 MacBook Air found in refurbished store!'
      });
    } else {
      return res.status(200).json({
        status: 'success',
        available: false,
        message: 'No M4 MacBook Air found in refurbished store'
      });
    }

  } catch (error) {
    console.error('Error checking Apple inventory:', error);
    
    // Send error notification
    await sendErrorNotification(error.message);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

async function sendNotification(products) {
  // Option 1: Send email via a service like SendGrid, Resend, or EmailJS
  // Option 2: Send to Discord webhook
  // Option 3: Send to Slack webhook
  // Option 4: Send to Telegram bot
  
  // Example using Discord webhook (replace with your webhook URL)
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (discordWebhookUrl) {
    const message = {
      content: `🍎 **M4 MacBook Air Available in Japan!** 🍎\n\n${products.map(p => `**${p.title}** - ${p.price}`).join('\n')}\n\n🔗 Check now: https://www.apple.com/jp/shop/refurbished/mac/macbook-air`
    };

    try {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Error sending Discord notification:', error);
    }
  }

  // Example using email (if you prefer email notifications)
  // You can use services like Resend, SendGrid, or EmailJS
  const emailApiKey = process.env.EMAIL_API_KEY;
  const emailTo = process.env.EMAIL_TO;
  
  if (emailApiKey && emailTo) {
    // Implementation depends on your email service
    // Example for Resend:
    /*
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'notifications@yourdomain.com',
        to: emailTo,
        subject: 'M4 MacBook Air Available in Japan!',
        html: `
          <h2>M4 MacBook Air Available on Apple Japan Refurbished Store!</h2>
          <ul>
            ${products.map(p => `<li><strong>${p.title}</strong> - ${p.price}</li>`).join('')}
          </ul>
          <p><a href="https://www.apple.com/jp/shop/refurbished/mac/macbook-air">Check Apple Japan Store Now</a></p>
        `
      })
    });
    */
  }
}

async function sendErrorNotification(errorMessage) {
  // Send a notification about errors so you know if the script stops working
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (discordWebhookUrl) {
    const message = {
      content: `⚠️ **Apple Monitor Error** ⚠️\n\nError: ${errorMessage}\nTime: ${new Date().toISOString()}`
    };

    try {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Error sending error notification:', error);
    }
  }
}
