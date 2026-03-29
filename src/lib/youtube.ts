/**
 * Local implementation of YouTube Transcript extraction
 * Bypasses module resolution issues with external packages in Next.js 16/Turbopack
 */

export class YoutubeTranscript {
  static async fetchTranscript(videoId: string, options?: { lang?: string }) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': options?.lang || 'ko-KR,ko;q=0.9,en;q=0.8',
        },
      });
      const html = await response.text();
      
      // Extract ytInitialPlayerResponse
      const jsonMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (!jsonMatch) {
         // Fallback: try different pattern
         const altMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
         if (!altMatch) throw new Error('Could not find video metadata');
      }
      
      const playerResponse = JSON.parse(jsonMatch ? jsonMatch[1] : '');
      const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (!tracks || tracks.length === 0) {
        throw new Error('No transcripts available for this video');
      }

      // Find preferred language or use first available
      let track = tracks[0];
      if (options?.lang) {
        const preferred = tracks.find((t: any) => t.languageCode === options.lang || t.languageCode.startsWith(options.lang));
        if (preferred) track = preferred;
      }

      const transcriptResponse = await fetch(track.baseUrl);
      const transcriptXml = await transcriptResponse.text();

      return this.parseTranscriptXml(transcriptXml);
    } catch (error) {
      console.error('[YoutubeTranscript] Error:', error);
      throw error;
    }
  }

  private static parseTranscriptXml(xml: string) {
    const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    const items = [];
    let match;

    while ((match = regex.exec(xml)) !== null) {
      items.push({
        start: parseFloat(match[1]),
        duration: parseFloat(match[2]),
        text: this.decodeHtmlEntities(match[3]),
      });
    }

    return items;
  }

  private static decodeHtmlEntities(text: string) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }
}
