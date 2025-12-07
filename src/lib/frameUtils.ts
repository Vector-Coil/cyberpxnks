// --- In src/lib/frameUtils.ts (ADD THIS FUNCTION) ---

export interface FrameMetadata {
    version: string;
    image: string;
    postUrl: string;
    buttons: { label: string; action: string }[];
}

/**
 * Wraps frame metadata in a full HTML document with required <meta> tags.
 */
export function getFrameHtml(metadata: FrameMetadata): string {
    // 1. Start with the HTML boilerplate
    let html = `<!DOCTYPE html><html><head>`;
    
    // 2. Add the required Frame meta tags
    html += `<meta property="fc:frame" content="${metadata.version}" />`;
    html += `<meta property="fc:frame:image" content="${metadata.image}" />`;
    html += `<meta property="fc:frame:post_url" content="${metadata.postUrl}" />`;
    
    // 3. Add buttons
    metadata.buttons.forEach((button, index) => {
        const buttonNumber = index + 1;
        html += `<meta property="fc:frame:button:${buttonNumber}" content="${button.label}" />`;
        // Only include action if it's 'post' or 'post_redirect' (default is 'post')
        if (button.action) {
            html += `<meta property="fc:frame:button:${buttonNumber}:action" content="${button.action}" />`;
        }
    });
    
    // 4. Close head and add a basic body
    // The browser renders the body, the Farcaster client uses the meta tags.
    html += `</head><body><p>Loading Frame content...</p></body></html>`;

    return html;
}

/**
 * Backwards-compatible helper used by some onboard routes.
 * Kept simple: builds the metadata and returns the HTML string.
 */
export function generateFrame(image: string, text: string, buttons: { label: string; action: string }[], postUrl: string): string {
    const metadata: FrameMetadata = {
        version: '1',
        image,
        postUrl,
        buttons
    };
    return getFrameHtml(metadata);
}